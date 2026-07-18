"""Evidence-completeness classification.

Rules live in config/classification_rules.json so Mantis/Bumble can tune tiers
without touching code. This module reads that config and applies transparent,
deterministic logic to an EvidenceSummary + its sources.

CRITICAL: this classifies EVIDENCE COMPLETENESS, never the medicine. It does not
say a drug is safe, effective, better, or worse.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional, Tuple

from .schema import (
    Classification,
    EvidenceReport,
    EvidenceState,
    EvidenceSummary,
    EvidenceTier,
    ReportedStatus,
    Source,
    SourceType,
)

_CONFIG_PATH = Path(__file__).parent / "config" / "classification_rules.json"

# The "reported" fields whose absence we surface as a coverage gap.
_REPORTED_FIELDS = [
    ("sex_stratified_efficacy_reported", "Sex-specific efficacy outcomes"),
    ("sex_stratified_safety_reported", "Sex-specific safety outcomes"),
    ("sex_by_treatment_interaction_tested", "Sex-by-treatment interaction"),
    ("menopausal_status_reported", "Menopausal status"),
    ("hormonal_factors_reported", "Hormonal factors"),
    ("hormone_therapy_reported", "Hormone therapy use"),
]


def load_config(path: Optional[Path] = None) -> dict:
    return json.loads((path or _CONFIG_PATH).read_text(encoding="utf-8"))


def _representation_level(female_pct: Optional[float], cfg: dict) -> str:
    rep = cfg["female_representation"]
    if female_pct is None:
        return "unknown"
    if female_pct >= rep["adequate_pct_threshold"]:
        return "adequate"
    if female_pct >= rep["underrepresented_pct_threshold"]:
        return "underrepresented"
    return "severely_underrepresented"


def _sources_are_only_limited(sources: List[Source], cfg: dict) -> bool:
    limited = set(cfg["limited_source_types"])
    typed = [s.source_type.value for s in sources]
    return len(typed) > 0 and all(t in limited for t in typed)


def _is_reported_yes(status: ReportedStatus) -> bool:
    return status == ReportedStatus.YES


def compute_missing_fields(summary: EvidenceSummary) -> List[str]:
    """Fields that were not affirmatively reported in the reviewed sources.

    Anything that is not an explicit "yes" is a coverage gap for the user.
    """

    missing: List[str] = []
    if summary.female_pct is None and summary.female_n is None:
        missing.append("Female enrollment counts")
    for attr, label in _REPORTED_FIELDS:
        if not _is_reported_yes(getattr(summary, attr)):
            missing.append(label)
    return missing


def classify(
    summary: EvidenceSummary,
    sources: List[Source],
    config: Optional[dict] = None,
) -> Tuple[Optional[EvidenceTier], Classification]:
    """Return (tier, classification) for a report that HAS relevant evidence.

    Callers must only invoke this for EvidenceState.HAS_EVIDENCE. No-evidence and
    no-effect states are decided upstream and never reach the tier ladder.
    """

    cfg = config or load_config()

    if not sources:
        return EvidenceTier.T5, Classification.NO_RELEVANT_EVIDENCE_FOUND

    rep = _representation_level(summary.female_pct, cfg)
    eff_yes = _is_reported_yes(summary.sex_stratified_efficacy_reported)
    saf_yes = _is_reported_yes(summary.sex_stratified_safety_reported)

    # Count "strong" (non-limited) sources for the T1 bar.
    limited_types = set(cfg["limited_source_types"])
    strong_sources = [s for s in sources if s.source_type.value not in limited_types]

    # T4: evidence exists but only through limited source types.
    if _sources_are_only_limited(sources, cfg):
        return EvidenceTier.T4, Classification.INSUFFICIENT

    t1 = cfg["tiers"][0]["requires"]
    if (
        len(strong_sources) >= t1["min_strong_sources"]
        and rep == "adequate"
        and eff_yes
        and saf_yes
    ):
        return EvidenceTier.T1, Classification.STRONG

    # T2: adequately represented + at least one sex-specific analysis reported.
    if rep == "adequate" and (eff_yes or saf_yes):
        return EvidenceTier.T2, Classification.MODERATE

    # T3: represented (at least underrepresented tier) but analysis limited.
    if rep in ("adequate", "underrepresented", "severely_underrepresented"):
        return EvidenceTier.T3, Classification.LIMITED

    # Represented status unknown but sources exist -> limited coverage.
    return EvidenceTier.T3, Classification.LIMITED


def build_report(
    *,
    medicine: str,
    condition: str,
    life_stage,
    hormonal_context,
    summary: EvidenceSummary,
    sources: List[Source],
    evidence_state: EvidenceState = EvidenceState.HAS_EVIDENCE,
    extraction_confidence: Optional[float] = None,
    human_verified: bool = False,
    config: Optional[dict] = None,
) -> EvidenceReport:
    """Assemble a validated EvidenceReport, routing safety states correctly.

    The three EvidenceStates take separate paths here — this is where the
    NO_EVIDENCE_FOUND vs EVIDENCE_OF_NO_EFFECT separation is enforced in code.
    """

    if evidence_state == EvidenceState.NO_EVIDENCE_FOUND:
        # A search ran and found nothing relevant. No tier, no completeness grade.
        return EvidenceReport(
            medicine=medicine,
            condition=condition,
            life_stage=life_stage,
            hormonal_context=hormonal_context,
            evidence_state=EvidenceState.NO_EVIDENCE_FOUND,
            evidence_summary=summary,
            evidence_tier=None,
            classification=Classification.NO_RELEVANT_EVIDENCE_FOUND,
            missing_fields=compute_missing_fields(summary),
            sources=sources,
            extraction_confidence=extraction_confidence,
            human_verified=human_verified,
        )

    if evidence_state == EvidenceState.EVIDENCE_OF_NO_EFFECT:
        # A study explicitly tested an outcome and reported null/negative. This is
        # a real finding about the study, not an evidence gap. It carries its
        # sources but no completeness tier — it is a distinct state by design.
        return EvidenceReport(
            medicine=medicine,
            condition=condition,
            life_stage=life_stage,
            hormonal_context=hormonal_context,
            evidence_state=EvidenceState.EVIDENCE_OF_NO_EFFECT,
            evidence_summary=summary,
            evidence_tier=None,
            classification=Classification.NO_RELEVANT_EVIDENCE_FOUND,
            missing_fields=compute_missing_fields(summary),
            sources=sources,
            extraction_confidence=extraction_confidence,
            human_verified=human_verified,
        )

    tier, classification = classify(summary, sources, config)
    return EvidenceReport(
        medicine=medicine,
        condition=condition,
        life_stage=life_stage,
        hormonal_context=hormonal_context,
        evidence_state=EvidenceState.HAS_EVIDENCE,
        evidence_summary=summary,
        evidence_tier=tier,
        classification=classification,
        missing_fields=compute_missing_fields(summary),
        sources=sources,
        extraction_confidence=extraction_confidence,
        human_verified=human_verified,
    )
