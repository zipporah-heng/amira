# Dataset card — AMIRA Open Women's Hormonal Evidence Dataset

- **Version:** 3.0.0 · **Source cutoff:** 2026-07-18
- **Scope (5 medicines):** rosuvastatin (JUPITER NCT00239681, HOPE-3 NCT00468923), atorvastatin (CARDS NCT00327418), digoxin (DIG NCT00000476 + 2002 sex analysis PMID 12409542, DECISION NCT03783429), dapagliflozin (DAPA-HF NCT03036124), valsartan (postmenopausal women-only, PMC8108841)
- **Size:** 7 randomized-study records · 15 included evidence sources · 58 evidence assertions · 10 sex-specific findings · 1 direct comparison · 20 screening decisions · 30 benchmark passages
- These counts are generated from the corpus; reproduce with `python pipeline/validate.py` (it also runs the evidence-integrity invariants).

## Purpose

Make it measurable whether clinical research actually represents and analyses women,
and whether life-stage and hormonal context are reported. The dataset is research
infrastructure, not clinical guidance.

## Provenance

Built by [`pipeline/ingest.py`](../pipeline/ingest.py), which fetches live from:

- **ClinicalTrials.gov API v2** — trial records and, for JUPITER, posted results
  including the baseline sex breakdown.
- **PubMed E-utilities** — abstracts for the corpus publications.
- **PubMed Central** — open-access full text (HOPE-3 long-term follow-up).

The ingestion is **self-validating**: it asserts the live registry values still match
the verified expectations and fails loudly on drift rather than serving changed numbers.

## Key contents

| Fact | Value | Basis | Source |
|---|---|---|---|
| JUPITER total enrolment | 17,802 | reported | ClinicalTrials.gov |
| JUPITER women | 6,801 | reported | Registry results + PMID 20176986 |
| JUPITER sex-specific efficacy | reported | reported | PMID 20176986 (Circulation 2010) |
| HOPE-3 total enrolment | 12,705 | reported | ClinicalTrials.gov + PMID 27040132 |
| HOPE-3 women | **46% only — no exact count published** | reported (pct) | PMC8370761 |
| Digoxin sex-based mortality (DIG) | adjusted HR 1.23 (95% CI 1.02–1.47), P=0.014 | reported | PMID 12409542 (post hoc) |
| DAPA-HF women | 1,109 (23.4%) | reported | PMID 33787831 |
| Valsartan menopausal status | reported (postmenopausal, women-only) | reported | PMC8108841 |
| Valsartan hormone therapy | reported (HRT was an exclusion criterion) | reported | PMC8108841 |
| Menopausal status (most cardiovascular/HF trials) | not reported | not_reported | Registry + publications |

## Known limitations

- **Small frozen corpus.** Seven randomized-study records across five medicines — not a
  systematic review. Absence in this corpus never means absence in the literature; AMIRA
  distinguishes `absent` / `not_located` / `not_reported` and never collapses them.
- **HOPE-3 has no exact female count.** Any combined female figure is part reported and
  part derived, and is labelled `mixed_reported_and_derived`.
- **Hormonal data is sparse.** Only the postmenopausal, women-only valsartan study reports
  menopausal status and hormone-therapy context; the cardiovascular/heart-failure trials do
  not. Age eligibility is reported as a fact and is **never** converted into a menopausal-status claim.
- **A total enrollment / female count is shown only when a `reported` assertion with a
  verified source supports it.** Raw registry `enrollment_actual` is never surfaced as an
  evidence-backed total (enforced by `pipeline/validate.py` and the evidence-integrity tests).
- **Human verification is pending.** Every assertion is source-verified (machine-checked
  against the retrieved source) but none carries named human sign-off yet. See
  [`VERIFICATION_WORKSHEET.md`](../VERIFICATION_WORKSHEET.md).
- **No model evaluation has been run.** The product displays `EVALUATION PENDING`.

## Intended and unintended use

**Intended:** research infrastructure, evidence-gap analysis, AI evaluation.
**Not intended:** diagnosis, prescribing, treatment decisions, or ranking medicines by
clinical effectiveness.
