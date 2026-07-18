# AMIRA — Clearer evidence for women's health

> **The question AMIRA answers:** *"Was this medicine actually studied in women like me?"*

AMIRA audits medical research evidence to show whether **women were represented** in
research and whether **sex-specific and hormone-relevant factors** were actually
analyzed or reported. It surfaces an invisible evidence gap and makes it
understandable in seconds.

AMIRA evaluates **evidence completeness**. It does **not** diagnose, prescribe,
recommend treatment, tell anyone whether a medicine is safe for them, or rank
medicines as better, safer, or more effective.

Current focus: **cardiovascular disease**, through the lens of **perimenopause and
postmenopause**.

---

## The one thing to remember

> **High female representation does not automatically mean complete women-specific or
> hormone-aware evidence.** AMIRA is built to make that difference visible.

The hero example — **atorvastatin for cardiovascular disease** — shows it: women *were*
included and efficacy *was* analyzed by sex, yet sex-specific safety, menopausal
status, and hormonal context were never reported. That is a **LIMITED** evidence-
completeness result, fully source-linked.

---

## Quick start

### Backend + built UI (one process, one URL)

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # (source .venv/bin/activate on macOS/Linux)

# 2. UI (build once; FastAPI serves it)
cd ../ui
npm ci && npm run build

# 3. Run (serves API + UI on http://localhost:8000)
cd ..
uvicorn main:app --app-dir backend --port 8000
```

Open **http://localhost:8000**, click **Run the hero example**.

### Dev mode (hot reload)

```bash
# terminal 1
uvicorn main:app --app-dir backend --port 8000
# terminal 2
cd ui && npm run dev     # http://localhost:5173, proxies /api to :8000
```

### Tests

```bash
cd backend && .venv/Scripts/python -m pytest -q      # 51 tests
python ../eval/run_eval.py --write                   # reproducible benchmark eval
```

---

## What's in the box (reusable open-science assets)

| Asset | Path | What it is |
|---|---|---|
| **Evidence schema (v1.0)** | `backend/amira/schema.py`, `GET /api/schema` | Versioned, enum-constrained, fail-closed data model |
| **Classification config** | `backend/amira/config/classification_rules.json` | Evidence-completeness tiers T1–T5 as data, not code |
| **Extraction pipeline** | `backend/amira/extraction/` | Structured, abstention-first extraction + citation validation |
| **Ingestion** | `backend/amira/ingestion/` | ClinicalTrials.gov API v2 fetch + normalize |
| **Pilot benchmark** | `benchmark/pilot_benchmark.jsonl` | 30 human-labeled examples (20 dev / 10 held-out) |
| **Evaluation runner** | `eval/run_eval.py` | Field accuracy, macro-F1, numeric, citation, abstention |
| **Verified fixtures** | `fixtures/` | Source-linked, human-verified demo evidence |

---

## Architecture at a glance

```
Source ingestion (ClinicalTrials.gov v2, labels, articles)
   → normalize → chunk
   → structured extraction (OpenAI, abstention-first)
   → schema validation (fail closed)
   → citation validation (affirmative claims must cite an in-passage span)
   → confidence assignment → human-verification flag
   → evidence-completeness classification (config-driven)
   → dashboard
```

The hero demo is **fixtures-first**: verified, human-checked evidence is served
deterministically. Live AI output never replaces a hero fixture unless it passes
schema validation, citation validation, a confidence threshold, and human
verification.

See [`docs/architecture.md`](docs/architecture.md) for detail.

## Safety: two states that are never confused

- **No evidence found** — a search ran and returned nothing relevant. An evidence gap.
- **Evidence of no effect** — a study explicitly tested an outcome and reported a null
  or negative result.

These are separate backend states with separate UI messages, enforced in code and in
tests. See [`docs/safety-and-limitations.md`](docs/safety-and-limitations.md).

## Documentation

- [architecture.md](docs/architecture.md)
- [evidence-schema.md](docs/evidence-schema.md)
- [classification-methodology.md](docs/classification-methodology.md)
- [benchmark-methodology.md](docs/benchmark-methodology.md)
- [data-sources.md](docs/data-sources.md)
- [safety-and-limitations.md](docs/safety-and-limitations.md)
- [benchmark/README.md](benchmark/README.md)

## What AMIRA does not do

Diagnosis · treatment recommendations · drug rankings · "best medicine for you" · dose
advice · a database of every medicine · a research search engine · a foundation model.
