# Data dictionary

The normalized dataset lives in [`/dataset`](../dataset) and is the single source of
numbers for the UI, the API and every download.

## `trials.json`

| Field | Type | Notes |
|---|---|---|
| `trial_id` | string | Stable short id (e.g. `JUPITER`) |
| `nct_id` | string | `NCT\d{8}`, unique across the dataset |
| `display_name` | string | Name shown in the UI |
| `brief_title` / `official_title` | string | Verbatim from the registry |
| `medicine` / `condition` | string | Scope-locked values |
| `study_type` | string | e.g. Randomized Controlled Trial |
| `enrollment_actual` | integer | Registry `enrollmentInfo.count` (ACTUAL). Raw registry metadata — see the evidence-boundary note below |
| `enrollment_basis` | enum | `reported` |

> **Evidence-boundary invariant.** AMIRA does not export or aggregate an
> evidence-backed enrollment value unless a corresponding sourced evidence
> assertion is present. The export field `total_enrollment` is populated only
> from a `reported` `total_enrollment` assertion; when that assertion is absent
> the export leaves `total_enrollment` blank (basis `absent`) and
> `aggregate_participants` excludes the trial and reports
> `participant_total_coverage: incomplete`. Raw `enrollment_actual` is never
> surfaced as an evidence-backed total.
| `sex_eligibility` | string | Registry eligibility (`ALL`) |
| `minimum_age` | string | Registry minimum age — **never** used to infer menopause |
| `start_date` / `completion_date` | string | Registry dates |
| `has_registry_results` | boolean | Whether results are posted to the registry |
| `registry_url` | string | Resolvable ClinicalTrials.gov URL |

## `source_documents.json`

| Field | Type | Notes |
|---|---|---|
| `source_id` | string | e.g. `SRC-PMID-20176986` |
| `source_type` | enum | `trial_registry_record` \| `journal_article` |
| `title`, `publisher`, `year` | — | Bibliographic metadata |
| `nct_id`, `pmid`, `pmcid` | string \| null | Real identifiers where they exist |
| `url` | string | Resolvable source URL |
| `retrieved_at` | ISO 8601 | When the source was fetched |
| `license_note` | string | Reuse terms for that source |

## `evidence_assertions.json`

Every displayed scientific claim is one row here.

| Field | Type | Notes |
|---|---|---|
| `assertion_id` | string | e.g. `A-JUP-001` |
| `trial_id` | string | FK to trials |
| `dimension` | enum | `female_enrollment_count`, `female_enrollment_pct`, `total_enrollment`, `sex_specific_efficacy_reported`, `sex_specific_safety_reported`, `menopause_status_reported`, `hormone_therapy_reported`, `pregnancy_evidence_reported` |
| `value` | number \| enum \| null | The asserted value |
| **`value_basis`** | enum | **`reported`** (stated verbatim in the source) · **`derived`** (computed by AMIRA from verified dependencies) · **`not_reported`** (the reviewed source is silent) · **`not_located`** (the defined source set was reviewed but sufficient evidence was not located). A missing assertion entirely is the separate state **`absent`** (returned by the loader, not stored). These states are never collapsed into one another. |
| `source_id` | string | FK to source_documents |
| `exact_passage` | string | Verbatim supporting text |
| `source_locator` | string | Where in the source |
| `source_verified` | boolean | For positive `reported` or `derived` assertions, the value and provenance were machine-checked against the retrieved source; explicit gap states remain `false` |
| `human_verified` | boolean | **False until a named human signs off** |
| `verifier` | string \| null | The human who signed off |
| `retrieved_at` | ISO 8601 | Fetch timestamp |

### The `value_basis` rule

`reported` and `derived` values are **never silently summed**. Where the corpus mixes
bases, the API returns the reported subtotal *and* a separately-labelled estimate. See
`count_basis_warning` in the API response.

### Displayed evidence state (what the surfaces actually emit)

Every public surface reads through one canonical projection
(`dataset.evidence_projection`), so the emitted **state** is one of eight values that are
never collapsed: the four stored bases above, plus `absent`, and three runtime
fail-closed states —

- **`conflict`** — more than one assertion exists for the (trial, dimension); no single
  value is trusted.
- **`unverified`** — a positive (`reported`/`derived`) value whose source is not
  `source_verified` or does not resolve to an authoritative `https` host.
- **`invalid`** — the assertion carries an unsupported/unknown basis.

A stored `reported`/`derived` value is emitted as a number/`yes` **only** when it is
conflict-free, source-verified, authoritative, and (for `derived`) has valid
dependencies. Otherwise the surface emits the state token and withholds the value. The
`female_n_basis` / `female_pct_basis` fields carry this state, not the raw stored basis.

## `manifest.json`

`dataset_version`, `source_cutoff`, `generated_at`, `commit_hash`, `corpus`, `counts`,
`human_verification_status`. Every API response echoes the first four.

## What is deliberately absent

The **evidence maturity level is not stored anywhere in this dataset.** It is derived
at request time by `backend/amira/maturity.py`, and
`test_maturity_level_is_never_stored_in_source_data` fails the build if a level ever
appears in the data.
