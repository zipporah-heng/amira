# Methodology: source hierarchy, labeling, benchmark, evaluation

## Reproducing and validating the dataset

**Offline validation (no network required)** — verifies the committed corpus is
internally consistent, fully source-linked, free of synthetic markers, and that the
manifest counts match the actual records:

```bash
python pipeline/validate.py
```

`python pipeline/ingest.py --offline` runs the same validator.

**Full regeneration (requires network)** — refetches every record from
ClinicalTrials.gov, PubMed and PMC, and fails loudly if a registry value has drifted
from the verified expectation:

```bash
python pipeline/ingest.py          # rebuild dataset/
python pipeline/build_benchmark.py # rebuild benchmark/
```

**Commit provenance.** `ingest.py` records the commit that was checked out while it
ran, which precedes the commit containing the regenerated data. After committing the
corpus, `python pipeline/stamp_manifest.py` writes the actual HEAD into
`dataset/manifest.json`, which is then amended in — so `manifest.commit_hash` is the
SHA of a commit that genuinely contains the corpus it describes.

## Source hierarchy

When sources disagree, the higher tier wins and the conflict is recorded.

1. **Trial registry results** (ClinicalTrials.gov posted results) — structured,
   sponsor-reported participant data. Used for JUPITER's sex breakdown.
2. **Trial registry protocol record** — enrolment, eligibility, design.
3. **Peer-reviewed primary publication** of the trial.
4. **Peer-reviewed secondary analysis** of the trial (e.g. the JUPITER sex-specific
   analysis, PMID 20176986).
5. **Open-access full text** for facts absent from the above (e.g. HOPE-3's reported
   46% women, PMC8370761).

A value is only ever `reported` if it appears verbatim in one of these. Anything AMIRA
computes (from verified dependencies) is `derived`. When a reviewed source is silent the
state is `not_reported`; when the defined source set was reviewed but sufficient evidence
was not located it is `not_located`; when AMIRA holds no assertion at all it is `absent`.
These states are distinct and are never inferred or collapsed into one another.

## Evidence maturity model (derived, never stored)

| Level | Name | Requirement |
|---|---|---|
| 1 | Women Counted | Female enrolment reported (count or percentage) |
| 2 | Women Analyzed | Sex-specific efficacy **or** safety outcomes reported |
| 3 | Life Stage Aware | Menopausal status / life stage reported |
| 4 | Hormone Aware | Hormone therapy use reported |
| 5 | Precision Women's Evidence | Sex-specific outcomes stratified by **both** life stage and hormonal context |

Levels are **cumulative** — the awarded level is the highest *N* for which every level
1..*N* is satisfied. The level is computed at request time by
`backend/amira/maturity.py` and is never persisted.

**Hard rule:** age is never used to infer menopausal status. Only an explicit
menopausal-status report can satisfy level 3. JUPITER enrolled women aged ≥60 and HOPE-3
women aged ≥65 (or 60–65 with two risk factors); neither fact advances the level.

**Current derivation for rosuvastatin:** L1 ✓ (6,801 women reported) · L2 ✓ (PMID
20176986 sex-specific analysis) · L3 ✗ · L4 ✗ → **Level 2, Women Analyzed**.

## Sex-specific effectiveness states

| State | Meaning |
|---|---|
| Significant sex difference identified | A sex comparison was performed and found a difference |
| No statistically significant sex difference identified | **Requires an actual sex-specific comparison in a source** |
| Conflicting sex-specific results | Sources disagree |
| Insufficient sex-specific evidence | Not enough reliable sex-specific data to conclude |
| Sex-specific effectiveness not reported | A reviewed source shows it was not analysed by sex |

**Insufficient does not mean ineffective in women.** Equality is never inferred from
"both sexes benefited", from one subgroup being significant and another not, or from a
difference simply not being mentioned. A finding may only carry `significance` when it
records a reported statistical comparison — enforced by
`test_significance_is_never_inferred_without_a_reported_test`.

## Sex-specific safety states

Significant · Non-significant trends · No significant difference · Conflicting ·
Insufficient · Not reported.

Both statistically significant differences **and** non-significant trends are shown,
because a trend can still be clinically relevant when choosing between medicines.
Significant findings are visually highlighted; trends are shown in a neutral style and
explicitly labelled *"Trend only. Not statistically significant."* Sex-specific side
effects are never inferred from pooled adverse-event data.

## Drug-class comparison rules

Evidence maturity is comparable across medicines in the same class. Sex-specific
effectiveness and safety are shown side by side only for the same class and a
sufficiently similar indication. Default sort: evidence maturity, highest first.

AMIRA distinguishes two statements that are **not** the same:

- *"Drug A has stronger women-specific evidence"* — a claim about the evidence.
- *"Drug A demonstrated greater effectiveness"* — a clinical claim requiring valid
  comparative evidence on compatible endpoints.

AMIRA only ever makes the first. `test_class_comparison_makes_no_direct_efficacy_claim`
fails the build if superiority language appears. Only medicines with completed, verified
ingestion appear in the comparison.

## Two states AMIRA never conflates

- **No evidence found** — a search ran and returned nothing relevant in the reviewed
  corpus. An evidence gap.
- **Evidence of no effect** — a study explicitly tested an outcome and reported a null
  or negative result. A finding.

## Labeling guide (benchmark)

Each passage is labelled from its own text only:

- **yes** — the passage explicitly reports the factor.
- **not_reported** — the passage is silent. This is the correct answer for abstention
  and is the most common label.
- Numeric fields are labelled only when the number appears in the passage.
- Never infer a biological fact from silence; never infer menopause from age.

Labels in v1.0.0 are **rule-drafted from the retrieved passage**
(`label_provenance: rule_drafted_from_retrieved_passage`) and carry
`annotation_status: pending_human_review` with `human_verifier: null`.

## Benchmark methodology

30 verbatim passages retrieved from the five corpus sources, spread across all of them,
de-duplicated, and ordered by a stable content hash so splits are reproducible:
**18 development · 6 validation · 6 frozen held-out test**.

Each item carries: `benchmark_id`, `source_id`, `nct_id`, `pmid`, `pmcid`,
`source_url`, `exact_passage`, `draft_label`, `split`, `annotation_status`,
`human_verifier`, `retrieved_at`. The `draft_label` field holds **provisional,
rule-drafted labels** — not gold labels and not human-verified.

## Benchmark completion protocol

The benchmark is **prepared for human validation**; it is not yet validated. Before any
evaluation result may be published:

1. **Two independent reviewers** label each passage against the schema.
2. **Disagreements are adjudicated and resolved.**
3. **Reviewer identities and review dates are recorded** on each item.
4. Only then is the extractor evaluated against the reviewed labels and results published.

Current status: draft labels only; no reviewers assigned; no dates recorded; no agreement
or accuracy scores exist.

## Evaluation methodology

No evaluation has been run. The product displays **EVALUATION PENDING** and publishes no
accuracy figures.

When an evaluation is published it must identify, in the results file:
`model`, `prompt_version`, `dataset_version`, `source_cutoff`, `test_split`,
`commit_hash`, plus per-field accuracy, macro-F1, citation-support accuracy and
abstention accuracy. Results are only valid once the benchmark's draft labels have
completed the human-validation protocol above; running the extractor against
rule-drafted labels would measure agreement with a rule, not with ground truth.
