# AMIRA — Evidence Intelligence Platform

*Count women. Study women. Care for women.*

> **The question AMIRA answers:** *"What does the evidence show for women?"*

### Counted is not the same as studied

A trial can enrol thousands of women and still never analyse whether the medicine worked
differently in them. Women get counted; they don't always get studied. That gap is
invisible in a normal drug label — AMIRA makes it visible and measurable.

For any medicine, AMIRA shows:

- **how well it was studied in women** — a 1-to-5 Evidence Maturity level
- **whether effectiveness was analysed by sex** — and whether a real statistical test backs it
- **whether safety was analysed by sex**
- **what important evidence is missing** — menopause status, hormone therapy, and more
- **where every number came from** — each claim links to the trial registry or publication

AMIRA measures **evidence completeness**. It does **not** diagnose, prescribe, recommend
treatment, tell anyone whether a medicine is safe for them, or rank medicines by how well
they work.

*Try it: **[amira-d8l6.onrender.com](https://amira-d8l6.onrender.com/amira/check-evidence)***

---

---

## Everything shown is real

There is **no synthetic evidence** in this repository. Every number the UI shows is
computed from a normalized dataset built by [`pipeline/ingest.py`](pipeline/ingest.py)
from live **ClinicalTrials.gov**, **PubMed** and **PubMed Central** records, and every
assertion carries an exact source passage and a resolvable URL.

**Frozen corpus v2.0.0** (source cutoff 2026-07-18):

| Condition | Class | Medicine | Trials | Sources |
|---|---|---|---|---|
| CV prevention | Statin | Rosuvastatin | JUPITER ([NCT00239681](https://clinicaltrials.gov/study/NCT00239681)), HOPE-3 ([NCT00468923](https://clinicaltrials.gov/study/NCT00468923)) | + Mora 2010 (PMID 20176986) |
| CV prevention | Statin | Atorvastatin | CARDS ([NCT00327418](https://clinicaltrials.gov/study/NCT00327418)) | PMID 15325833 |
| CV prevention | Statin | *Class-level* | 27 statin trials | CTT (PMID 25579834) |
| Heart failure | SGLT2 inhibitor | Dapagliflozin | DAPA-HF ([NCT03036124](https://clinicaltrials.gov/study/NCT03036124)) | Butt 2021 sex analysis (PMID 33787831 / PMC8014207) |

**Corpus at a glance:** 4 Phase 3 RCT records · 6 linked publications · 10 included
evidence sources · 31 evidence assertions · 5 sex-specific findings · 15 screening
decisions · 30 benchmark passages (18 development / 6 validation / 6 frozen held-out
test). Reproduce these counts with `python pipeline/validate.py`.

**Two contrasting real cases.** Rosuvastatin shows women counted + analysed but *no formal
drug-specific interaction test*. **Dapagliflozin** shows the stronger case: a prespecified
DAPA-HF sex analysis with a **real interaction test** — women HR 0.79 (95% CI 0.59–1.06) vs men
HR 0.73 (0.63–0.85), **P interaction = 0.67** — plus sex-stratified safety. AMIRA distinguishes
*evidence that exists* from *evidence that is missing*, rather than always returning "insufficient".

### The four questions, answered from real data

| Question | Rosuvastatin answer | Source |
|---|---|---|
| **How well studied in women?** | **2 / 5 — Women Analyzed** (derived) | 6,801 women reported |
| **Did effectiveness differ?** | **Sex-specific analysis reported, statistical comparison unclear** — women HR 0.54 (95% CI 0.37–0.80) vs men HR 0.58 (0.45–0.73), but no formal rosuvastatin-specific interaction test located. *Class-level* heterogeneity-by-sex p=0.33 (CTT) is shown separately and does not drive the drug-specific result | PMID 20176986; PMID 25579834 (class-level) |
| **Did side effects differ?** | **Insufficient sex-specific safety evidence** — 0 of 2 rosuvastatin trials reported adverse events by sex | evidence gap |
| **How does the class compare?** | 1 statin has a verified maturity score; 2 represented (atorvastatin's is **Not yet established** — female count not located) | class comparison |

| Fact | Value | Basis |
|---|---|---|
| Participants (rosuvastatin corpus) | 30,507 | reported |
| Women with an exact published count | **6,801** (JUPITER) | reported |
| HOPE-3 women | **46% — no exact count is published** | reported (percentage only) |
| CARDS women | **not located in retrieved sources** | not_located |
| Menopausal status / hormone therapy | 0 of 2 rosuvastatin trials | not reported |

### Five integrity rules the code enforces

1. **Reported ≠ derived.** A published count and a number AMIRA computed are never
   silently summed. Mixed figures are labelled `mixed_reported_and_derived`.
2. **Age is never used to infer menopause.** JUPITER enrolled women ≥60, HOPE-3 ≥65,
   CARDS ≥40; none advances the maturity level. Level 3 requires an explicit
   menopausal-status report.
3. **Significance is never inferred.** A finding may only claim "significant" or "no
   significant difference" when it records an actual reported statistical comparison.
   Absence of a comparison yields *insufficient*, never *no difference*.
4. **Evidence strength ≠ effectiveness.** The class comparison ranks how well each
   medicine was *studied* in women. It never claims one drug outperforms another; a build
   test fails on superiority language.
5. **Nothing unverified is marked verified.** All assertions and findings are
   *source-verified* (machine-checked against the retrieved source); **none** has named
   human sign-off, so `human_verified` is `false` throughout. See
   [`VERIFICATION_WORKSHEET.md`](VERIFICATION_WORKSHEET.md).

---

## Quick start

```bash
# 1. Build the dataset from live sources (requires network)
python pipeline/ingest.py
python pipeline/build_benchmark.py

# 2. Backend
cd backend && python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt && cd ..

# 3. UI
cd ui && npm ci && npm run build && cd ..

# 4. Run (API + UI on one URL)
uvicorn main:app --app-dir backend --port 8000
```

Open **http://localhost:8000** → redirects to `/amira/check-evidence`.

```bash
cd backend && .venv/Scripts/python -m pytest -q    # 78 integrity + build-guard tests

# Offline reproducibility check (no network): validates the committed corpus
python pipeline/validate.py
```

## API

`POST /api/check-evidence` — body: `condition`, `medicine`, `life_stage`,
`hormone_therapy`. Every response carries `dataset_version`, `source_cutoff`,
`commit_hash`, `generated_at` and resolvable source links.

Changing **life stage** or **hormone therapy** changes the returned evidence context;
because no trial in the corpus reports either, specific selections return a **bounded
response** naming exactly what is missing. Unsupported medicines return
`medicine_not_in_corpus` rather than a guess.

Other endpoints: `/api/trials`, `/api/evidence-assertions`, `/api/screening-log`,
`/api/benchmark`, `/api/manifest`, and downloads under `/api/download/*.csv|.jsonl`
generated from the *same* records the API serves.

## Benchmark

30 verbatim passages from the five corpus sources — 18 development / 6 validation /
6 frozen held-out test. Labels are rule-drafted and marked
`pending_human_review`. **No evaluation has been run**, so the UI displays
**EVALUATION PENDING** and no accuracy figure is claimed.

## Documentation

- [Inclusion / exclusion protocol](docs/inclusion-exclusion-protocol.md) (+ [screening log](dataset/screening_log.json))
- [Dataset card](docs/dataset-card.md) · [Data dictionary](docs/data-dictionary.md)
- [Methodology](docs/methodology.md) — source hierarchy, maturity model, labeling, benchmark, evaluation
- [Limitations and licensing](docs/limitations-and-licensing.md)
- [Verification worksheet](VERIFICATION_WORKSHEET.md) — every assertion and finding with its source link

## Scientific status

AMIRA reports its own limits as plainly as its results:

- **Every assertion and finding is source-verified** — machine-checked against the
  retrieved primary source, each with an exact passage and a resolvable URL.
- **Named human sign-off is still outstanding**, so `human_verified` is `false`
  throughout the dataset. Nothing is presented as human-verified.
- **Benchmark labels are rule-drafted** and marked `pending_human_review`.
- **No model evaluation has been run**, so the product displays **EVALUATION PENDING**
  and claims **no accuracy figure**.
