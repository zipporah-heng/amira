"""Second-pass adversarial tests: bad evidence must fail closed at RUNTIME across
every public surface — not merely be flagged by a validator.

These drive real runtime paths: engine.check_evidence, exports CSV/JSONL,
aggregate_participants, maturity, clinical states, and readiness.
"""

import csv
import io
import json

import pytest

from amira import dataset, engine, exports, clinical, maturity, readiness


def S(sid, url="https://clinicaltrials.gov/study/NCT00000009"):
    return {"source_id": sid, "url": url, "source_type": "trial_registry_record",
            "title": "src", "publisher": "X", "year": 2020}


def A(aid, tid, dim, value, basis, sid="SRC-OK", verified=True, extra=None):
    a = {"assertion_id": aid, "trial_id": tid, "dimension": dim, "value": value,
         "value_basis": basis, "source_id": sid, "exact_passage": "p",
         "source_verified": verified, "human_verified": False, "verifier": None}
    if extra:
        a.update(extra)
    return a


def T(tid, medicine="TestMed", primary="SRC-OK", cls="TestClass"):
    return {"trial_id": tid, "nct_id": "NCT00000009", "display_name": tid, "medicine": medicine,
            "drug_class": cls, "condition": "Test condition", "study_phase": "Phase 3",
            "study_type": "Randomized Controlled Trial", "enrollment_actual": 500,
            "minimum_age": "18 Years", "sex_eligibility": "ALL", "start_date": "2019-01",
            "completion_date": "2021-01", "registry_url": "https://clinicaltrials.gov/study/NCT00000009",
            "has_registry_results": True, "primary_source_id": primary}


REQUIRED_MIN = ["female_enrollment_count", "sex_specific_efficacy_reported",
                "sex_specific_safety_reported", "menopause_status_reported",
                "hormone_therapy_reported", "pregnancy_evidence_reported"]


def _fill_required(tid, exclude=()):
    """Give a trial a documented (not_reported) assertion for each required dim."""
    out = []
    for i, dim in enumerate(REQUIRED_MIN):
        if dim in exclude:
            continue
        out.append(A(f"{tid}-{i}", tid, dim, "not_reported", "not_reported"))
    return out


@pytest.fixture
def patch(monkeypatch):
    def _apply(trials, assertions, findings=None, sources=None, comparisons=None):
        monkeypatch.setattr(dataset, "trials", lambda: trials)
        monkeypatch.setattr(dataset, "assertions", lambda: assertions)
        monkeypatch.setattr(dataset, "findings", lambda: findings if findings is not None else [])
        monkeypatch.setattr(dataset, "sources", lambda: sources if sources is not None else [S("SRC-OK")])
        monkeypatch.setattr(dataset, "direct_comparisons", lambda: comparisons if comparisons is not None else [])
    return _apply


def _surfaces_for(medicine, condition, trial_id):
    """Return (api_total, csv_total, jsonl_total, agg_total, coverage) for a trial."""
    api = engine.check_evidence(condition=condition, medicine=medicine)
    api_row = next(r for r in api["trials"] if r["trial_id"] == trial_id)
    csv_row = next(r for r in csv.DictReader(io.StringIO(exports.trials_csv())) if r["trial_id"] == trial_id)
    jrow = next(json.loads(l) for l in exports.trials_jsonl().splitlines()
                if l.strip() and json.loads(l)["trial_id"] == trial_id)
    agg = api["totals"]
    return api_row["total_enrollment"], csv_row["total_enrollment"], jrow["total_enrollment"], \
        agg["participants_total"], agg["participant_total_coverage"]


# 1. Dangling total suppressed across ALL public surfaces
def test_dangling_total_suppressed_everywhere(patch):
    patch([T("TX")], [A("t", "TX", "total_enrollment", 500, "reported", sid="DANGLING")] + _fill_required("TX"),
          sources=[S("SRC-OK")])
    api, csvv, jl, agg, cov = _surfaces_for("TestMed", "Test condition", "TX")
    assert api is None and csvv == "" and jl == ""
    assert agg == 0 and cov == "incomplete"


