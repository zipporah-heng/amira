# Classification methodology

AMIRA classifies **evidence completeness** — how complete the women-specific and
hormone-relevant evidence is. It never grades the medicine, and it never ranks
medicines. Rules live in `backend/amira/config/classification_rules.json` so they can be
tuned by Mantis/Bumble without touching code.

## Representation levels (`female_pct`)

- **Adequate**: ≥ 40%
- **Underrepresented**: 25–40%
- **Severely underrepresented**: < 25%
- **Unknown**: not reported

Thresholds are configurable; they are a transparent starting framework, not a clinical
standard.

## Tiers

| Tier | Classification | When |
|---|---|---|
| T1 | **STRONG** | ≥ 2 strong sources, adequate representation, **and** sex-specific efficacy **and** safety both reported |
| T2 | **MODERATE** | Adequate representation **and** at least one of sex-specific efficacy/safety reported |
| T3 | **LIMITED** | Women represented (any level) but analysis limited / underrepresented |
| T4 | **INSUFFICIENT** | Relevant evidence exists **only** through limited source types (observational, drug label, post-market) |
| T5 | **NO RELEVANT EVIDENCE FOUND** | No relevant women-specific evidence in the reviewed set |

"Strong" sources are any source type not in the configured `limited_source_types` list.

## Worked example — the hero (atorvastatin, CVD)

- Representation: 27% women → **underrepresented** (not adequate).
- Sex-specific efficacy: **yes** (CTT 2015 meta-analysis).
- Sex-specific safety: **uncertain**; menopause / hormonal factors / hormone therapy:
  **not reported**.
- Sources include a meta-analysis + a trial (not only limited types), so not T4.
- Not adequate representation, so not T1/T2 → **T3 LIMITED**.

The classifier reproduces the fixture's tier — a test (`test_hero_classifier_reproduces_
fixture_tier`) locks this so the human-verified fixture and the live rules can never
silently diverge.

## What the classification is not

It is not a 0–100 clinical score, not a safety judgment, and not a comparison. The UI
states this next to every classification: *"This describes evidence completeness — not
whether the medicine works or is safe."*
