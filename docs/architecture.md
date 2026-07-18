# Architecture

AMIRA is a small FastAPI backend that serves both a JSON API and a built React
single-page app from one process, so there is exactly one URL to demo and deploy.

## Components

```
amira/
├── backend/
│   ├── main.py                 FastAPI app: /api/* + serves ui/dist
│   └── amira/
│       ├── schema.py           Evidence schema v1.0 (Pydantic, fail-closed)
│       ├── classification.py   Config-driven completeness classifier
│       ├── config/
│       │   └── classification_rules.json   Tier rules T1–T5 (editable data)
│       ├── fixtures.py         Load + validate verified demo fixtures
│       ├── ingestion/
│       │   └── clinicaltrials.py           ClinicalTrials.gov v2 fetch/normalize
│       └── extraction/
│           ├── prompts.py      Abstention-first extraction prompt
│           └── extractor.py    Extraction + schema + citation validation
├── fixtures/                   hero_evidence.json + medicines/ + recorded_extractions/
├── benchmark/pilot_benchmark.jsonl
├── eval/run_eval.py            Reproducible evaluation runner
├── ui/                         Vite + React + TypeScript
└── render.yaml                 One-click Render blueprint
```

## Request flow (`POST /api/check-evidence`)

1. The request names a medicine, condition, life stage, and hormonal context.
2. The fixture index is consulted (exact match, then medicine+condition fallback) so
   the deterministic demo always resolves.
3. The matched `EvidenceReport` — already schema-validated at load — is returned, with
   the user's selected context echoed back for display.
4. The UI renders the completeness classification, evidence cards, the What We Found /
   What Is Still Missing panels, and the source drawer.

## Extraction / live pipeline (`amira/extraction`)

The live pipeline exists and is fully tested; it activates when `OPENAI_API_KEY` is
set. Its output flows through the **same** validation path as everything else:

```
passage → structured extraction (OpenAI json_object, temperature 0)
        → _validate_raw  (enum + numeric type checks; fail closed)
        → _finalize      (citation verification; downgrade uncited claims to abstention)
        → EvidenceSummary
```

Offline (no key) the pipeline uses a **recorded** backend that reads pre-recorded model
outputs from `fixtures/recorded_extractions/`, so tests and demos are deterministic.

## Why fixtures-first

The hero demo must never break in front of a judge, and no seeded value may ever be
presented as live. So verified, human-checked evidence is served deterministically, and
live extraction is gated behind schema + citation + confidence + human-verification
checks before it could ever replace a fixture. Provenance is labeled on every value
(Live source / Verified demo data / AI extracted / Human verified).

## Deployment

`render.yaml` builds the UI (`npm ci && npm run build`) and installs the backend, then
starts uvicorn. FastAPI serves `ui/dist` for all non-`/api` routes (SPA fallback to
`index.html`). One free web service, one URL.
