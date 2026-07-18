# Benchmark methodology

AMIRA ships a **pilot benchmark** of 30 human-labeled examples to make extraction
quality measurable and reproducible. It is deliberately small and is labeled as a pilot
everywhere; **30 examples do not prove broad generalization.**

## File

`benchmark/pilot_benchmark.jsonl` — one JSON object per line.

- **Split:** 20 `dev` / 10 `heldout` (via the `split` field).
- **Passages:** condensed, paraphrased snippets authored for the labeling exercise and
  human-labeled. They are representative of real cardiovascular-evidence phrasing but are
  **not** presented verbatim in the product, and the product never shows a benchmark
  passage as a live source quote. This keeps the benchmark shareable without redistributing
  copyrighted full text.

## Fields per row

`benchmark_id`, `source_id`, `source_type`, `passage`, `female_enrollment_present`,
`female_n`, `female_pct`, `sex_specific_efficacy`, `sex_specific_safety`,
`sex_treatment_interaction`, `menopause_reported`, `hormonal_factors_reported`,
`hormone_therapy_reported`, `study_design`, `expected_abstention`, `human_label`,
`notes`, `split`.

Objective fields are preferred (counts, explicit "yes/no" reporting) to keep labels
defensible.

## Design intent

The benchmark stresses the behaviors that matter for trust:

- **Abstention** — many rows are silent on menopause/hormone fields; the correct label
  is `not_reported`, testing that the extractor does not infer from silence.
- **Representation ≠ analysis** — rows with high female enrollment but no sex analysis
  (e.g. `AMIRA-D-007`) test that the two are scored separately.
- **Numeric extraction** — female/total counts present in some rows, absent in others.
- **Limited source types** — observational, label, and post-market rows.

## Labeling guide

See `benchmark/README.md` for the labeling rubric (how each enum value is decided).
