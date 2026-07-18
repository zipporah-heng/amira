# Evidence schema (v1.0)

The schema is the single source of truth for everything the UI trusts. It is defined in
`backend/amira/schema.py` and exported as JSON Schema at `GET /api/schema`.

## Top-level: `EvidenceReport`

```jsonc
{
  "schema_version": "1.0",
  "medicine": "Atorvastatin",
  "condition": "Cardiovascular disease",
  "life_stage": "postmenopause",              // enum LifeStage
  "hormonal_context": { "hormone_therapy": "not_specified" },
  "evidence_state": "HAS_EVIDENCE",           // enum EvidenceState
  "evidence_summary": { /* see below */ },
  "evidence_tier": "T3",                       // T1–T5 or null
  "classification": "LIMITED",                 // enum Classification
  "missing_fields": ["Sex-specific safety outcomes", "..."],
  "sources": [ /* Source[] */ ],
  "extraction_confidence": 0.9,
  "human_verified": true
}
```

## `evidence_summary`

| Field | Type | Notes |
|---|---|---|
| `female_n` | int ≥ 0 \| null | |
| `female_pct` | 0–100 \| null | |
| `total_n` | int ≥ 0 \| null | |
| `sex_stratified_efficacy_reported` | ReportedStatus | |
| `sex_stratified_safety_reported` | ReportedStatus | |
| `sex_by_treatment_interaction_tested` | ReportedStatus | |
| `menopausal_status_reported` | ReportedStatus | |
| `hormonal_factors_reported` | ReportedStatus | |
| `hormone_therapy_reported` | ReportedStatus | |
| `pregnancy_excluded` | ReportedStatus | |

## Enums

- **`ReportedStatus`**: `unknown` (default, not yet assessed) · `yes` · `no` ·
  `uncertain` · `not_reported` (assessed and the source is silent). `unknown` and
  `not_reported` are **different** and must stay different.
- **`Classification`**: `STRONG` · `MODERATE` · `LIMITED` · `INSUFFICIENT` ·
  `NO RELEVANT EVIDENCE FOUND`.
- **`EvidenceTier`**: `T1`–`T5`.
- **`EvidenceState`**: `HAS_EVIDENCE` · `NO_EVIDENCE_FOUND` · `EVIDENCE_OF_NO_EFFECT`.
- **`DataProvenance`**: `LIVE_SOURCE` · `VERIFIED_DEMO_DATA` · `AI_EXTRACTED` ·
  `HUMAN_VERIFIED`.

## `Source`

`source_id`, `source_title`, `source_type`, `url`, `publication_year`, `study_design`,
`nct_id`, `population`, `total_n`, `female_n`, `female_pct`, `relevant_passage`,
`source_location`, `ai_confidence`, `human_verified`, `provenance`, `classification`,
`classification_rationale`.

## Fail-closed validation rules (enforced, test-locked)

- `extra: forbid` — unknown fields are rejected.
- `female_n` may not exceed `total_n`.
- `female_pct` ∈ [0, 100]; counts are non-negative.
- A `Source` must have **either** a `relevant_passage` **or** a `source_location`; a
  source that can back nothing is rejected.
- `NO_EVIDENCE_FOUND` and `EVIDENCE_OF_NO_EFFECT` reports **must not** carry an
  `evidence_tier` — completeness tiers only describe reports that contain relevant
  evidence.

Free-form model text is never allowed to populate a trusted field without passing this
schema.
