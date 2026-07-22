"""Integrity tests for the clinician-facing derived outputs.

These guard the statistical claims AMIRA is allowed to make.
"""

import pytest
from fastapi.testclient import TestClient

from amira import clinical, dataset, engine, exports, maturity
from main import app

client = TestClient(app)


def _check(**kw):
    body = {"condition": "Cardiovascular disease prevention", "medicine": "Rosuvastatin",
            "life_stage": "not_specified", "hormone_therapy": "any"}
    body.update(kw)
    r = client.post("/api/check-evidence", json=body)
    assert r.status_code == 200
    return r.json()


# --------------------------------------------------------------------------- #
# Study identification
# --------------------------------------------------------------------------- #
def test_all_included_studies_are_randomized_and_phase_is_not_inferred():
    for t in dataset.trials():
        assert t["study_type"] == "Randomized Controlled Trial", t["trial_id"]
        assert t["study_phase"] in {"Phase 3", "Phase 4", "Not reported"}, t["trial_id"]
    hayoz = next(t for t in dataset.trials() if t["trial_id"] == "HAYOZ-2012")
    assert hayoz["study_phase"] == "Not reported"


def test_trial_and_publication_deduplication():
    ncts = [t["nct_id"] for t in dataset.trials() if t.get("nct_id")]
    assert len(ncts) == len(set(ncts))
    sids = [s["source_id"] for s in dataset.sources()]
    assert len(sids) == len(set(sids))
    pmids = [s["pmid"] for s in dataset.sources() if s.get("pmid")]
    assert len(pmids) == len(set(pmids)), "the same publication is ingested twice"


def test_every_trial_has_a_primary_endpoint_and_drug_class():
    for t in dataset.trials():
        assert (t.get("primary_endpoint") or "").strip(), t["trial_id"]
        assert (t.get("drug_class") or "").strip(), t["trial_id"]


# --------------------------------------------------------------------------- #
# Statistical claim discipline
# --------------------------------------------------------------------------- #
def test_significance_is_never_inferred_without_a_reported_test():
    """A finding may only claim significance if it carries a test or p-value."""
    for f in dataset.findings():
        if f["significance"] in ("significant", "no_significant_difference"):
            assert f.get("comparison_p") is not None or f.get("comparison_test"), (
                f"{f['finding_id']} claims '{f['significance']}' with no reported "
                "statistical comparison"
            )


def test_no_equality_inferred_from_absent_comparison():
    """With no comparison at all, effectiveness must be insufficient - never 'no difference'."""
    state = clinical.effectiveness_state("Atorvastatin")
    assert state["state"] == clinical.EFF_INSUFFICIENT
    assert state["state"] != clinical.EFF_NO_DIFF


def test_no_difference_state_requires_a_real_comparison():
    state = clinical.effectiveness_state("Rosuvastatin")
    if state["state"] == clinical.EFF_NO_DIFF:
        assert any(
            f.get("comparison_p") is not None or f.get("comparison_test")
            for f in state["findings"]
        ), "'no significant difference' returned without any sex comparison"


def test_significant_and_trend_findings_are_separated():
    saf = clinical.safety_state("Rosuvastatin")
    for f in saf["significant_findings"]:
        assert f["significance"] == "significant"
    for f in saf["trend_findings"]:
        assert f["significance"] == "trend_only"
    # A trend must never also appear in the significant bucket.
    sig_ids = {f["finding_id"] for f in saf["significant_findings"]}
    trend_ids = {f["finding_id"] for f in saf["trend_findings"]}
    assert not (sig_ids & trend_ids)


def test_safety_insufficient_is_not_reported_as_no_difference():
    """No drug-specific sex-stratified AE data => insufficient, not 'no difference'."""
    saf = clinical.safety_state("Rosuvastatin")
    drug_specific = [f for f in dataset.findings_for("Rosuvastatin", "safety")
                     if f["scope"].startswith("trial:")]
    if not drug_specific:
        assert saf["state"] != clinical.SAF_NO_DIFF
        assert saf["state"] == clinical.SAF_INSUFFICIENT


def test_interaction_p_is_parsed_and_surfaced():
    class_findings = [f for f in dataset.findings() if f["scope"] == "class:Statin"
                      and f["finding_type"] == "efficacy"]
    assert class_findings, "expected a class-level efficacy finding"
    f = class_findings[0]
    assert f["comparison_p"] is not None
    float(f["comparison_p"])  # must parse as a number