# 2. Unverified total suppressed across ALL public surfaces (was projected as 500)
def test_unverified_total_suppressed_everywhere(patch):
    patch([T("TX")], [A("t", "TX", "total_enrollment", 500, "reported", verified=False)] + _fill_required("TX"))
    api, csvv, jl, agg, cov = _surfaces_for("TestMed", "Test condition", "TX")
    assert api is None and csvv == "" and jl == ""
    assert agg == 0 and cov == "incomplete"


# 3/4. Authoritative URL parsing
@pytest.mark.parametrize("url,ok", [
    ("https://clinicaltrials.gov/study/NCT1", True),
    ("https://pubmed.ncbi.nlm.nih.gov/123/", True),
    ("https://pmc.ncbi.nlm.nih.gov/articles/PMC1", True),
    ("https://", False),
    ("not a url", False),
    ("http://clinicaltrials.gov/x", False),
    ("https://evil.invalid/path/clinicaltrials.gov", False),
    ("https://clinicaltrials.gov.evil.invalid", False),
    ("https://example.com", False),
])
def test_authoritative_url(url, ok):
    assert dataset.authoritative_url_ok(url) is ok


# 5. Unverified effectiveness finding does not change effectiveness state
def test_unverified_effectiveness_finding_ignored(patch):
    f = {"finding_id": "F1", "medicine": "TestMed", "finding_type": "efficacy", "scope": "trial:TX",
         "significance": "significant", "endpoint": "e", "source_id": "SRC-OK", "exact_passage": "p",
         "source_verified": False, "comparison_p": "0.01", "comparison_test": "t",
         "population_scope": "women_and_men"}
    patch([T("TX")], _fill_required("TX"), findings=[f])
    st = clinical.effectiveness_state("TestMed")
    assert st["state"] != clinical.EFF_SIGNIFICANT


# 6. Unverified direct comparison excluded from check_evidence
def test_unverified_direct_comparison_excluded(patch):
    comp = {"comparison_id": "C1", "trial_id": "TX", "medicine": "TestMed", "comparator": "Other",
            "source_id": "SRC-OK", "source_verified": False, "exact_passage": "p",
            "outcomes": [{"exact_passage": "p"}], "headline": "h"}
    patch([T("TX")], _fill_required("TX"), comparisons=[comp])
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")
    assert api["direct_comparisons"] == []


# 7. Derived value whose dependency is not_reported fails closed
def test_derived_pct_with_not_reported_dependency_fails_closed(patch):
    patch([T("TX")], [
        A("dep", "TX", "female_enrollment_count", None, "not_reported"),
        A("der", "TX", "female_enrollment_pct", 60.0, "derived",
          extra={"derived_from": ["dep"], "derivation_rule": "x", "derivation_version": "1.0"}),
    ] + _fill_required("TX", exclude=["female_enrollment_count"]))
    v = dataset.assertion_validity("TX", "female_enrollment_pct", require_numeric=True)
    assert v["valid"] is False
    row = next(r for r in exports.trial_rows() if r["trial_id"] == "TX")
    assert row["female_pct"] == ""


# 8. Derived total is consistently withheld across surfaces (parity)
def test_derived_total_parity(patch):
    patch([T("TX")], [
        A("c", "TX", "female_enrollment_count", 100, "reported"),
        A("t", "TX", "total_enrollment", 500, "derived",
          extra={"derived_from": ["c"], "derivation_rule": "x", "derivation_version": "1.0"}),
    ] + _fill_required("TX", exclude=["female_enrollment_count"]))
    api, csvv, jl, agg, cov = _surfaces_for("TestMed", "Test condition", "TX")
    assert api is None and csvv == "" and jl == "" and agg == 0 and cov == "incomplete"
    assert dataset.total_enrollment_projection("TX")["state"] == "unsupported-derived"


# 9. Partial medicine that can still score is NOT ranked
def test_partial_medicine_scores_but_is_not_ranked(patch):
    # MedA: complete + scorable. MedC: reaches level 1 (verified female count) but is
    # missing a required dimension -> ingestion incomplete -> unrankable.
    patch([T("A1", medicine="MedA"), T("C1", medicine="MedC", cls="TestClass")], [
        *[A(f"a{i}", "A1", d, "not_reported", "not_reported") for i, d in enumerate(REQUIRED_MIN)],
        A("a-fc", "A1", "female_enrollment_count", 100, "reported"),
        A("a-eff", "A1", "sex_specific_efficacy_reported", "yes", "reported"),
        A("c-fc", "C1", "female_enrollment_count", 50, "reported"),   # level 1
        # C1 missing the other required dimensions -> ingestion incomplete
    ])
    comp = clinical.class_comparison("TestClass")
    medc = next(r for r in comp["rows"] if r["medicine"] == "MedC")
    assert medc["ingestion_complete"] is False
    assert medc["rankable"] is False


