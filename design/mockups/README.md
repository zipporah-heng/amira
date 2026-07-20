# AMIRA result-screen concepts

These are design-only mockups using the current rosuvastatin evidence. They do not change the application.

## Concept A — Tell me plainly

Leads with one plain-language answer, separates what is known from what is missing, and gives the user two obvious next actions. The numeric maturity score is retained but demoted and translated as “2 of 5 evidence questions answered.”

## Concept B — Evidence journey

Turns AMIRA’s core insight into the interface: counted → analyzed → compared → safety → hormonal context. The plain-language conclusion remains dominant while the source-linked technical trace is visible below it.

## Concept C — One screen for a family member and a clinician

Uses digoxin as the stress test. Five ordinary questions replace research shorthand, while a `Clinical details` control exposes the statistics and exact passages. Real-world prescription volume is explicitly separated from trial enrolment because AMIRA does not currently contain prescribing-utilization data.

## Concept D — Full one-page evidence intelligence result

Combines plain-language interpretation with clinical depth on one scrollable page. The first row answers trust, applicability, maturity, and the headline finding. Lower sections add the clinical snapshot, maturity journey, known-versus-unknown evidence, decision support, population coverage, timeline, research need, provenance, open infrastructure, and another evidence path. All displayed counts come from the current AMIRA Digoxin records or the current corpus manifest; unsupported 100-point scores, patient-match percentages, benchmark accuracy claims, and score forecasts are intentionally excluded.

## Concept E — Explainable score, representation, comparison, sources

Reorders the result screen around the requested decision journey: selectors, selected medicine, a provisional explainable AMIRA Evidence Readiness Score, plain-language representation cards, comparison with similar medicines, and the studies behind the result. Existing detailed modules continue below. All 100-point values and study labels in this concept are explicitly marked as illustrative layout data and must be replaced by calculated, source-linked records before release.

## Shared rules

- Answer the human question before showing the database structure.
- Never imply that evidence maturity is a clinical ranking.
- Explain “not reported” as a research gap, not proof that a medicine is unsafe or ineffective.
- Keep direct sources one click away.
- Use progressive disclosure instead of giving every metric equal visual weight.
