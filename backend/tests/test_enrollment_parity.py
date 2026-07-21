"""Evidence-boundary parity for total_enrollment across API, CSV and JSONL.

Core invariant (fail-closed): AMIRA does not export or aggregate an evidence-backed
enrollment value unless a corresponding sourced assertion is present. When the
`total_enrollment` assertion is absent, the raw trials.json `enrollment_actual`
MUST NOT leak into the evidence-backed `total_enrollment` export field.
"""

import csv
import io
import json

import pytest

from amira import dataset, engine, exports

# A trial that exists with raw enrollment_actual but whose total_enrollment
# evidence assertion is intentionally absent.
GHOST = {
    "trial_id": "GHOST-001", "nct_id": "NCT09999999", "display_name": "Ghost partial-ingest trial",
    "medicine": "Rosuvastatin", "drug_class": "Statin", "condition": "Cardiovascular disease prevention",
    "study_phase": "Phase 3", "study_type": "Randomized Controlled Trial",
    "enrollment_actual": 999, "minimum_age": "50 Years", "sex_eligibility": "ALL",
    "start_date": "2020-01", "completion_date": "2023-01",
    "registry_url": "https://clinicaltrials.gov/study/NCT09999999", "has_registry_results": False,
}


@pytest.fixture
def ghost_only(monkeypatch):
    """One trial, zero assertions — the missing-assertion path."""
    monkeypatch.setattr(dataset, "trials", lambda: [GHOST])
    monkeypatch.setattr(dataset, "assertions", lambda: [])
    return GHOST


# --- the adversarial missing-assertion export path -------------------------- #
def test_absent_total_assertion_yields_blank_export_not_enrollment_actual(ghost_only):
    row = next(r for r in exports.trial_rows() if r["trial_id"] == "GHOST-001")
    assert row["total_enrollment"] == "", "enrollment_actual must not leak as total_enrollment"
    assert row["total_enrollment_basis"] == "absent"
    assert row["total_enrollment"] != 999


def test_csv_total_enrollment_blank_when_assertion_absent(ghost_only):
    reader = csv.DictReader(io.StringIO(exports.trials_csv()))
    row = next(r for r in reader if r["trial_id"] == "GHOST-001")
    assert row["total_enrollment"] == ""              # blank cell
    assert row["total_enrollment_basis"] == "absent"  # missing basis surfaced
    assert "999" not in row["total_enrollment"]


def test_jsonl_matches_the_same_evidence_boundary(ghost_only):
    objs = [json.loads(l) for l in exports.trials_jsonl().splitlines() if l.strip()]
    row = next(o for o in objs if o["trial_id"] == "GHOST-001")
    assert row["total_enrollment"] == ""
    assert row["total_enrollment_basis"] == "absent"


def test_aggregate_excludes_unsupported_trial_and_marks_incomplete(ghost_only):
    agg = engine.aggregate_participants(["GHOST-001"])
    assert agg["participants_total"] == 0                      # unsupported total excluded
    assert agg["participants_basis"] == "incomplete"
    assert agg["participant_total_coverage"] == "incomplete"
    assert agg["trials_without_reported_total_enrollment"] == ["GHOST-001"]
    assert agg["trials_with_reported_total_enrollment"] == []


def test_no_surface_exposes_enrollment_actual_as_total(ghost_only):
    row = next(r for r in exports.trial_rows() if r["trial_id"] == "GHOST-001")
    csv_row = next(r for r in csv.DictReader(io.StringIO(exports.trials_csv())) if r["trial_id"] == "GHOST-001")
    jsonl_row = next(json.loads(l) for l in exports.trials_jsonl().splitlines()
                     if l.strip() and json.loads(l)["trial_id"] == "GHOST-001")
    for surface in (row["total_enrollment"], csv_row["total_enrollment"], jsonl_row["total_enrollment"]):
        assert surface in ("", None)


# --- validator identifies the affected trial + dimension -------------------- #
def test_validator_flags_a_leaked_total_with_trial_and_dimension(ghost_only):
    # Simulate the OLD buggy behaviour: a non-empty total exported with no assertion.
    leaked = [{"trial_id": "GHOST-001", "total_enrollment": 999, "female_n": "", "female_pct": ""}]
    violations = exports.evidence_backed_export_violations(leaked)
    assert any(v["trial_id"] == "GHOST-001" and v["dimension"] == "total_enrollment" for v in violations)


# --- frozen-corpus regression: nothing changes ------------------------------ #
def test_frozen_corpus_totals_unchanged():
    """Every fully evidenced trial still exports its reported total (== enrollment_actual)."""
    for r in exports.trial_rows():
        tid = r["trial_id"]
        _, t_basis, a = dataset.assertion_value(tid, "total_enrollment")
        if t_basis == "reported":
            assert r["total_enrollment"] == a["value"]
            trial = next(t for t in dataset.trials() if t["trial_id"] == tid)
            assert r["total_enrollment"] == trial["enrollment_actual"]  # unchanged numeric
        else:
            assert r["total_enrollment"] == ""


def test_frozen_corpus_has_no_export_violations():
    assert exports.evidence_backed_export_violations() == []


def test_dapahf_and_jupiter_totals_still_correct():
    rows = {r["trial_id"]: r for r in exports.trial_rows()}
    assert rows["DAPA-HF"]["total_enrollment"] == 4744
    assert rows["JUPITER"]["total_enrollment"] == 17802
    assert rows["JUPITER"]["female_n"] == 6801


def test_frozen_participant_coverage_complete():
    ids = [t["trial_id"] for t in dataset.trials() if t["medicine"] == "Rosuvastatin"]
    agg = engine.aggregate_participants(ids)
    assert agg["participant_total_coverage"] == "complete"
    assert agg["participants_total"] == 30507  # 17802 + 12705, unchanged
