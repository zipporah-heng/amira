"""Tests for AMIRA-Extract: strict schema, exact-quote verification, and the
anti-inference guards."""

import copy

import pytest

from amira import extract


@pytest.fixture(scope="module")
def digoxin():
    p = next(x for x in extract.approved_passages() if x["passage_id"] == "F-EFF-DIG-001")
    return extract.extract_and_validate(p["passage"], p)


def test_recorded_extraction_conforms_to_schema(digoxin):
    assert extract._schema_errors(digoxin) == []
    assert digoxin["schema_version"] == "0.2"
    assert digoxin["prompt_version"] == extract.PROMPT_VERSION


def test_recorded_extraction_is_quote_verified(digoxin):
    assert digoxin["validation_state"] == "quote_verified"
    assert digoxin["women_count"] == 284
    assert digoxin["interaction_statistic"] and "0.014" in digoxin["interaction_statistic"]


def test_all_recorded_extractions_verify():
    for p in extract.approved_passages():
        obj = extract.extract_and_validate(p["passage"], p)
        assert obj["validation_state"] == "quote_verified", p["passage_id"]


def test_unsupported_quote_is_quarantined(digoxin):
    bad = copy.deepcopy(digoxin)
    bad["exact_evidence_passage"] = "Digoxin was proven to cure every woman in the study."
    state, notes = extract.validate(bad)
    assert state == "quarantined"
    assert "verbatim" in notes[0]


def test_missing_field_fails_schema(digoxin):
    bad = copy.deepcopy(digoxin)
    del bad["evidence_state"]
    state, notes = extract.validate(bad)
    assert state == "quarantined"
    assert any("schema" in n for n in notes)


def test_no_menopause_from_age_guard(digoxin):
    # JUPITER enrolled women >=60 but never reports menopausal status; claiming
    # 'reported' from that source must quarantine.
    jup = next(x for x in extract.approved_passages() if x["medicine"] == "Rosuvastatin")
    obj = extract.extract_and_validate(jup["passage"], jup)
    forced = copy.deepcopy(obj)
    forced["menopause"] = "reported"
    state, notes = extract.validate(forced)
    assert state == "quarantined"
    assert "age" in notes[0].lower() and "menopaus" in notes[0].lower()


def test_no_sex_comparison_without_statistic(digoxin):
    bad = copy.deepcopy(digoxin)
    bad["formal_sex_comparison"] = "reported"
    bad["interaction_statistic"] = None
    state, notes = extract.validate(bad)
    assert state == "quarantined"
    assert "interaction_statistic" in notes[0] or "comparison" in notes[0].lower()


def test_women_only_study_marks_comparison_not_applicable():
    hay = next(x for x in extract.approved_passages() if x["medicine"] == "Valsartan")
    obj = extract.extract_and_validate(hay["passage"], hay)
    assert obj["formal_sex_comparison"] == "not_applicable"


def test_human_verified_requires_named_reviewer(digoxin):
    bad = copy.deepcopy(digoxin)
    bad["human_review_state"] = "human_verified"
    bad["human_reviewer"] = None
    assert extract._schema_errors(bad), "human_verified without a reviewer must fail the schema"


def test_default_provider_is_recorded_and_needs_no_key():
    cfg = extract.provider_config()
    assert cfg["provider"] == "recorded"
    # The recorded provider never requires an API key.
    assert extract.extract("", {"medicine": "Digoxin", "source_identifier": "SRC-PMID-12409542"})
