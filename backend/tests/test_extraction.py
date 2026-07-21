"""Tests for AMIRA-Extract: passage-/source-local provenance, strict schema,
exact-quote verification, and the anti-inference guards."""

import copy
import json

import pytest

from amira import dataset, extract


def _passage(pid):
    return next(x for x in extract.approved_passages() if x["passage_id"] == pid)


@pytest.fixture(scope="module")
def dig():
    # A DIG passage (2002 sex-based analysis of the DIG trial).
    p = _passage("F-EFF-DIG-001")
    return extract.extract_and_validate(p["passage"], p)


@pytest.fixture(scope="module")
def decision():
    p = _passage("F-EFF-DEC-001")
    return extract.extract_and_validate(p["passage"], p)


# --- provenance / no cross-study leakage (Priority 1) ----------------------- #
def test_dig_extraction_does_not_borrow_decisions_284_women(dig):
    # DIG's own female count is not located in the reviewed abstract; the DECISION
    # trial reports 284 women. A DIG passage must NEVER carry DECISION's 284.
    assert dig["trial_id"] == "DIG"
    assert dig["women_count"] is None
    blob = json.dumps(dig)
    assert "284" not in blob, "DECISION's 284-woman count leaked into a DIG extraction"


def test_decision_extraction_reports_its_own_284(decision):
    assert decision["trial_id"] == "DECISION"
    assert decision["women_count"] == 284


def test_no_field_comes_from_another_trial():
    # Every field must be sourced from the extraction's own trial_id assertions.
    for p in extract.approved_passages():
        obj = extract.extract_and_validate(p["passage"], p)
        tid = obj["trial_id"]
        c_val, c_basis, _ = dataset.assertion_value(tid, "female_enrollment_count")
        expected = int(c_val) if c_basis == "reported" else None
        assert obj["women_count"] == expected, f"{p['passage_id']} women_count not local to {tid}"


def test_identifiers_stay_aligned():
    for p in extract.approved_passages():
        obj = extract.extract_and_validate(p["passage"], p)
        assert obj["passage_id"] == p["passage_id"]
        assert obj["source_identifier"] == p["source_identifier"]
        # The finding whose id is passage_id must belong to the extraction's trial.
        f = next((x for x in dataset.findings() if x["finding_id"] == obj["passage_id"]), None)
        assert f is not None
        assert f["scope"] == f"trial:{obj['trial_id']}"
        assert f["source_id"] == obj["source_identifier"]


def test_missing_values_remain_null_or_not_reported(dig):
    assert dig["women_count"] is None
    assert dig["women_percentage"] is None
    assert dig["menopause"] == "not_reported"       # DIG abstract is silent, not "no"
    assert dig["hormone_therapy"] == "not_located"   # not in the retrieved abstract


# --- schema + quote validation --------------------------------------------- #
def test_recorded_extraction_conforms_to_schema(dig):
    assert extract._schema_errors(dig) == []
    assert dig["schema_version"] == "0.2"
    assert dig["prompt_version"] == extract.PROMPT_VERSION


def test_recorded_extraction_is_quote_verified(dig):
    assert dig["validation_state"] == "quote_verified"
    assert dig["source_match_state"] == "stored_excerpt_matched"
    assert dig["interaction_statistic"] and "0.014" in dig["interaction_statistic"]


def test_passage_is_not_truncated_mid_word(dig):
    # The corrected DIG passage must begin at a word boundary, not mid-word.
    assert not dig["exact_evidence_passage"].startswith("antly")
    assert dig["exact_evidence_passage"][0].isalnum()


def test_provenance_records_stored_excerpt_basis(dig):
    prov = dig["provenance"]
    assert prov["match_basis"] == "stored_excerpt"
    assert prov["content_hash"].startswith("sha1:")
    assert prov["passage_index"] >= 0
    # Recorded provider makes no live model call.
    assert dig["live_model_call"] is False


def test_all_recorded_extractions_verify():
    for p in extract.approved_passages():
        obj = extract.extract_and_validate(p["passage"], p)
        assert obj["validation_state"] in ("quote_verified", "schema_valid"), p["passage_id"]


def test_unsupported_quote_is_quarantined(dig):
    bad = copy.deepcopy(dig)
    bad["exact_evidence_passage"] = "Digoxin was proven to cure every woman in the study."
    state, match_state, notes = extract.validate(bad)
    assert state == "quarantined" and match_state == "quarantined"


def test_missing_field_fails_schema(dig):
    bad = copy.deepcopy(dig)
    del bad["evidence_state"]
    state, _match, notes = extract.validate(bad)
    assert state == "quarantined"
    assert any("schema" in n for n in notes)


def test_no_menopause_from_age_guard():
    jup = _passage("F-EFF-JUP-001")  # Rosuvastatin, JUPITER (women >=60, no menopause report)
    obj = extract.extract_and_validate(jup["passage"], jup)
    forced = copy.deepcopy(obj)
    forced["menopause"] = "reported"
    state, _match, notes = extract.validate(forced)
    assert state == "quarantined"
    assert "age" in notes[0].lower() and "menopaus" in notes[0].lower()


def test_no_sex_comparison_without_statistic(dig):
    bad = copy.deepcopy(dig)
    bad["formal_sex_comparison"] = "reported"
    bad["interaction_statistic"] = None
    state, _match, notes = extract.validate(bad)
    assert state == "quarantined"


def test_women_only_study_marks_comparison_not_applicable():
    hay = _passage("F-EFF-HAY-001")  # Valsartan, women-only postmenopausal study
    obj = extract.extract_and_validate(hay["passage"], hay)
    assert obj["formal_sex_comparison"] == "not_applicable"


def test_human_verified_requires_named_reviewer(dig):
    bad = copy.deepcopy(dig)
    bad["human_review_state"] = "human_verified"
    bad["human_reviewer"] = None
    assert extract._schema_errors(bad), "human_verified without a reviewer must fail the schema"


# --- provider honesty ------------------------------------------------------- #
def test_default_provider_is_recorded_and_labelled_not_live():
    cfg = extract.provider_config()
    assert cfg["provider"] == "recorded"
    assert cfg["is_recorded"] is True
    assert cfg["provider_label"] == "Recorded corpus extraction"


def test_recorded_extraction_needs_no_key():
    obj = extract.extract("", {"medicine": "Digoxin", "trial_id": "DIG",
                               "source_identifier": "SRC-PMID-12409542", "passage_id": "F-EFF-DIG-001"})
    assert obj["live_model_call"] is False
