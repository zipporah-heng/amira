# Dataset card — AMIRA Open Women's Hormonal Evidence Dataset

- **Version:** 2.0.0 · **Source cutoff:** 2026-07-18
- **Scope:** rosuvastatin (JUPITER NCT00239681, HOPE-3 NCT00468923), atorvastatin (CARDS NCT00327418), dapagliflozin (DAPA-HF NCT03036124)
- **Size:** 4 Phase 3 RCTs · 6 linked publications · 10 included evidence sources · 31 evidence assertions · 5 sex-specific findings · 30 benchmark passages

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
| Menopausal status (both trials) | not reported | not_reported | Registry + publications |
| Hormone therapy use (both trials) | not reported | not_reported | Registry + publications |

## Known limitations

- **Two trials.** This is a deliberately frozen corpus, not a systematic review of all
  rosuvastatin evidence. Absence in this corpus never means absence in the literature.
- **HOPE-3 has no exact female count.** Any combined female figure is part reported and
  part derived, and is labelled `mixed_reported_and_derived`.
- **No menopausal or hormonal data exists in this corpus.** AMIRA therefore cannot
  evidence any life stage. Age eligibility is reported as a fact and is never converted
  into a menopausal-status claim.
- **Human verification is pending.** Every assertion is source-verified (machine-checked
  against the retrieved source) but none carries named human sign-off yet. See
  [`VERIFICATION_WORKSHEET.md`](../VERIFICATION_WORKSHEET.md).
- **No model evaluation has been run.** The product displays `EVALUATION PENDING`.

## Intended and unintended use

**Intended:** research infrastructure, evidence-gap analysis, AI evaluation.
**Not intended:** diagnosis, prescribing, treatment decisions, or ranking medicines by
clinical effectiveness.
