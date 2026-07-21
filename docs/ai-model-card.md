# AMIRA-Extract — AI Model Card

**Component:** AMIRA-Extract
**Version:** prompt `evidence-extraction-v0.1`, schema `womens_evidence_schema_v0.2`
**Status:** pilot / research. Not a validated clinical tool.

## What it does

AMIRA-Extract converts a single passage of clinical-research text (a
ClinicalTrials.gov record, a PubMed abstract, or a PubMed Central passage) into
one structured record conforming to the **Women's Evidence Schema v0.2**
(`schema/womens_evidence_schema_v0.2.json`).

It answers one narrow question per passage: *what women's-health evidence does
this text state, and can each field be traced to it verbatim?*

## Passage-local and source-local (no cross-study leakage)

Each extraction is bound to exactly one `trial_id`, one `source_document_id`, and
one `passage_id`. **A field is never borrowed from another trial, publication, or
passage of the same medicine.** For example, a passage from the DIG trial reports
`women_count: null` (DIG's own abstract does not state it) and never inherits the
DECISION trial's 284-woman count. Medicine-level synthesis happens afterwards, in
the deterministic engines, and is kept visibly separate from extraction. A
regression test (`test_dig_extraction_does_not_borrow_decisions_284_women`)
enforces this.

## What it explicitly does NOT do

- It does **not** calculate the readiness score or the maturity level. Those are
  produced by a separate, deterministic engine (`backend/amira/readiness.py`,
  `backend/amira/maturity.py`). The model's output is an **input** to scoring,
  never the score itself.
- It does **not** diagnose, prescribe, recommend, or rank medicines.
- It does **not** infer beyond the text: no menopause-from-age, no sex comparison
  where none was reported, no "no difference" from silence.

## Inputs and outputs

- **Input:** a text passage plus source metadata (medicine, condition, study id,
  source id, source URL).
- **Output:** one JSON object with the fields listed in the schema, including the
  exact evidence passage, source URL, model id, prompt version, schema version,
  extraction timestamp, validation state, and human-review state.

## Providers (replaceable)

The provider is selected entirely by environment variable, so the reusable
contribution is the schema + prompt + validator + scoring rules + evaluation —
**not** one proprietary model.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AMIRA_LLM_PROVIDER` | `recorded` | `recorded` \| `openai` \| `anthropic` |
| `AMIRA_LLM_MODEL` | *(empty)* | model id for the chosen provider |
| `AMIRA_LLM_API_KEY` | *(unset)* | provider key, read from the environment only |
| `AMIRA_ENABLE_AI_EXTRACTION` | `1` | feature flag for the AI module |

- **`recorded` (default):** a **Recorded AMIRA-Extract demonstration** — it
  replays a previously generated structured extraction from the committed corpus
  so the pipeline can be shown without sending data to an external model. It
  makes **no live model call** (`live_model_call: false`) and is labelled as
  recorded everywhere in the UI (button: "Run recorded extraction"). Fully
  deterministic and offline.
- **`openai` / `anthropic`:** call a live model with the versioned prompt. The
  OpenAI path uses **schema-constrained Structured Outputs** against the versioned
  Women's Evidence Schema (not generic JSON mode). Runs only when
  `AMIRA_LLM_API_KEY` is set; the key is never written to logs, the repository,
  or the browser bundle. `live_model_call` is set to `true`. **If the call fails,
  the failure is surfaced honestly (HTTP 502) — recorded output is never
  substituted for a live result.**

### Source-match honesty

AMIRA stores source *excerpts*, not full retrieved documents. A verified
extraction is therefore reported as **"Stored evidence excerpt matched"**, never
"the whole publication was verified". The `source_match_state` field is one of:
`source_passage_matched` (validated against retrieved full source),
`stored_excerpt_matched` (matched AMIRA's stored excerpt — the current state),
`source_match_unavailable`, `quarantined`, or `human_reviewed`. Each stored
passage carries a `provenance` block (source_document_id, source_url,
passage_index, SHA-1 content hash, retrieval_date, match_basis). Absence findings
carry `exact_evidence_passage: null` and are labelled "Not located in reviewed
source" — no quotation is invented to assert an absence.

## Safety and hallucination controls

Enforced in `backend/amira/extract.py::validate` and covered by tests in
`backend/tests/test_extraction.py`:

1. **Strict schema.** Output must conform to the versioned JSON Schema or it is
   quarantined.
2. **Exact-quote validation.** `exact_evidence_passage` must appear verbatim in
   the stored source; an invented quote is rejected.
3. **No menopause from age.** `menopause: reported` is allowed only when a stored
   passage for the source actually mentions menopausal status.
4. **No unsupported sex comparison.** `formal_sex_comparison: reported` requires
   a reported `interaction_statistic`.
5. **No "no difference" from silence.** A missing comparison is `not_reported`,
   never an equivalence claim.
6. **Provenance recorded.** Model id, prompt version, schema version, validation
   state, and human-review state travel with every extraction.

## Human review

Nothing is marked `human_verified` until a **named** reviewer signs off; the
schema requires a `human_reviewer` in that case. Until then extractions are
`not_reviewed` and the UI shows "Human verification pending".

## Evaluation

`evaluation/run_extraction_evaluation.py` reports **process metrics only**:
schema-validity rate and exact-quote verification rate over the corpus. It
reports **no** clinical-accuracy figure — the benchmark labels are pending human
review, so there is no gold standard to score against. See
`evaluation/results.json`.

## Known limitations

- The `recorded` provider is bounded to the committed corpus; it does not
  discover new evidence.
- The corpus is small and frozen (source cutoff 2026-07-18).
- No clinical accuracy is claimed. This is research infrastructure, not a
  validated decision tool.
