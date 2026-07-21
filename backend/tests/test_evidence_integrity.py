"""System-wide fail-closed evidence-integrity adversarial tests.

Invariant under test: no public evidence value or derived conclusion may be
stronger than the verified evidence supporting it. Missing stays missing,
not_located stays not_located, unverified never becomes verified, class evidence
never becomes a drug-specific finding, partial ingestion never becomes a normal
score/ranking.
"""

import pytest

from amira import dataset, maturity, clinical, exports, engine


def S(sid, url="https://clinicaltrials.gov/study/NCT00000001"):
    return {"source_id": sid, "url": url, "source_type": "trial_registry_record",
            "title": "src", "publisher": "X", "year": 2020}


def A(aid, tid, dim, value, basis, sid="SRC-1", verified=True):
    return {"assertion_id": aid, "trial_id": tid, "dimension": dim, "value": value,
            "value_basis": basis, "source_id": sid, "exact_passage": "p",
            "source_verified": verified, "human_verified": False, "verifier": None}


def T(tid, medicine="TestMed", primary="SRC-1"):
    return {"trial_id": tid, "nct_id": "NCT00000001", "display_name": tid, "medicine": medicine,
            "drug_class": "TestClass", "condition": "Test condition", "study_phase": "Phase 3",
            "study_type": "Randomized Controlled Trial", "enrollment_actual": 500,
            "minimum_age": "18 Years", "sex_eligibility": "ALL", "start_date": "2019-01",
            "completion_date": "2021-01", "registry_url": "https://clinicaltrials.gov/study/NCT00000001",
            "has_registry_results": True, "primary_source_id": primary}


@pytest.fixture
def patch(monkeypatch):
    def _apply(trials, assertions, findings=None, sources=None):
        monkeypatch.setattr(dataset, "trials", lambda: trials)
        monkeypatch.setattr(dataset, "assertions", lambda: assertions)
        monkeypatch.setattr(dataset, "findings", lambda: findings if findings is not None else [])
        monkeypatch.setattr(dataset, "sources", lambda: sources if sources is not None else [S("SRC-1")])
    return _apply


# --- required assertions (missing = violation even when serialized blank) --- #
def test_missing_assertion_is_a_violation_even_when_export_blank(patch):
    patch([T("GHOST-001")], [])  # trial exists, zero assertions
    v = exports.required_assertion_violations()
    assert any(x["trial_id"] == "GHOST-001" and x["dimension"] == "total_enrollment" for x in v)
    # and the export is genuinely blank (not a leaked enrollment_actual)
    row = next(r for r in exports.trial_rows() if r["trial_id"] == "GHOST-001")
    assert row["total_enrollment"] == "" and row["total_enrollment_basis"] == "absent"


# --- source integrity --- #
def test_missing_source_id_flagged(patch):
    patch([T("T1")], [A("a1", "T1", "total_enrollment", 500, "reported", sid="")])
    assert any("missing source_id" in x["reason"] for x in exports.source_integrity_violations())


def test_dangling_source_id_flagged(patch):
    patch([T("T1")], [A("a1", "T1", "total_enrollment", 500, "reported", sid="DANGLING")],
          sources=[S("SRC-1")])
    assert any("dangling" in x["reason"] for x in exports.source_integrity_violations())


def test_source_without_valid_url_flagged(patch):
    patch([T("T1")], [A("a1", "T1", "total_enrollment", 500, "reported", sid="SRC-BAD")],
          sources=[S("SRC-BAD", url="ftp://nope")])
    assert any("https" in x["reason"] for x in exports.source_integrity_violations())


def test_unverified_positive_assertion_flagged(patch):
    patch([T("T1")], [A("a1", "T1", "total_enrollment", 500, "reported", verified=False)])
    assert any("not source_verified" in x["reason"] for x in exports.source_integrity_violations())


def test_missing_primary_source_flagged(patch):
    patch([T("T1", primary="GONE")], [A("a1", "T1", "total_enrollment", 500, "reported")],
          sources=[S("SRC-1")])
    assert any(x.get("dimension") == "primary_source_id" for x in exports.source_integrity_violations())


# --- exported value must equal assertion value --- #
def test_exported_value_must_equal_assertion(monkeypatch):
    monkeypatch.setattr(exports, "trial_rows",
                        lambda: [{"trial_id": "JUPITER", "total_enrollment": 123, "female_n": "", "female_pct": ""}])
    v = exports.value_equality_violations()
    assert any(x["trial_id"] == "JUPITER" and x["dimension"] == "total_enrollment" for x in v)


# --- duplicate / conflicting assertions --- #
def test_conflicting_assertions_flagged(patch):
    patch([T("T1")], [A("a1", "T1", "total_enrollment", 500, "reported"),
                      A("a2", "T1", "total_enrollment", 999, "reported")])
    v = exports.duplicate_or_conflicting_assertions()
    assert any(x["trial_id"] == "T1" and "conflicting" in x["reason"] for x in v)


