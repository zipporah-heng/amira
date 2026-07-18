"""AMIRA evidence schema (v1.0).

This module is the single source of truth for the AMIRA evidence data model.
Everything the UI trusts must pass through these models. Free-form model text is
never allowed to populate trusted fields without validation here.

Design rules encoded in this file:
- Reported-status fields use a closed enum. "unknown" is the schema default,
  "not_reported" is an explicit extraction result meaning "we looked and the
  source did not report it". They are different and must stay different.
- Numeric fields (female_n, total_n) are non-negative; female_pct is 0-100.
- Every source carries its own citation + verification metadata.
- Validation fails closed: malformed input raises, it does not silently coerce.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

SCHEMA_VERSION = "1.0"


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class ReportedStatus(str, Enum):
    """Whether a sex/hormone-relevant analysis was reported in the sources.

    unknown       -> not yet assessed (schema default)
    yes           -> source explicitly reports/analyzes it
    no            -> source explicitly states it was NOT done
    uncertain     -> source is ambiguous; extractor could not decide
    not_reported  -> extractor read the source and it is silent on this field
    """

    UNKNOWN = "unknown"
    YES = "yes"
    NO = "no"
    UNCERTAIN = "uncertain"
    NOT_REPORTED = "not_reported"


class LifeStage(str, Enum):
    PREMENOPAUSE = "premenopause"
    PERIMENOPAUSE = "perimenopause"
    POSTMENOPAUSE = "postmenopause"
    NOT_SPECIFIED = "not_specified"


class HormoneTherapyContext(str, Enum):
    YES = "yes"
    NO = "no"
    NOT_SPECIFIED = "not_specified"


class EvidenceTier(str, Enum):
    """Evidence-completeness tiers. These describe the EVIDENCE, not the drug."""

    T1 = "T1"
    T2 = "T2"
    T3 = "T3"
    T4 = "T4"
    T5 = "T5"


class Classification(str, Enum):
    STRONG = "STRONG"
    MODERATE = "MODERATE"
    LIMITED = "LIMITED"
    INSUFFICIENT = "INSUFFICIENT"
    NO_RELEVANT_EVIDENCE_FOUND = "NO RELEVANT EVIDENCE FOUND"


class EvidenceState(str, Enum):
    """Backend states that MUST NEVER share a code path or a UI message.

    HAS_EVIDENCE          -> normal path, classification T1-T4 applies
    NO_EVIDENCE_FOUND     -> a search ran; nothing relevant in the reviewed set
    EVIDENCE_OF_NO_EFFECT -> a study tested an outcome and reported null/negative
    """

    HAS_EVIDENCE = "HAS_EVIDENCE"
    NO_EVIDENCE_FOUND = "NO_EVIDENCE_FOUND"
    EVIDENCE_OF_NO_EFFECT = "EVIDENCE_OF_NO_EFFECT"


class SourceType(str, Enum):
    CLINICAL_TRIAL = "clinical_trial"
    JOURNAL_ARTICLE = "journal_article"
    SYSTEMATIC_REVIEW = "systematic_review"
    META_ANALYSIS = "meta_analysis"
    DRUG_LABEL = "drug_label"
    POST_MARKET_SURVEILLANCE = "post_market_surveillance"
    OBSERVATIONAL = "observational"
    OTHER = "other"


class DataProvenance(str, Enum):
    """Honest labeling of where a value came from. Never present seeded as live."""

    LIVE_SOURCE = "LIVE_SOURCE"
    VERIFIED_DEMO_DATA = "VERIFIED_DEMO_DATA"
    AI_EXTRACTED = "AI_EXTRACTED"
    HUMAN_VERIFIED = "HUMAN_VERIFIED"


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class Source(BaseModel):
    """One piece of evidence with full traceability."""

    model_config = {"extra": "forbid"}

    source_id: str
    source_title: str
    source_type: SourceType
    url: Optional[str] = None
    publication_year: Optional[int] = None
    study_design: Optional[str] = None
    nct_id: Optional[str] = None
    population: Optional[str] = None
    total_n: Optional[int] = Field(default=None, ge=0)
    female_n: Optional[int] = Field(default=None, ge=0)
    female_pct: Optional[float] = Field(default=None, ge=0, le=100)
    relevant_passage: str
    source_location: Optional[str] = None
    ai_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    human_verified: bool = False
    provenance: DataProvenance = DataProvenance.AI_EXTRACTED
    classification: Optional[str] = None
    classification_rationale: Optional[str] = None

    @model_validator(mode="after")
    def _check_female_n(self) -> "Source":
        if (
            self.female_n is not None
            and self.total_n is not None
            and self.female_n > self.total_n
        ):
            raise ValueError(
                f"female_n ({self.female_n}) cannot exceed total_n ({self.total_n})"
            )
        return self

    @model_validator(mode="after")
    def _require_citation(self) -> "Source":
        # A source with no passage and no location cannot back a trusted claim.
        if not self.relevant_passage.strip() and not (self.source_location or "").strip():
            raise ValueError(
                f"source {self.source_id} has neither a passage nor a source_location; "
                "cannot support a trusted claim (fail closed)"
            )
        return self


class HormonalContext(BaseModel):
    model_config = {"extra": "forbid"}

    hormone_therapy: HormoneTherapyContext = HormoneTherapyContext.NOT_SPECIFIED


class EvidenceSummary(BaseModel):
    model_config = {"extra": "forbid"}

    female_n: Optional[int] = Field(default=None, ge=0)
    female_pct: Optional[float] = Field(default=None, ge=0, le=100)
    total_n: Optional[int] = Field(default=None, ge=0)
    sex_stratified_efficacy_reported: ReportedStatus = ReportedStatus.UNKNOWN
    sex_stratified_safety_reported: ReportedStatus = ReportedStatus.UNKNOWN
    sex_by_treatment_interaction_tested: ReportedStatus = ReportedStatus.UNKNOWN
    menopausal_status_reported: ReportedStatus = ReportedStatus.UNKNOWN
    hormonal_factors_reported: ReportedStatus = ReportedStatus.UNKNOWN
    hormone_therapy_reported: ReportedStatus = ReportedStatus.UNKNOWN
    pregnancy_excluded: ReportedStatus = ReportedStatus.UNKNOWN


class EvidenceReport(BaseModel):
    """Top-level AMIRA result. This is what the API returns and the UI renders."""

    model_config = {"extra": "forbid"}

    schema_version: str = SCHEMA_VERSION
    medicine: str
    condition: str
    life_stage: LifeStage = LifeStage.NOT_SPECIFIED
    hormonal_context: HormonalContext = Field(default_factory=HormonalContext)
    evidence_state: EvidenceState = EvidenceState.HAS_EVIDENCE
    evidence_summary: EvidenceSummary = Field(default_factory=EvidenceSummary)
    evidence_tier: Optional[EvidenceTier] = None
    classification: Classification = Classification.NO_RELEVANT_EVIDENCE_FOUND
    missing_fields: List[str] = Field(default_factory=list)
    sources: List[Source] = Field(default_factory=list)
    extraction_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    human_verified: bool = False

    @model_validator(mode="after")
    def _no_evidence_states_have_no_tier(self) -> "EvidenceReport":
        # A no-evidence or no-effect result must not carry a completeness tier;
        # tiers only describe reports that actually contain relevant evidence.
        if self.evidence_state in (
            EvidenceState.NO_EVIDENCE_FOUND,
            EvidenceState.EVIDENCE_OF_NO_EFFECT,
        ) and self.evidence_tier is not None:
            raise ValueError(
                f"evidence_state={self.evidence_state.value} must not carry an "
                "evidence_tier (fail closed)"
            )
        return self


def export_json_schema() -> dict:
    """Return the JSON Schema for EvidenceReport (for the open-science package)."""

    return EvidenceReport.model_json_schema()
