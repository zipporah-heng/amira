"""Extraction pipeline: abstention, citation validation, fail-closed behavior."""

import pytest

from amira.extraction import ExtractionError, extract_from_passage
from amira.extraction.extractor import _validate_raw
from amira.schema import ReportedStatus

CTT_PASSAGE = (
    "46,675 (27%) of 174,149 participants were women. Proportional reductions per "
    "1.0 mmol/L LDL reduction in major vascular events were similar in women "
    "(RR 0.84) and men (RR 0.78), with no significant heterogeneity by sex."
)

LABEL_PASSAGE = (
    "Atorvastatin is contraindicated in pregnancy. The label does not report "
    "efficacy or safety outcomes stratified by menopausal status."
)


def test_supported_claims_extracted_with_citation():
    res = extract_from_passage(
        CTT_PASSAGE, "CTT meta-analysis",
        backend="recorded", recorded_key="ctt_sex_meta",
    )
    eff = res.fields["sex_stratified_efficacy_reported"]
    assert eff.value == "yes"
    assert eff.citation_verified is True
    assert res.fields["female_n"].value == 46675


def test_silence_produces_abstention_not_inference():
    res = extract_from_passage(
        LABEL_PASSAGE, "Atorvastatin label",
        backend="recorded", recorded_key="silent_label",
    )
    # Silent on efficacy -> must abstain, never infer.
    assert res.fields["sex_stratified_efficacy_reported"].value == "not_reported"
    assert "sex_stratified_efficacy_reported" in res.abstained_fields
    # Pregnancy explicitly stated -> supported.
    assert res.fields["pregnancy_excluded"].value == "yes"


def test_uncited_affirmative_claim_is_downgraded_to_abstention():
    # The recorded output claims efficacy "yes" but its citation is NOT in the
    # passage. The pipeline must fail closed and downgrade it to not_reported.
    res = extract_from_passage(
        CTT_PASSAGE, "Some source",
        backend="recorded", recorded_key="uncited_claim",
    )
    eff = res.fields["sex_stratified_efficacy_reported"]
    assert eff.value == "not_reported"
    assert eff.citation_verified is False


def test_summary_kwargs_map_to_enums():
    res = extract_from_passage(
        CTT_PASSAGE, "CTT", backend="recorded", recorded_key="ctt_sex_meta",
    )
    kwargs = res.as_summary_kwargs()
    assert kwargs["sex_stratified_efficacy_reported"] == ReportedStatus.YES
    assert kwargs["total_n"] == 174149


def test_malformed_output_fails_closed():
    with pytest.raises(ExtractionError):
        _validate_raw({"sex_stratified_efficacy_reported": "yes"})  # not an object


def test_invalid_enum_fails_closed():
    with pytest.raises(ExtractionError):
        _validate_raw({
            "sex_stratified_efficacy_reported": {"value": "definitely", "citation": None}
        })


def test_missing_field_treated_as_abstention():
    cleaned = _validate_raw({})  # empty -> all abstain, no crash
    assert cleaned["menopausal_status_reported"]["value"] == "not_reported"


def test_recorded_backend_requires_key():
    with pytest.raises(ExtractionError):
        extract_from_passage("x", "y", backend="recorded", recorded_key=None)
