# AMIRA clickable mockup — Founder verification (Grasshopper)

The clickable AMIRA prototype demonstrating both the user-facing **Check the Evidence**
experience and the reusable **Open Women's Hormonal Evidence Dataset and Benchmark**
underneath it. All numbers are **DEMO DATA** — deterministic sample values, clearly
labeled, ready to be swapped for verified evidence later.

## Access

**Local (works right now):**

```bash
cd amira/ui && npm ci && npm run build   # builds the mockup + copies sample downloads
cd .. && uvicorn main:app --app-dir backend --port 8000
```

Open **http://localhost:8000** → it redirects to `/amira/check-evidence`.

**Staging (Render):** the repo ships `render.yaml` (builds UI + backend, one URL). The
"New → Blueprint → Apply" click needs a Render account — I don't have Render API access
in this environment, so that one step is yours (~1 minute).

## The four working routes

| Route | What it shows |
|---|---|
| `/amira/check-evidence` | The main experience (default landing) |
| `/amira/research-map` | Women's Evidence Coverage Matrix (3 statins × 5 dimensions) |
| `/amira/open-benchmark` | The dataset + benchmark, with working downloads |
| `/amira/methodology` | 6-step flow, the 1–5 maturity model, the two distinct states |

## Exact demo selections (Check the Evidence)

Condition **Heart Disease** · Medicine **Atorvastatin** · Life Stage **Postmenopause** ·
Hormone Therapy **Any** → the result is shown by default. You'll see:

- **AMIRA Evidence Level: LEVEL 2 OF 5 — Women Analyzed**
- **18,452** women studied · **41%** of participants across **24** studies
- **6 / 24** sex-specific outcomes · **1 / 24** menopause · **0 / 24** hormone therapy · **0 / 24** pregnancy
- Study mix: 12 RCT · 7 Observational · 3 Post-hoc · 2 Other
- "What we found" / "What is still missing" (all "in the reviewed studies")
- A 24-row study table — click any row to open the **source drawer**

## 5-minute founder checklist

- [ ] `/amira/check-evidence` loads and the question is obvious
- [ ] Evidence Level shows **Level 2 of 5 — Women Analyzed**
- [ ] The five metric cards show 18,452 / 6-24 / 1-24 / 0-24 / 0-24, each labeled **DEMO DATA**
- [ ] "What we found" and "What is still missing" read clearly, bounded to "reviewed studies"
- [ ] Clicking a study row opens the source drawer (status: Demo data, human verified: No)
- [ ] Open Benchmark is a top-level nav item and loads
- [ ] Dataset vs benchmark are clearly distinguished
- [ ] **Download CSV**, **Download JSONL**, **Download Benchmark**, **Schema**, and the full **ZIP** all download real files
- [ ] Evaluation shows **PENDING / NOT YET EVALUATED** (no fake scores)
- [ ] Research Map coverage matrix loads with highest gaps
- [ ] Methodology explains the reusable AI infrastructure + the 1–5 model + the two states
- [ ] No medical advice or unsupported clinical claim appears anywhere
- [ ] Mobile layout is usable (no sideways scrolling)

## What the downloads contain

Every download is generated from the one deterministic fixture
(`ui/src/data/amira_demo_evidence.json`) and matches the on-screen numbers:

- `amira_evidence_dataset.csv` / `.jsonl` — 24 structured sample studies
- `amira_benchmark.jsonl` (+ train/validation/test splits) — 30 human-labeled sample examples (18/6/6)
- `amira_evidence_schema.json` — the schema
- `amira-open-evidence-v1-demo.zip` — the full package (dataset, benchmark splits, schema, README, dataset card, data dictionary, labeling guide, methodology, limitations)

Every file states: *"DEMO DATA FOR HACKATHON PROTOTYPE. NOT VALIDATED CLINICAL EVIDENCE."*

## The core message the mockup makes clickable

**High female representation does not automatically mean complete women-specific or
hormone-aware evidence.** Women were studied (18,452), yet menopause (1/24), hormone
therapy (0/24), and most sex-specific outcomes (18/24 missing) were not reported in the
reviewed studies. The dataset and benchmark are the reusable scientific asset; the app
shows why that foundation matters.

## Note on visual proof

Screenshot capture times out in this build environment (a known quirk here). All four
routes, the source drawer, the client-side + static downloads (verified serving: ZIP +
24-row CSV), and a mobile pass (no horizontal overflow) were confirmed against the live
DOM with zero console errors. 16 frontend tests + 51 backend tests pass. Re-run the local
steps above to see it live in under a minute.
