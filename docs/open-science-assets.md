# AMIRA Open-Science Assets

The reusable contribution of AMIRA is not a single proprietary model — it is the
**schema, prompts, validation, scoring rules, and evaluation pipeline** that let
anyone extract, check, and score women's-health evidence reproducibly.

Served live at `GET /api/assets` (only assets that actually exist are listed).

## Assets

| Asset | Path | What it is |
| ----- | ---- | ---------- |
| Women's Evidence Schema (v0.2) | `schema/womens_evidence_schema_v0.2.json` | Strict, versioned JSON Schema every extraction must satisfy. |
| Structured evidence dataset | `dataset/` | Normalized trials, sources, assertions, findings, comparisons — all source-linked. |
| Benchmark passages | `benchmark/amira_benchmark.jsonl` | Held-out passages for evaluation (pending human review). |
| Prompt library | `prompts/evidence_extraction_v0.1.md` | Provider-agnostic extraction prompt (versioned). |
| Extraction pipeline | `pipeline/extract_with_llm.py` | Runs AMIRA-Extract over passages; provider set by env var. |
| Extraction validator | `pipeline/validate_extractions.py` | Schema + exact-quote + anti-inference guards. |
| Evaluation runner | `evaluation/run_extraction_evaluation.py` | Process metrics only; no accuracy claimed. |
| AI model card | `docs/ai-model-card.md` | What AMIRA-Extract does, its limits, its safeguards. |
| NHANES data card | `docs/nhanes-data-card.md` | Population-context method and provenance. |
| Readiness pilot methodology | `docs/evidence-readiness-pilot-v0.1.md` | The deterministic 0–100 rules. |
| Methodology | `docs/methodology.md` | Overall evidence methodology. |
| CSV & JSONL downloads | `/api/download/*` | Trials, assertions, findings, benchmark. |
| Source code | https://github.com/zipporah-heng/amira | The full repository. |

## Honest status

- **Benchmark is prepared for human validation.** Labels are rule-drafted
  (`draft_label`) and awaiting independent human review; no gold standard is
  signed off yet.
- **Model evaluation is pending** until reviewed labels are available.
- **No accuracy figure is claimed.**
- **No validated / gold benchmark is claimed.**
- **Licensing.** Source code is **Apache-2.0** ([`LICENSE`](../LICENSE)); AMIRA's
  original schema, documentation and annotations are **CC BY 4.0**; reproduced
  publication passages and abstracts remain under their original publishers'
  rights and are **not relicensed** by AMIRA. See [`LICENSES.md`](../LICENSES.md).
  `GET /api/assets` reports `license_present: true`.

## Feature flags

| Flag | Default | Effect |
| ---- | ------- | ------ |
| `AMIRA_ENABLE_PILOT_SCORE` | **`0` (off)** | Show the experimental 0–100 pilot score. Off by default — the verified 1–5 Evidence Maturity level is the primary score. |
| `AMIRA_ENABLE_AI_EXTRACTION` | `1` | Show the AI pipeline + demo (offline recorded provider by default). |
| `AMIRA_ENABLE_NHANES` | `1` | Show the NHANES population-context module. |

Defaults are safe with **no external service**: the verified maturity level is a
pure computation, AI extraction defaults to the offline `recorded` provider (a
recorded demonstration, no live model call), and NHANES reads a committed cache.
The experimental pilot score is off by default and, when enabled, is labelled
provisional and shown below the verified maturity level. If any external service
is unavailable, the platform never shows a fabricated result — it shows an honest
"not available" / "pending" state instead.
