# AMIRA — Evidence Intelligence Platform

*Count women. Study women. Care for women.*

> **The question AMIRA answers:** *"How ready is the evidence supporting this medicine for women?"*

**Live application:** **https://amira-d8l6.onrender.com/amira/check-evidence**

---

## What AMIRA does

AMIRA is a source-linked evidence-intelligence platform for **women's-health evidence
completeness**. For a given medicine it shows how completely that medicine was studied
*in women* — who was included, what was analysed by sex, what remains unknown, and where
every number came from.

AMIRA measures **evidence completeness**. It does **not** diagnose, prescribe, recommend
treatment, tell anyone whether a medicine is safe for them, or rank medicines by how well
they work.

### The problem: counted is not the same as studied

A trial can enrol thousands of women and still never analyse whether the medicine worked or
behaved differently in them. Women get **counted**; they don't always get **studied**. That
gap is invisible on a normal drug label. AMIRA makes it visible and measurable, and — just
as importantly — it distinguishes *evidence that is genuinely missing* from *evidence we
simply haven't retrieved yet*, instead of collapsing everything into "insufficient".

For any medicine, AMIRA shows:

- **how completely it was studied in women** — a 1–5 **Evidence Maturity** level;
- **the single most important thing to notice** — a plain-language, source-linked finding;
- **how women were represented** — inclusion, sex-specific effectiveness and safety,
  menopause, hormone therapy, older women, race/ethnicity;
- **how the evidence was found** — the AI extraction pipeline, the structured schema, and
  the exact-passage validation behind each field;
- **population context** — reported medication use among U.S. women (NHANES), kept
  strictly separate from the clinical-trial evidence;
- **where every number came from** — each claim links to its trial registry or publication.

---

## Live application & main user journey

Open the app, then:

1. **Select evidence** — Condition → Drug Class → Medicine (+ optional Life Stage / Hormone
   Therapy). The medicine list is driven by the drug class (e.g. *Cardiac glycoside →
   Digoxin*, *SGLT2 inhibitor → Dapagliflozin*).
2. **What should I notice?** — the headline finding for the medicine, with its comparison
   and limitations, next to the segmented **Evidence Maturity** meter.
3. **How were women represented?** — seven state cards (Yes / Limited / Not reported / Not
   located).
4. **How AMIRA's AI found this evidence** — the extraction pipeline, five trace cards, and
   the Women's Evidence Schema. "Open evidence trace" runs the recorded extraction demo.
5. **Another evidence path to review** — other same-condition medicines shown as *separate*
   paths, never as a head-to-head comparison or recommendation.
6. **Studies behind this result**, **Population Context — NHANES**, **Reusable Scientific
   Assets**, and **Continue exploring**.

Header navigation links the wider platform: **Check Evidence**, **Research Map**,
**Open Benchmark**, **Methodology**, and **GitHub**.

Routes: `/amira/check-evidence`, `/amira/research-map`, `/amira/open-benchmark`,
`/amira/methodology`.

---

## Everything shown is real

There is **no synthetic evidence** in this repository. Every number the UI shows is computed
from a normalized dataset built by [`pipeline/ingest.py`](pipeline/ingest.py) from
**ClinicalTrials.gov**, **PubMed** and **PubMed Central** records, and every assertion carries
an exact source passage and a resolvable URL.

**Frozen corpus v3.0.0** (source cutoff 2026-07-18):