def test_duplicate_assertions_flagged(patch):
    patch([T("T1")], [A("a1", "T1", "total_enrollment", 500, "reported"),
                      A("a2", "T1", "total_enrollment", 500, "reported")])
    v = exports.duplicate_or_conflicting_assertions()
    assert any(x["trial_id"] == "T1" and "duplicate" in x["reason"] for x in v)


# --- aggregation cannot exceed 100% across mismatched populations --- #
def test_missing_total_with_reported_female_yields_null_percentage(patch):
    # A: total 100 + 110 women (impossible but adversarial); B: no total, 50 women.
    patch([T("A"), T("B")], [
        A("a1", "A", "total_enrollment", 100, "reported"),
        A("a2", "A", "female_enrollment_count", 110, "reported"),
        A("a3", "B", "female_enrollment_count", 50, "reported"),
        # B has NO total_enrollment assertion (absent)
    ])
    agg = engine.aggregate_participants(["A", "B"])
    assert agg["women_pct_of_participants"] is None          # cannot compute across mismatch
    assert agg["participant_total_coverage"] == "incomplete"
    assert "B" in agg["trials_without_reported_total_enrollment"]


def test_no_derived_female_when_total_unsupported(patch):
    # female pct reported but total NOT reported -> no derived count, trial has no usable women data
    patch([T("A")], [A("a1", "A", "female_enrollment_pct", 40.0, "reported")])
    agg = engine.aggregate_participants(["A"])
    assert agg["women_estimated_total"] == 0
    assert "A" in agg["trials_without_female_count_or_percentage"]


# --- evidence states preserved (absent / not_located / not_reported) --------- #
def test_states_preserved_in_export(patch):
    patch([T("A")], [
        A("a1", "A", "sex_specific_efficacy_reported", "not_located", "not_located"),
        A("a2", "A", "menopause_status_reported", "not_reported", "not_reported"),
        # hormone_therapy assertion absent entirely
    ])
    row = next(r for r in exports.trial_rows() if r["trial_id"] == "A")
    assert row["sex_specific_efficacy_reported"] == "not_located"
    assert row["menopause_status_reported"] == "not_reported"
    assert row["hormone_therapy_reported"] == "absent"   # never downgraded to "not_reported"


# --- maturity fails closed --- #
def test_no_assertions_makes_maturity_unscored(patch):
    patch([T("A")], [])
    m = maturity.evaluate(["A"])
    assert m["scorable"] is False and m["status"] == "not_established"
    assert m["display"] == "Not yet established"


def test_not_located_affirmative_does_not_advance_maturity(patch):
    patch([T("A")], [
        A("a1", "A", "female_enrollment_count", 100, "reported"),           # level 1 ok
        A("a2", "A", "sex_specific_efficacy_reported", "yes", "not_located"),  # yes but not_located
    ])
    m = maturity.evaluate(["A"])
    assert m["level"] == 1  # level 2 must NOT be reached from a not_located "yes"


def test_unverified_assertion_does_not_advance_maturity(patch):
    patch([T("A")], [
        A("a1", "A", "female_enrollment_count", 100, "reported"),
        A("a2", "A", "sex_specific_efficacy_reported", "yes", "reported", verified=False),
    ])
    m = maturity.evaluate(["A"])
    assert m["level"] == 1  # unverified "yes" cannot advance to level 2


# --- class comparison fails closed --- #
def test_partial_medicine_excluded_from_ranking(patch):
    # MedA fully scorable; MedB has no assertions (unscored) -> no ranking (need >=2 scorable)
    patch([T("TA", medicine="MedA"), T("TB", medicine="MedB")], [
        A("a1", "TA", "female_enrollment_count", 100, "reported"),
        A("a2", "TA", "sex_specific_efficacy_reported", "yes", "reported"),
        # MedB: nothing
    ])
    comp = clinical.class_comparison("TestClass")
    assert comp["ranking"]["rankable"] is False
    medb = next(r for r in comp["rows"] if r["medicine"] == "MedB")
    assert medb["maturity_scorable"] is False
    assert medb["maturity_display"] != "0 / 5"   # unscored, never 0/5


# --- class-level safety finding cannot set a drug-specific state --- #
def test_class_level_safety_finding_does_not_set_drug_specific_state(patch):
    class_finding = {"finding_id": "F-CLASS", "medicine": "MedA", "finding_type": "safety",
                     "scope": "class:TestClass", "significance": "significant", "endpoint": "AE",
                     "source_id": "SRC-1", "exact_passage": "p", "source_verified": True,
                     "comparison_p": "0.01", "comparison_test": "test"}
    patch([T("TA", medicine="MedA")], [
        A("a1", "TA", "sex_specific_safety_reported", "not_reported", "not_reported"),
    ], findings=[class_finding])
    saf = clinical.safety_state("MedA")
    assert saf["state"] != clinical.SAF_SIGNIFICANT   # class evidence must not drive it


# --- frozen corpus stays clean on the full integrity report ------------------ #
def test_frozen_corpus_passes_full_integrity_report():
    report = exports.evidence_integrity_report()
    assert all(v == [] for v in report.values()), report