# 10. Conflicting total yields no public numeric value
def test_conflicting_total_no_public_value(patch):
    patch([T("TX")], [
        A("t1", "TX", "total_enrollment", 500, "reported"),
        A("t2", "TX", "total_enrollment", 999, "reported"),
    ] + _fill_required("TX"))
    api, csvv, jl, agg, cov = _surfaces_for("TestMed", "Test condition", "TX")
    assert api is None and csvv == "" and jl == "" and agg == 0 and cov == "incomplete"
    assert dataset.assertion_validity("TX", "total_enrollment")["state"] == "conflict"


# 12/13/14. Primary source integrity
def test_missing_primary_source_blocks_ingestion(patch):
    patch([T("A1", medicine="MedA", primary=None)],
          [A("a-fc", "A1", "female_enrollment_count", 100, "reported")] + _fill_required("A1", exclude=["female_enrollment_count"]))
    assert clinical.medicine_ingestion_complete("MedA") is False


def test_dangling_primary_source_flagged(patch):
    patch([T("A1", medicine="MedA", primary="GONE")], _fill_required("A1"), sources=[S("SRC-OK")])
    assert any(v.get("dimension") == "primary_source_id" for v in exports.source_integrity_violations())


# 16. Readiness dimension does not score from unverified evidence
def test_readiness_ignores_unverified(patch, monkeypatch):
    monkeypatch.setenv("AMIRA_ENABLE_PILOT_SCORE", "1")
    patch([T("TX")], [
        A("fc", "TX", "female_enrollment_count", 100, "reported", verified=False),  # unverified
        A("eff", "TX", "sex_specific_efficacy_reported", "yes", "reported", verified=False),
    ] + _fill_required("TX", exclude=["female_enrollment_count", "sex_specific_efficacy_reported"]))
    r = readiness.evaluate("TestMed")
    included = next(d for d in r["dimensions"] if d["key"] == "included")
    analyzed = next(d for d in r["dimensions"] if d["key"] == "analyzed")
    assert included["points"] == 0     # unverified count cannot make it complete
    assert analyzed["points"] == 0     # unverified "yes" cannot advance


# 17. Class-level safety finding never appears as a medicine-specific significant finding
def test_class_safety_context_separated(patch):
    class_f = {"finding_id": "FC", "medicine": "MedA", "finding_type": "safety", "scope": "class:TestClass",
               "significance": "significant", "endpoint": "AE", "source_id": "SRC-OK", "exact_passage": "p",
               "source_verified": True, "comparison_p": "0.01", "comparison_test": "t"}
    patch([T("A1", medicine="MedA")],
          [A("s", "A1", "sex_specific_safety_reported", "not_reported", "not_reported")] + _fill_required("A1", exclude=["sex_specific_safety_reported"]),
          findings=[class_f])
    saf = clinical.safety_state("MedA")
    assert saf["state"] != clinical.SAF_SIGNIFICANT
    assert saf["significant_findings"] == []
    assert len(saf["class_context_findings"]) == 1


# 15. Real-corpus parity + frozen preservation
def test_real_corpus_parity_and_frozen():
    api = engine.check_evidence(condition="Cardiovascular disease prevention", medicine="Rosuvastatin")
    jup = next(r for r in api["trials"] if r["trial_id"] == "JUPITER")
    csv_row = next(r for r in csv.DictReader(io.StringIO(exports.trials_csv())) if r["trial_id"] == "JUPITER")
    assert jup["total_enrollment"] == 17802 == int(csv_row["total_enrollment"])
    assert api["totals"]["participants_total"] == 30507
    assert api["totals"]["women_pct_of_participants"] == 41.4
    assert maturity.evaluate([t["trial_id"] for t in dataset.trials() if t["medicine"] == "Dapagliflozin"])["display"] == "2 / 5"
