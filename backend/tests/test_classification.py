"""Classification + safety-state tests."""

from amira.classification import (
    build_report,
    classify,
    compute_missing_fields,
    load_config,
)
from amira.schema import (
    Classification,
    EvidenceState,
    EvidenceSummary,
    EvidenceTier,
    HormonalContext,
    LifeStage,
    ReportedStatus,
    Source,
    SourceType,
)


def _src(source_type=SourceType.CLINICAL_TRIAL, sid="s1"):
    return Source(
        source_id=sid,
        source_title="t",
        source_type=source_type,
        relevant_passage="passage with numbers",
        total_n=1000,
        female_n=480,
        female_pct=48.0,
    )


def test_t1_strong():
    summary = EvidenceSummary(
        female_pct=48.0,
        sex_stratified_efficacy_reported=ReportedStatus.YES,
        sex_stratified_safety_reported=ReportedStatus.YES,
    )
    tier, cls = classify(summary, [_src(sid="a"), _src(sid="b")])
    assert tier == EvidenceTier.T1
    assert cls == Classification.STRONG


def test_t2_moderate_one_analysis_only():
    summary = EvidenceSummary(
        female_pct=48.0,
        sex_stratified_efficacy_reported=ReportedStatus.YES,
        sex_stratified_safety_reported=ReportedStatus.NOT_REPORTED,
    )
    tier, cls = classify(summary, [_src(sid="a"), _src(sid="b")])
    assert tier == EvidenceTier.T2
    assert cls == Classification.MODERATE


def test_t3_limited_underrepresented():
    summary = EvidenceSummary(
        female_pct=30.0,
        sex_stratified_efficacy_reported=ReportedStatus.NOT_REPORTED,
        sex_stratified_safety_reported=ReportedStatus.NOT_REPORTED,
    )
    tier, cls = classify(summary, [_src(sid="a")])
    assert tier == EvidenceTier.T3
    assert cls == Classification.LIMITED


def test_t4_insufficient_only_limited_sources():
    summary = EvidenceSummary(female_pct=48.0)
    tier, cls = classify(
        summary,
        [_src(source_type=SourceType.OBSERVATIONAL, sid="a"),
         _src(source_type=SourceType.DRUG_LABEL, sid="b")],
    )
    assert tier == EvidenceTier.T4
    assert cls == Classification.INSUFFICIENT


def test_t5_no_sources():
    tier, cls = classify(EvidenceSummary(), [])
    assert tier == EvidenceTier.T5
    assert cls == Classification.NO_RELEVANT_EVIDENCE_FOUND


def test_missing_fields_lists_gaps():
    summary = EvidenceSummary(
        female_pct=48.0,
        sex_stratified_efficacy_reported=ReportedStatus.YES,
        sex_stratified_safety_reported=ReportedStatus.NOT_REPORTED,
        menopausal_status_reported=ReportedStatus.NOT_REPORTED,
    )
    missing = compute_missing_fields(summary)
    assert "Sex-specific safety outcomes" in missing
    assert "Menopausal status" in missing
    assert "Sex-specific efficacy outcomes" not in missing


def test_config_is_editable_data():
    cfg = load_config()
    assert cfg["config_version"] == "1.0"
    assert cfg["female_representation"]["adequate_pct_threshold"] == 40.0


# --- Safety-state separation (the load-bearing distinction) --------------- #

def test_no_evidence_found_state():
    report = build_report(
        medicine="drug",
        condition="cvd",
        life_stage=LifeStage.POSTMENOPAUSE,
        hormonal_context=HormonalContext(),
        summary=EvidenceSummary(),
        sources=[],
        evidence_state=EvidenceState.NO_EVIDENCE_FOUND,
    )
    assert report.evidence_state == EvidenceState.NO_EVIDENCE_FOUND
    assert report.evidence_tier is None


def test_evidence_of_no_effect_state_is_distinct():
    report = build_report(
        medicine="drug",
        condition="cvd",
        life_stage=LifeStage.POSTMENOPAUSE,
        hormonal_context=HormonalContext(),
        summary=EvidenceSummary(
            female_pct=52.0,
            sex_stratified_efficacy_reported=ReportedStatus.YES,
        ),
        sources=[_src()],
        evidence_state=EvidenceState.EVIDENCE_OF_NO_EFFECT,
    )
    assert report.evidence_state == EvidenceState.EVIDENCE_OF_NO_EFFECT
    assert report.evidence_tier is None


def test_two_safety_states_never_equal():
    no_ev = build_report(
        medicine="d", condition="c", life_stage=LifeStage.NOT_SPECIFIED,
        hormonal_context=HormonalContext(), summary=EvidenceSummary(),
        sources=[], evidence_state=EvidenceState.NO_EVIDENCE_FOUND,
    )
    no_eff = build_report(
        medicine="d", condition="c", life_stage=LifeStage.NOT_SPECIFIED,
        hormonal_context=HormonalContext(),
        summary=EvidenceSummary(sex_stratified_efficacy_reported=ReportedStatus.YES),
        sources=[_src()], evidence_state=EvidenceState.EVIDENCE_OF_NO_EFFECT,
    )
    # Same "no benefit shown" surface meaning, but they are different states and
    # must be distinguishable programmatically.
    assert no_ev.evidence_state != no_eff.evidence_state


def test_has_evidence_gets_tier():
    report = build_report(
        medicine="d", condition="c", life_stage=LifeStage.PERIMENOPAUSE,
        hormonal_context=HormonalContext(),
        summary=EvidenceSummary(
            female_pct=48.0,
            sex_stratified_efficacy_reported=ReportedStatus.YES,
            sex_stratified_safety_reported=ReportedStatus.YES,
        ),
        sources=[_src(sid="a"), _src(sid="b")],
        evidence_state=EvidenceState.HAS_EVIDENCE,
    )
    assert report.evidence_tier == EvidenceTier.T1
    assert report.classification == Classification.STRONG
