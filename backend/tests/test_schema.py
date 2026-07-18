"""Schema validation tests — the schema must fail closed on bad input."""

import pytest
from pydantic import ValidationError

from amira.schema import (
    DataProvenance,
    EvidenceReport,
    EvidenceState,
    EvidenceSummary,
    EvidenceTier,
    ReportedStatus,
    Source,
    SourceType,
    export_json_schema,
)


def _valid_source(**overrides):
    base = dict(
        source_id="NCT00000001",
        source_title="A trial",
        source_type=SourceType.CLINICAL_TRIAL,
        relevant_passage="Of 1000 participants, 480 (48%) were women.",
        total_n=1000,
        female_n=480,
        female_pct=48.0,
    )
    base.update(overrides)
    return Source(**base)


def test_valid_source_ok():
    s = _valid_source()
    assert s.female_n == 480
    assert s.provenance == DataProvenance.AI_EXTRACTED


def test_female_n_cannot_exceed_total_n():
    with pytest.raises(ValidationError):
        _valid_source(total_n=100, female_n=200)


def test_female_pct_bounds():
    with pytest.raises(ValidationError):
        _valid_source(female_pct=150.0)
    with pytest.raises(ValidationError):
        _valid_source(female_pct=-1.0)


def test_negative_counts_rejected():
    with pytest.raises(ValidationError):
        _valid_source(total_n=-5)


def test_source_without_passage_or_location_fails_closed():
    with pytest.raises(ValidationError):
        _valid_source(relevant_passage="   ", source_location=None)


def test_source_with_location_but_no_passage_ok():
    s = _valid_source(relevant_passage="", source_location="Table 2, p.7")
    assert s.source_location == "Table 2, p.7"


def test_reported_status_enum_rejects_freeform():
    with pytest.raises(ValidationError):
        EvidenceSummary(sex_stratified_efficacy_reported="probably")


def test_unknown_is_default_not_notreported():
    s = EvidenceSummary()
    assert s.sex_stratified_efficacy_reported == ReportedStatus.UNKNOWN
    assert s.menopausal_status_reported == ReportedStatus.UNKNOWN


def test_extra_fields_forbidden():
    with pytest.raises(ValidationError):
        EvidenceReport(medicine="x", condition="y", surprise="field")


def test_no_evidence_state_must_not_carry_tier():
    with pytest.raises(ValidationError):
        EvidenceReport(
            medicine="x",
            condition="y",
            evidence_state=EvidenceState.NO_EVIDENCE_FOUND,
            evidence_tier=EvidenceTier.T3,
        )


def test_no_effect_state_must_not_carry_tier():
    with pytest.raises(ValidationError):
        EvidenceReport(
            medicine="x",
            condition="y",
            evidence_state=EvidenceState.EVIDENCE_OF_NO_EFFECT,
            evidence_tier=EvidenceTier.T1,
        )


def test_json_schema_exports():
    schema = export_json_schema()
    assert schema["title"] == "EvidenceReport"
    assert "evidence_summary" in schema["properties"]
