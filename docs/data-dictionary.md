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
| `enrollment_actual` | integer | Registry `enrollmentInfo.count` (ACTUAL) |
| `enrollment_basis` | enum | `reported` |
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
| **`value_basis`** | enum | **`reported`** (stated verbatim in the source) · **`derived`** (computed by AMIRA) · **`not_reported`** (absent from the reviewed sources) |
| `source_id` | string | FK to source_documents |
| `exact_passage` | string | Verbatim supporting text |
| `source_locator` | string | Where in the source |
| `source_verified` | boolean | Value machine-checked against the retrieved source |
| `human_verified` | boolean | **False until a named human signs off** |
| `verifier` | string \| null | The human who signed off |
| `retrieved_at` | ISO 8601 | Fetch timestamp |

### The `value_basis` rule

`reported` and `derived` values are **never silently summed**. Where the corpus mixes
bases, the API returns the reported subtotal *and* a separately-labelled estimate. See
`count_basis_warning` in the API response.

## `manifest.json`

`dataset_version`, `source_cutoff`, `generated_at`, `commit_hash`, `corpus`, `counts`,
`human_verification_status`. Every API response echoes the first four.

## What is deliberately absent

The **evidence maturity level is not stored anywhere in this dataset.** It is derived
at request time by `backend/amira/maturity.py`, and
`test_maturity_level_is_never_stored_in_source_data` fails the build if a level ever
appears in the data.
