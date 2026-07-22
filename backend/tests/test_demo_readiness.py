"""Demo-readiness tests: restored summary cards + dapagliflozin real-data case."""

import csv
import io

import pytest
from fastapi.testclient import TestClient

from amira import clinical, dataset, engine, maturity
from main import app

client = TestClient(app)


def _check(**kw):
    body = {"condition": "Cardiovascular disease prevention", "medicine": "Rosuvastatin",
            "life_stage": "not_specified", "hormone_therapy": "any"}
    body.update(kw)
    r = client.post("/api/check-evidence", json=body)
    assert r.status_code == 200
    return r.json()


# 1. Restored summary cards derive from real normalized records.
def test_summary_cards_present_and_derived():
    dims = {d["dimension"] for d in _check()["dimensions"]}
    assert {"sex_specific_efficacy_reported", "sex_specific_safety_reported",
            "menopause_status_reported", "hormone_therapy_reported",
            "pregnancy_evidence_reported"} <= dims
    for d in _check()["dimensions"]:
        # n_reporting is a real count of trials with an affirmative assertion.
        real = sum(1 for t in dataset.trials()
                   if t["medicine"] == "Rosuvastatin"
                   and dataset.assertion_value(t["trial_id"], d["dimension"])[0] == "yes")
        assert d["n_reporting"] == real


# 2. Old synthetic values cannot reappear.
def test_no_synthetic_values_in_response():
    import json
    blob = json.dumps(_check())
    for banned in ("18,452", "18452", "4,125", "98,742", "AMIRA-DEMO", "example.org"):
        assert banned not in blob


# 3. Menopause and Hormone Therapy cards count reporting coverage correctly.
def test_menopause_and_hormone_cards_count_coverage():
    r = _check()
    by = {d["dimension"]: d for d in r["dimensions"]}
    # No statin trial reports menopause or hormone therapy.
    assert by["menopause_status_reported"]["n_reporting"] == 0
    assert by["hormone_therapy_reported"]["n_reporting"] == 0
    assert by["menopause_status_reported"]["display"] == f"0 / {by['menopause_status_reported']['n_trials']}"


# 4. Dapagliflozin statistics match source-backed records.
def test_dapagliflozin_statistics_match_sources():
    r = _check(condition="Heart failure", medicine="Dapagliflozin")
    assert r["supported"]
    assert r["totals"]["women_reported_count"] == 1109
    assert r["totals"]["participants_total"] == 4744
    who = r["who_was_studied"][0]
    assert who["female_n"] == 1109
    assert who["nct_id"] == "NCT03036124"
    eff = r["effectiveness"]["findings"][0]
    assert eff["female_estimate"] == "HR 0.79" and eff["male_estimate"] == "HR 0.73"
    assert eff["comparison_p"] == "0.67"
    # Every dapagliflozin finding links to a real PubMed/CT.gov source.
    for f in dataset.findings_for("Dapagliflozin", "efficacy") + dataset.findings_for("Dapagliflozin", "safety"):
        s = dataset.source_by_id(f["source_id"])
        assert s["url"].startswith("https://") and "example.org" not in s["url"]
        assert f["human_verified"] is False


# 5. Drug-specific effectiveness requires a valid drug-specific comparison.
def test_dapagliflozin_no_difference_is_backed_by_a_real_test():
    eff = clinical.effectiveness_state("Dapagliflozin")
    assert eff["state"] == clinical.EFF_NO_DIFF
    drug = [f for f in eff["findings"] if f["scope"].startswith("trial:")]
    assert any(f["comparison_p"] is not None for f in drug), (
        "'no significant difference' must rest on a drug-specific interaction p"
    )


# 6. Class-level evidence cannot drive a drug-specific verdict (rosuvastatin).
def test_class_level_still_cannot_drive_rosuvastatin():
    eff = clinical.effectiveness_state("Rosuvastatin")
    assert eff["state"] == clinical.EFF_REPORTED_UNCLEAR
    assert any(f["scope"].startswith("class:") and f["comparison_p"] for f in eff["class_level_findings"])


# 7. Significant and non-significant safety findings remain separate.
def test_safety_significant_and_trend_separate():
    saf = clinical.safety_state("Dapagliflozin")
    for f in saf["significant_findings"]:
        assert f["significance"] == "significant"
    for f in saf["trend_findings"]:
        assert f["significance"] == "trend_only"
    # DAPA-HF reported safety by sex, but only against placebo WITHIN each sex. No
    # between-sex comparison was reported, so no between-sex difference or equivalence
    # may be claimed.
    assert saf["state"] == clinical.SAF_REPORTED_NO_COMPARISON
    assert saf["state"] != clinical.SAF_NO_DIFF


# 8. Filters map Heart Failure -> SGLT2 inhibitor -> Dapagliflozin.
def test_catalog_condition_class_medicine_cascade():
    cat = client.get("/api/catalog").json()["conditions"]
    hf = next(c for c in cat if c["condition"] == "Heart failure")
    sglt2 = next(dc for dc in hf["drug_classes"] if dc["drug_class"] == "SGLT2 inhibitor")
    assert sglt2["medicines"] == ["Dapagliflozin"]
    cvd = next(c for c in cat if c["condition"] == "Cardiovascular disease prevention")
    statin = next(dc for dc in cvd["drug_classes"] if dc["drug_class"] == "Statin")
    # Only completed-ingestion (verified) medicines are selectable (Blocker F).
    # Atorvastatin is incomplete (not_located female enrollment) and is excluded.
    assert set(statin["medicines"]) == {"Rosuvastatin"}
    # Only verified medicines appear.
    ingested = {t["medicine"] for t in dataset.trials()}
    for c in cat:
        for dc in c["drug_classes"]:
            for med in dc["medicines"]:
                assert med in ingested


# 9. UI, API, CSV and JSONL remain numerically consistent (dapagliflozin).
def test_ui_api_csv_consistent_for_dapagliflozin():
    api = _check(condition="Heart failure", medicine="Dapagliflozin")
    csv_text = client.get("/api/download/trials.csv").text
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    subset = [r for r in rows if r["medicine"] == "Dapagliflozin"]
    assert len(subset) == len(api["trials"]) == 1
    assert int(subset[0]["female_n"]) == api["totals"]["women_reported_count"] == 1109
    assert int(subset[0]["total_enrollment"]) == api["totals"]["participants_total"] == 4744


# 10. Age never infers life stage for the new trial either.
def test_dapagliflozin_no_age_to_menopause_inference():
    v, _, _ = dataset.assertion_value("DAPA-HF", "menopause_status_reported")
    assert v != "yes"
    assert maturity.evaluate(["DAPA-HF"])["level"] < 3
