"""Scientific-integrity tests for the real-evidence dataset and API."""

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from amira import dataset, engine, exports, maturity
from main import app

client = TestClient(app)
REPO = Path(__file__).resolve().parents[2]


# --------------------------------------------------------------------------- #
# Dataset integrity
# --------------------------------------------------------------------------- #
def test_nct_deduplication():
    ncts = [t["nct_id"] for t in dataset.trials()]
    assert len(ncts) == len(set(ncts))
    assert all(re.fullmatch(r"NCT\d{8}", n) for n in ncts)


def test_every_assertion_has_passage_and_resolvable_source():
    for a in dataset.assertions():
        assert a["exact_passage"].strip(), a["assertion_id"]
        src = dataset.source_by_id(a["source_id"])
        assert src["url"].startswith("https://"), a["assertion_id"]
        assert "example.org" not in src["url"]


def test_no_unverified_data_marked_human_verified():
    for a in dataset.assertions():
        if a.get("human_verified"):
            assert a.get("verifier"), f"{a['assertion_id']} human_verified without a verifier"


def test_maturity_level_is_never_stored_in_source_data():
    """The awarded level must be derived, never persisted."""
    blob = json.dumps(dataset.load())
    for banned in ("evidence_level", "maturity_level", "evidence_maturity_level"):
        assert banned not in blob, f"dataset stores a maturity level ({banned})"


def test_source_urls_are_real_registries_or_literature():
    allowed = ("clinicaltrials.gov", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov")
    for s in dataset.sources():
        assert any(d in s["url"] for d in allowed), s["url"]


# --------------------------------------------------------------------------- #
# Count-basis / double counting
# --------------------------------------------------------------------------- #
def test_count_basis_compatibility_never_mixes_silently():
    totals = engine.aggregate_participants([t["trial_id"] for t in dataset.trials()])
    if totals["trials_with_percentage_only"]:
        # A mixed figure must be labelled as such and must not claim to be reported.
        assert totals["women_estimated_basis"] == "mixed_reported_and_derived"
        assert totals["count_basis_warning"]
    # The reported subtotal only ever sums genuinely reported counts.
    reported = 0
    for tid in totals["trials_with_reported_female_count"]:
        v, b, _ = dataset.assertion_value(tid, "female_enrollment_count")
        assert b == "reported"
        reported += v
    assert totals["women_reported_count"] == reported


def test_participant_double_count_prevention():
    """Each trial contributes its participants exactly once."""
    trials = dataset.trials()
    totals = engine.aggregate_participants([t["trial_id"] for t in trials])
    expected = sum(
        dataset.assertion_value(t["trial_id"], "total_enrollment")[0] for t in trials
    )
    assert totals["participants_total"] == expected
    # And the derived female estimate never exceeds total participants.
    assert totals["women_estimated_total"] <= totals["participants_total"]


def test_evidence_status_semantics():
    """not_reported is distinct from an affirmative 'no' and from absence."""
    for a in dataset.assertions():
        if a["value_basis"] == "not_reported":
            assert a["value"] in (None, "not_reported"), a["assertion_id"]
        if a["value_basis"] == "reported":
            assert a["value"] is not None, a["assertion_id"]


# --------------------------------------------------------------------------- #
# Maturity derivation
# --------------------------------------------------------------------------- #
def test_maturity_is_derived_and_cumulative():
    m = maturity.evaluate([t["trial_id"] for t in dataset.trials()])
    assert m["derived"] is True
    awarded = m["level"]
    for rung in m["rule_trace"]:
        if rung["level"] <= awarded:
            assert rung["satisfied"], f"level {rung['level']} awarded but not satisfied"


def test_no_age_to_menopause_inference():
    """Trials enrol by age only; menopause must NOT be inferred from that."""
    for t in dataset.trials():
        v, basis, _ = dataset.assertion_value(t["trial_id"], "menopause_status_reported")
        assert v != "yes", "menopausal status reported without a source"
    m = maturity.evaluate([t["trial_id"] for t in dataset.trials()])
    assert m["level"] < 3, "Life Stage Aware awarded without a menopausal-status report"


# --------------------------------------------------------------------------- #
# API behaviour
# --------------------------------------------------------------------------- #
def _check(**kw):
    body = {"condition": "Cardiovascular disease prevention", "medicine": "Rosuvastatin",
            "life_stage": "not_specified", "hormone_therapy": "any"}
    body.update(kw)
    r = client.post("/api/check-evidence", json=body)
    assert r.status_code == 200
    return r.json()


def test_response_carries_provenance_envelope():
    r = _check()
    for key in ("dataset_version", "source_cutoff", "commit_hash", "generated_at"):
        assert r[key], key
    assert all(s["url"].startswith("https://") for s in r["sources"])


def test_life_stage_changes_evidence_context():
    a = _check(life_stage="not_specified")["life_stage_context"]
    b = _check(life_stage="menopause_postmenopause")["life_stage_context"]
    assert a["status"] != b["status"]
    assert b["status"] == "not_established_in_corpus"
    assert "menopause" in b["message"].lower()
    assert "age is not used to infer" in b["message"].lower()


def test_hormone_therapy_changes_evidence_context():
    a = _check(hormone_therapy="any")["hormone_therapy_context"]
    b = _check(hormone_therapy="yes")["hormone_therapy_context"]
    assert a["status"] != b["status"]
    assert b["supported"] is False


def test_unsupported_medicine_returns_bounded_response():
    r = _check(medicine="Pravastatin")
    assert r["supported"] is False
    assert r["bounded_response"]["status"] == "medicine_not_in_corpus"
    assert "Rosuvastatin" in r["bounded_response"]["supported_medicines"]


def test_ui_api_and_downloads_agree_numerically():
    """The download is the full dataset; the API filters by medicine. The
    medicine-matched subset of the download must equal the API exactly."""
    api = _check()
    medicine = api["query"]["medicine"]

    csv_text = client.get("/api/download/trials.csv").text
    import csv as _csv
    import io as _io
    csv_rows = list(_csv.DictReader(_io.StringIO(csv_text)))
    # Download covers every ingested trial, including other medicines in the class.
    assert len(csv_rows) == len(dataset.trials())

    subset = [r for r in csv_rows if r["medicine"].lower() == medicine.lower()]
    assert len(subset) == len(api["trials"])

    csv_women = sum(int(r["female_n"]) for r in subset if r["female_n"])
    assert csv_women == api["totals"]["women_reported_count"]
    csv_total = sum(int(r["total_enrollment"]) for r in subset)
    assert csv_total == api["totals"]["participants_total"]

    # Per-trial parity between the API rows and the exported rows.
    by_id = {r["trial_id"]: r for r in subset}
    for t in api["trials"]:
        row = by_id[t["trial_id"]]
        assert int(row["total_enrollment"]) == t["total_enrollment"]
        assert row["nct_id"] == t["nct_id"]


def test_benchmark_is_real_and_not_human_verified_yet():
    r = client.get("/api/benchmark").json()
    items = r["items"]
    assert len(items) == 30
    assert {i["split"] for i in items} == {"development", "validation", "test"}
    for i in items:
        assert i["exact_passage"].strip()
        assert i["source_url"].startswith("https://")
        assert "example.org" not in i["source_url"]
        assert i["human_verified"] is False
        assert i["annotation_status"] == "pending_human_review"
    assert r["evaluation"]["status"] == "EVALUATION PENDING"
