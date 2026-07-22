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


# =========================================================================== #
# Final closeout pass: the exact reproduced bypasses A–G + dangling-derived crash
# =========================================================================== #

# A. Unverified female count (777) is never trusted on ANY public surface.
def test_A_unverified_female_count_suppressed_everywhere(patch):
    patch([T("TX")], [A("fc", "TX", "female_enrollment_count", 777, "reported", verified=False)]
          + _fill_required("TX", exclude=["female_enrollment_count"]))
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")
    ws = next(w for w in api["who_was_studied"] if w["trial_id"] == "TX")
    assert ws["female_n"] is None and ws["female_n_state"] == "unverified"
    row = next(r for r in api["trials"] if r["trial_id"] == "TX")
    assert row["female_n"] is None and row["female_n_basis"] == "unverified"
    csv_row = next(r for r in csv.DictReader(io.StringIO(exports.trials_csv())) if r["trial_id"] == "TX")
    jrow = next(json.loads(l) for l in exports.trials_jsonl().splitlines()
                if l.strip() and json.loads(l)["trial_id"] == "TX")
    assert csv_row["female_n"] == "" and jrow["female_n"] == ""
    # Source Drawer: the 777 assertion is visible but explicitly NOT trusted.
    av = next(a for a in row["assertions"] if a["dimension"] == "female_enrollment_count")
    assert av["trusted"] is False and av["trusted_value"] is None and av["value"] == 777


# A. Conflicting female counts (500/999): the first value never wins.
def test_A_conflicting_female_count_no_first_value(patch):
    patch([T("TX")], [
        A("c1", "TX", "female_enrollment_count", 500, "reported"),
        A("c2", "TX", "female_enrollment_count", 999, "reported"),
    ] + _fill_required("TX", exclude=["female_enrollment_count"]))
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")
    ws = next(w for w in api["who_was_studied"] if w["trial_id"] == "TX")
    assert ws["female_n"] is None and ws["female_n_state"] == "conflict"
    row = next(r for r in api["trials"] if r["trial_id"] == "TX")
    fcs = [a for a in row["assertions"] if a["dimension"] == "female_enrollment_count"]
    assert fcs and all(a["trusted"] is False and a["trusted_value"] is None for a in fcs)
    assert 500 not in (ws["female_n"], row["female_n"])


# A. Invalid derived female percentage (60) never trusted in who_was_studied.
def test_A_invalid_derived_pct_suppressed(patch):
    patch([T("TX")], [
        A("dep", "TX", "female_enrollment_count", None, "not_reported"),
        A("der", "TX", "female_enrollment_pct", 60.0, "derived",
          extra={"derived_from": ["dep"], "derivation_rule": "x", "derivation_version": "1.0"}),
    ] + _fill_required("TX", exclude=["female_enrollment_count"]))
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")
    ws = next(w for w in api["who_was_studied"] if w["trial_id"] == "TX")
    assert ws["female_pct"] is None


# B. An unverified categorical "yes" changes no public conclusion or copy.
def test_B_unverified_categorical_yes_changes_nothing(patch):
    patch([T("TX")], [A("m", "TX", "menopause_status_reported", "yes", "reported", verified=False)]
          + _fill_required("TX", exclude=["menopause_status_reported"]))
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")
    dim = next(d for d in api["dimensions"] if d["dimension"] == "menopause_status_reported")
    assert dim["n_reporting"] == 0
    assert api["life_stage_context"]["trials_reporting_menopausal_status"] == []
    gap = next(g for g in api["evidence_gaps"] if g["dimension"] == "menopause_status_reported")
    assert gap["n_reporting"] == 0
    row = next(r for r in api["trials"] if r["trial_id"] == "TX")
    assert row["menopause_status_reported"] == "unverified"   # never rendered as reported


# B. A "yes" with a dangling source never counts as affirmative.
def test_B_dangling_source_yes_not_affirmative(patch):
    patch([T("TX")], [A("h", "TX", "hormone_therapy_reported", "yes", "reported", sid="GONE")]
          + _fill_required("TX", exclude=["hormone_therapy_reported"]), sources=[S("SRC-OK")])
    assert dataset.affirmative_verified("TX", "hormone_therapy_reported") is False
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")
    assert api["hormone_therapy_context"]["trials_reporting_hormone_therapy"] == []


# C. An unverified trial finding alters no state and enters no public section.
def test_C_unverified_trial_finding_fully_excluded(patch):
    f = {"finding_id": "F1", "medicine": "TestMed", "finding_type": "safety", "scope": "trial:TX",
         "significance": "significant", "endpoint": "AE", "source_id": "SRC-OK", "exact_passage": "p",
         "source_verified": False, "comparison_p": "0.01", "comparison_test": "t",
         "population_scope": "women_and_men"}
    patch([T("TX")], _fill_required("TX"), findings=[f])
    saf = clinical.safety_state("TestMed")
    assert saf["state"] != clinical.SAF_SIGNIFICANT and saf["significant_findings"] == []
    assert all(r["finding_id"] != "F1" for r in exports.finding_rows())