| Condition | Drug class | Medicine | Trials / studies |
|---|---|---|---|
| Cardiovascular disease prevention | Statin | Rosuvastatin | JUPITER ([NCT00239681](https://clinicaltrials.gov/study/NCT00239681)), HOPE-3 ([NCT00468923](https://clinicaltrials.gov/study/NCT00468923)) |
| Cardiovascular disease prevention | Statin | Atorvastatin | CARDS ([NCT00327418](https://clinicaltrials.gov/study/NCT00327418)) |
| Heart failure | Cardiac glycoside | Digoxin | DIG ([NCT00000476](https://clinicaltrials.gov/study/NCT00000476)) + 2002 sex-based analysis (PMID 12409542); DECISION ([NCT03783429](https://clinicaltrials.gov/study/NCT03783429)) |
| Heart failure | SGLT2 inhibitor | Dapagliflozin | DAPA-HF ([NCT03036124](https://clinicaltrials.gov/study/NCT03036124)) + prespecified sex analysis (PMID 33787831) |
| Hypertension | Angiotensin receptor blocker | Valsartan | Hayoz 2012, postmenopausal women-only (PMC8108841) |

**Corpus at a glance:** 7 randomized-study records · 15 included evidence sources · 58
evidence assertions · 10 sex-specific findings · 1 direct comparison · 20 screening
decisions · 30 benchmark passages. Reproduce every count with `python pipeline/validate.py`.

**Two real teaching cases.**
- **Digoxin (default view)** surfaces the historical DIG post-hoc signal: **33.1%** of women
  assigned digoxin died during follow-up vs **28.9%** on placebo — adjusted **HR 1.23
  (95% CI 1.02–1.47), P = 0.014** for the sex interaction. AMIRA presents this with its full
  context: a historical post-hoc analysis, *not* menopause-specific, and *not* proof that an
  individual outcome was caused by digoxin.
- **Dapagliflozin** shows a cleaner modern case: DAPA-HF enrolled 4,744 (1,109 women, 23.4%),
  women HR 0.79 (95% CI 0.59–1.06) vs men HR 0.73 (0.63–0.85), **P interaction = 0.67** — a
  reported formal sex-by-treatment test.

Dapagliflozin appears only as a *separate evidence path*; it is never described as a
replacement for, or a comparator superior to, digoxin. These are not head-to-head trials.

---

## Evidence Maturity methodology (the primary score)

The verified **1–5 Evidence Maturity** level (rendered as the segmented meter) is derived at
request time from the evidence assertions — never stored:

1. **Women Counted** — female enrolment reported (count or percentage)
2. **Women Analyzed** — sex-specific effectiveness *or* safety outcomes reported
3. **Life Stage Aware** — menopausal status / life stage reported
4. **Hormone Aware** — hormone-therapy use reported
5. **Precision Women's Evidence** — outcomes stratified by *both* life stage and hormonal context

Levels are cumulative. **Age is never used to infer menopause** — Level 3 requires an explicit
menopausal-status report. Full rules: [`docs/methodology.md`](docs/methodology.md).

There is also an **experimental "AMIRA Evidence Readiness — Pilot v0.1"** 0–100 completeness
score (`backend/amira/readiness.py`, rules in
[`docs/evidence-readiness-pilot-v0.1.md`](docs/evidence-readiness-pilot-v0.1.md)). It is a
deterministic function of the evidence — **not** a model opinion, and **not** a measure of
whether a medicine is better, safer, or more effective. It is **off by default**
(`AMIRA_ENABLE_PILOT_SCORE=0`); the verified 1–5 level is the primary score.

---

## How AMIRA's AI found this evidence

The reusable AI contribution is a schema + prompt + validator + scoring rules + evaluation
harness — **not** a single proprietary model. The pipeline is:

> Clinical literature → passage retrieval → schema-constrained extraction (AMIRA-Extract)
> → exact-passage validation → human review → deterministic Evidence Maturity engine
> → dashboard + Research Map + open assets

- **AMIRA-Extract** ([`backend/amira/extract.py`](backend/amira/extract.py)) converts one
  clinical-research passage from one source into the structured **Women's Evidence Schema
  v0.2** ([`schema/womens_evidence_schema_v0.2.json`](schema/womens_evidence_schema_v0.2.json)).
  It is **passage-local and source-local**: a field is never borrowed from another trial (a
  DIG passage never inherits DECISION's 284-woman count). The LLM extracts; it never
  calculates the score.
- **Providers are pluggable** via environment variables (`AMIRA_LLM_PROVIDER`,
  `AMIRA_LLM_MODEL`, `AMIRA_LLM_API_KEY`). API keys are read from the environment only — never
  committed, logged, or exposed in the browser. The OpenAI path uses schema-constrained
  Structured Outputs; if a live call fails, the failure is surfaced honestly.

### Recorded extraction demonstration

The default provider is **`recorded`** — a *Recorded AMIRA-Extract demonstration*. It replays
a previously generated, source-verified extraction from the committed corpus so the pipeline
can be shown without sending any data to an external model. The UI labels it as recorded
("Run recorded extraction", "Live model call: No"); it never claims a live model ran.

### Validation & source honesty

Every extraction is validated (schema → exact quote → anti-inference guards). AMIRA stores
source *excerpts*, so a verified match is shown as **"Stored evidence excerpt matched"** — it
never claims the entire original publication was auto-verified. Guards reject: inferring
menopause from age, claiming a sex comparison with no reported test, and inferring "no
difference" from silence. Model card: [`docs/ai-model-card.md`](docs/ai-model-card.md).

---

## Research Map & Open Benchmark

- **Research Map** (`/amira/research-map`, `/api/trials`) groups the corpus trials by
  condition and drug class so the coverage — and the gaps — are visible at a glance.
- **Open Benchmark** (`/amira/open-benchmark`, `/api/benchmark`) exposes 30 verbatim
  benchmark passages. Labels are rule-drafted and marked `pending_human_review`; **no
  evaluation has been run**, so the UI shows **EVALUATION PENDING** and claims no accuracy.

---

## Population Context — NHANES

A scientifically bounded module ([`docs/nhanes-data-card.md`](docs/nhanes-data-card.md))
reporting **medication *use* among U.S. women** from CDC NHANES 2017–2018, with survey
weights (`WTINT2YR`), design variables (`SDMVSTRA`, `SDMVPSU`), Taylor-linearized standard
errors, and NCHS-style small-cell suppression. It is **separate from clinical-trial
evidence** and never implies causality, effectiveness, safety, or prescribing.

Committed cache ([`dataset/nhanes/nhanes_context_v1.json`](dataset/nhanes/nhanes_context_v1.json),
built by [`pipeline/nhanes_context.py`](pipeline/nhanes_context.py)): statins 15.08% and ARBs
6.81% among adult women are shown; **cardiac glycosides and SGLT2 inhibitors are suppressed**
(unweighted n = 7 each) — the honest, intended behaviour.

---

## Integrity rules the code enforces

1. **Reported ≠ derived.** A published count and an AMIRA-computed number are never silently
   summed; mixed figures are labelled.
2. **Age never infers menopause.** Level 3 requires an explicit menopausal-status report.
3. **Significance is never inferred.** "Significant" / "no significant difference" require a
   reported statistical test; absence yields *insufficient*, never *no difference*.
4. **No cross-study leakage.** Extractions are passage/source/trial-local (regression-tested).
5. **Evidence completeness ≠ effectiveness.** Nothing ranks medicines by clinical
   performance; a build test fails on superiority language.
6. **Nothing unverified is marked verified.** `human_verified` is `false` throughout.

---

## Technical architecture

- **Backend:** FastAPI ([`backend/main.py`](backend/main.py)) serving the API *and* the built
  UI from one process. Deterministic engines: `dataset`, `engine`, `maturity`, `clinical`,
  `readiness`, `extract`, `nhanes`, `flags`. No database — the normalized dataset in
  [`dataset/`](dataset/) is the single source of truth.
- **Frontend:** React + TypeScript + Vite ([`ui/`](ui/)); one API-driven page per screen,
  responsive from 1920 down to 390 with no horizontal overflow.
- **Data pipeline:** [`pipeline/`](pipeline/) (ingest, benchmark, validate, LLM extraction,
  extraction validation, NHANES). **Feature flags** (`AMIRA_ENABLE_PILOT_SCORE`,
  `AMIRA_ENABLE_AI_EXTRACTION`, `AMIRA_ENABLE_NHANES`) default to scientifically safe behaviour
  with no external service required.
- **Deployment:** [`render.yaml`](render.yaml) builds the UI, installs the backend, and serves
  the committed dataset (no live network calls at request time).

---

## Setup & local run

The dataset is already committed, so you can run without any network access. (Only re-run
`pipeline/ingest.py` if you want to rebuild the corpus from live sources.)

```bash
# 1. Backend
cd backend && python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt && cd ..

# 2. UI
cd ui && npm ci && npm run build && cd ..

# 3. Run (API + UI on one URL)
uvicorn main:app --app-dir backend --port 8000
```

Open **http://localhost:8000** → redirects to `/amira/check-evidence`.

Optional environment variables (all default-safe):

```
AMIRA_ENABLE_PILOT_SCORE=0     # experimental 0–100 score (off by default)
AMIRA_ENABLE_AI_EXTRACTION=1   # AI pipeline + recorded demo
AMIRA_ENABLE_NHANES=1          # NHANES population context
AMIRA_LLM_PROVIDER=recorded    # recorded | openai | anthropic
# AMIRA_LLM_MODEL, AMIRA_LLM_API_KEY  — only for a live provider; never commit a key
```

## Testing

```bash
# Backend (run from backend/ so the `amira` package imports)
cd backend && python -m pytest -q          # 127 integrity, provenance & build-guard tests

# Dataset & extraction validation (offline, no network)
python pipeline/validate.py                # corpus consistency + no synthetic markers
python pipeline/validate_extractions.py    # schema + exact-quote validation

# Frontend
cd ui && npm test                          # 22 component tests
```

## API & downloadable assets

`POST /api/check-evidence` — body: `condition`, `medicine`, `life_stage`, `hormone_therapy`.
Every response carries `dataset_version`, `source_cutoff`, `commit_hash`, `generated_at` and
resolvable source links. Other endpoints: `/api/catalog`, `/api/trials`,
`/api/evidence-assertions`, `/api/findings`, `/api/class-comparison`, `/api/screening-log`,
`/api/readiness`, `/api/ai/pipeline`, `/api/ai/passages`, `/api/ai/extract`, `/api/nhanes`,
`/api/assets`, `/api/benchmark`, `/api/manifest`, `/api/flags`.

Downloads, generated from the *same* records the API serves:
`/api/download/trials.csv` · `trials.jsonl` · `evidence_assertions.csv` · `.jsonl` ·
`findings.csv` · `.jsonl` · `benchmark.jsonl`. Reusable assets (schema, prompt library,
dataset, benchmark, pipeline, evaluation runner, docs) are listed at `/api/assets` and in
[`docs/open-science-assets.md`](docs/open-science-assets.md).

## Documentation

- [Methodology](docs/methodology.md) · [Evidence Readiness pilot](docs/evidence-readiness-pilot-v0.1.md)
- [AI model card](docs/ai-model-card.md) · [NHANES data card](docs/nhanes-data-card.md)
- [Open-science assets](docs/open-science-assets.md)
- [Inclusion / exclusion protocol](docs/inclusion-exclusion-protocol.md) · [Dataset card](docs/dataset-card.md) · [Data dictionary](docs/data-dictionary.md)
- [Limitations and licensing](docs/limitations-and-licensing.md)
- [Verification worksheet](VERIFICATION_WORKSHEET.md) — every assertion and finding with its source link

## Scientific status, limitations & human review

AMIRA reports its own limits as plainly as its results:

- **Every assertion and finding is source-verified** — machine-checked against the retrieved
  primary source, each with an exact passage and a resolvable URL.
- **Named human sign-off is still outstanding**, so `human_verified` is `false` throughout;
  the UI shows "Human review pending". Nothing is presented as human-verified.
- **Benchmark labels are rule-drafted** (`pending_human_review`); **no model evaluation has
  been run**, so the product shows **EVALUATION PENDING** and claims **no accuracy figure**.
- **No validated gold benchmark and no open license are claimed** unless a `LICENSE` file and
  dataset license have been approved by the repository owner.
- The corpus is small and frozen (source cutoff 2026-07-18); it is research infrastructure,
  not a validated clinical decision tool.