# --------------------------------------------------------------------------- #
# Maturity + life stage
# --------------------------------------------------------------------------- #
def test_no_age_to_menopause_inference_across_all_trials():
    for t in dataset.trials():
        assert t.get("minimum_age")  # trials do restrict by age
        v, _, assertion = dataset.assertion_value(t["trial_id"], "menopause_status_reported")
        if v == "yes":
            assert "postmenopausal" in assertion["exact_passage"].lower()
    for med in ("Rosuvastatin", "Atorvastatin"):
        ids = [t["trial_id"] for t in dataset.trials() if t["medicine"] == med]
        assert maturity.evaluate(ids)["level"] < 3


def test_maturity_never_stored_including_findings():
    import json
    blob = json.dumps(dataset.load())
    for banned in ("maturity_level", "evidence_level", "\"level\":"):
        assert banned not in blob, f"dataset stores a derived level ({banned})"


# --------------------------------------------------------------------------- #
# Drug class comparison
# --------------------------------------------------------------------------- #
def test_class_comparison_contains_only_verified_medicines():
    cc = clinical.class_comparison("Statin")
    ingested = {t["medicine"] for t in dataset.trials() if t["drug_class"] == "Statin"}
    complete = {m for m in ingested if clinical.medicine_ingestion_complete(m)}
    incomplete = ingested - complete
    # verified_medicines contains ONLY completed-ingestion medicines (Blocker F).
    assert set(cc["verified_medicines"]) == complete
    # An incomplete medicine (Atorvastatin) is never called verified; it is listed
    # separately with an explicit "Incomplete evidence review" status.
    assert {m["medicine"] for m in cc["incomplete_medicines"]} == incomplete
    assert all(m["status"] == "Incomplete evidence review" for m in cc["incomplete_medicines"])
    # rows still surface every in-corpus medicine, but incomplete ones are unrankable.
    assert {r["medicine"] for r in cc["rows"]} == ingested
    for row in cc["rows"]:
        if not row["ingestion_complete"]:
            assert row["rankable"] is False


def test_class_comparison_sorted_by_maturity_desc():
    rows = clinical.class_comparison("Statin")["rows"]
    levels = [r["maturity_level"] for r in rows]
    assert levels == sorted(levels, reverse=True)


def test_class_membership_is_consistent():
    for t in dataset.trials():
        for f in dataset.findings_for(t["medicine"], "efficacy"):
            assert f["drug_class"] == t["drug_class"]


def test_class_comparison_makes_no_direct_efficacy_claim():
    """AMIRA compares evidence strength, never claims one drug outperforms another."""
    cc = clinical.class_comparison("Statin")
    text = (cc["note"] + " ".join(r["effectiveness_state"] for r in cc["rows"])).lower()
    for banned in ("more effective", "outperforms", "better than", "superior to", "best"):
        assert banned not in text, f"class comparison implies superiority: {banned}"


def test_endpoint_compatibility_recorded_for_direct_comparison():
    """Trials in the class must expose endpoints so compatibility can be judged."""
    endpoints = {t["trial_id"]: t["primary_endpoint"] for t in dataset.trials()}
    assert all(endpoints.values())
    # JUPITER and CARDS have different populations/endpoints: no direct efficacy
    # comparison is asserted anywhere in the API response.
    api = _check()
    for row in api["class_comparison"]["rows"]:
        assert "more effective" not in row["effectiveness_state"].lower()


# --------------------------------------------------------------------------- #
# API surface
# --------------------------------------------------------------------------- #
def test_banner_answers_the_four_questions():
    b = _check()["banner"]
    assert b["maturity"]["level"] is not None
    assert b["effectiveness"]["state"]
    assert b["safety"]["state"]
    assert b["class_comparison"]["verified_count"] >= 1
    assert b["why_this_result"]


def test_findings_download_matches_api():
    api_findings = client.get("/api/findings").json()["findings"]
    assert len(api_findings) == len(dataset.findings())
    csv_text = client.get("/api/download/findings.csv").text
    assert len(csv_text.strip().splitlines()) - 1 == len(dataset.findings())
    for f in api_findings:
        assert f["source_url"].startswith("https://")


def test_every_finding_links_to_a_real_source():
    for f in dataset.findings():
        s = dataset.source_by_id(f["source_id"])
        assert s["url"].startswith("https://")
        assert any(d in s["url"] for d in
                   ("clinicaltrials.gov", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov",
                    "nature.com"))
        assert f["exact_passage"].strip()
        assert f["human_verified"] is False  # nothing signed off yet


def test_unsupported_medicine_still_bounded():
    r = _check(medicine="Pravastatin")
    assert r["supported"] is False
    assert r["bounded_response"]["status"] == "medicine_not_in_corpus"


def test_evidence_gaps_use_exact_counts():
    for g in _check()["evidence_gaps"]:
        assert isinstance(g["n_reporting"], int) and isinstance(g["n_trials"], int)
        assert str(g["n_trials"]) in g["statement"]
        for vague in (" rarely ", " usually ", " some ", " many "):
            assert vague not in g["statement"].lower()