# C. An unverified class-level finding is never shown as class context.
def test_C_unverified_class_finding_not_context(patch):
    cf = {"finding_id": "FC", "medicine": "TestMed", "finding_type": "safety", "scope": "class:TestClass",
          "significance": "significant", "endpoint": "AE", "source_id": "SRC-OK", "exact_passage": "p",
          "source_verified": False, "comparison_p": "0.01", "comparison_test": "t"}
    patch([T("TX")], _fill_required("TX"), findings=[cf])
    assert clinical.safety_state("TestMed")["class_context_findings"] == []
    assert clinical.class_comparison("TestClass")["class_level_findings"] == []


# D. An unsupported basis contributes no readiness/maturity/export value.
def test_D_unsupported_basis_no_score_anywhere(patch, monkeypatch):
    monkeypatch.setenv("AMIRA_ENABLE_PILOT_SCORE", "1")
    patch([T("TX")], [A("fc", "TX", "female_enrollment_count", 123, "unsupported")]
          + _fill_required("TX", exclude=["female_enrollment_count"]))
    assert dataset.assertion_validity("TX", "female_enrollment_count", require_numeric=True)["valid"] is False
    m = maturity.evaluate(["TX"])
    assert m["level"] == 0 and m["scorable"] is False
    r = readiness.evaluate("TestMed")
    assert next(d for d in r["dimensions"] if d["key"] == "included")["points"] == 0
    row = next(r2 for r2 in exports.trial_rows() if r2["trial_id"] == "TX")
    assert row["female_n"] == "" and row["female_n_basis"] == "invalid"


# F. A partial medicine is never listed as verified (class comparison + catalog).
def test_F_partial_medicine_not_verified(patch):
    patch([T("A1", medicine="MedA"), T("C1", medicine="MedC", cls="TestClass")], [
        *[A(f"a{i}", "A1", d, "not_reported", "not_reported") for i, d in enumerate(REQUIRED_MIN)],
        A("a-fc", "A1", "female_enrollment_count", 100, "reported"),
        A("c-fc", "C1", "female_enrollment_count", 50, "reported"),   # scores but incomplete ingestion
    ])
    cc = clinical.class_comparison("TestClass")
    assert "MedC" not in cc["verified_medicines"]
    assert "MedC" in {m["medicine"] for m in cc["incomplete_medicines"]}


# G. The deploy validator rejects an unverified finding AND an unverified comparison.
def test_G_source_integrity_flags_unverified_finding_and_comparison(patch):
    f = {"finding_id": "F1", "source_id": "SRC-OK", "source_verified": False,
         "scope": "trial:TX", "exact_passage": "p"}
    c = {"comparison_id": "C1", "trial_id": "TX", "source_id": "SRC-OK", "source_verified": False,
         "exact_passage": "p", "outcomes": [{"exact_passage": "p"}]}
    patch([T("TX")], _fill_required("TX"), findings=[f], comparisons=[c])
    viol = exports.source_integrity_violations()
    assert any(v.get("finding_id") == "F1" for v in viol)
    assert any(v.get("comparison_id") == "C1" for v in viol)


# Special. A dangling derived dependency must NOT crash a public endpoint.
def test_special_dangling_derived_dependency_no_crash(patch):
    patch([T("TX")], [
        A("dep", "TX", "female_enrollment_count", 100, "reported", sid="DANGLING"),
        A("der", "TX", "female_enrollment_pct", 50.0, "derived",
          extra={"derived_from": ["dep"], "derivation_rule": "x", "derivation_version": "1.0"}),
    ] + _fill_required("TX", exclude=["female_enrollment_count"]), sources=[S("SRC-OK")])
    api = engine.check_evidence(condition="Test condition", medicine="TestMed")  # must not raise
    assert api["supported"] is True
    ws = next(w for w in api["who_was_studied"] if w["trial_id"] == "TX")
    assert ws["female_pct"] is None                 # invalid dependency -> withheld
    assert api["maturity"]["level"] == 0            # no maturity advancement on invalid evidence


# 15. Real-corpus parity + frozen preservation
def test_real_corpus_parity_and_frozen():
    api = engine.check_evidence(condition="Cardiovascular disease prevention", medicine="Rosuvastatin")
    jup = next(r for r in api["trials"] if r["trial_id"] == "JUPITER")
    csv_row = next(r for r in csv.DictReader(io.StringIO(exports.trials_csv())) if r["trial_id"] == "JUPITER")
    assert jup["total_enrollment"] == 17802 == int(csv_row["total_enrollment"])
    assert api["totals"]["participants_total"] == 30507
    assert api["totals"]["women_pct_of_participants"] == 41.4
    assert maturity.evaluate([t["trial_id"] for t in dataset.trials() if t["medicine"] == "Dapagliflozin"])["display"] == "2 / 5"
