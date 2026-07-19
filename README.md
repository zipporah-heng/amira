# AMIRA — Evidence Intelligence Platform

*Count women. Study women. Care for women.*

> **The question AMIRA answers:** *"What does the evidence show for women?"*
>
> How well was this medicine studied in women, did effectiveness or side effects differ by sex,
> and how does the evidence compare with similar drugs?

AMIRA audits published medical research to show whether **women were represented** and
whether **sex-specific and hormone-relevant factors** were actually analysed or reported.

AMIRA measures **evidence completeness**. It does **not** diagnose, prescribe, recommend
treatment, tell anyone whether a medicine is safe for them, or rank medicines.

---

## Everything shown is real

There is **no synthetic evidence** in this repository. Every number the UI shows is
computed from a normalized dataset built by [`pipeline/ingest.py`](pipeline/ingest.py)
from live **ClinicalTrials.gov**, **PubMed** and **PubMed Central** records, and every
assertion carries an exact source passage and a resolvable URL.

**Frozen corpus v2.0.0** (source cutoff 2026-07-18) — statin class:

| Medicine | Trials | Sources |
|---|---|---|
| Rosuvastatin | JUPITER ([NCT00239681](https://clinicaltrials.gov/study/NCT00239681)), HOPE-3 ([NCT00468923](https://clinicaltrials.gov/study/NCT00468923)) | + Mora 2010 sex-specific analysis (PMID 20176986) |
| Atorvastatin | CARDS ([NCT00327418](https://clinicaltrials.gov/study/NCT00327418)) | PMID 15325833 |
| *Class-level* | 27 statin trials | CTT sex-specific meta-analysis (PMID 25579834) |

### The four questions, answered from real data

| Question | Rosuvastatin answer | Source |
|---|---|---|
| **How well studied in women?** | **2 / 5 — Women Analyzed** (derived) | 6,801 women reported |
| **Did effectiveness differ?** | **Sex-specific analysis reported, statistical comparison unclear** — women HR 0.54 (95% CI 0.37–0.80) vs men HR 0.58 (0.45–0.73), but no formal rosuvastatin-specific interaction test located. *Class-level* heterogeneity-by-sex p=0.33 (CTT) is shown separately and does not drive the drug-specific result | PMID 20176986; PMID 25579834 (class-level) |
| **Did side effects differ?** | **Insufficient sex-specific safety evidence** — 0 of 2 trials reported adverse events by sex | evidence gap |
| **How does the class compare?** | 1 statin has a verified maturity score; 2 represented (atorvastatin's is **Not yet established** — female count not located) | class comparison |

| Fact | Value | Basis |
|---|---|---|
| Participants (rosuvastatin corpus) | 30,507 | reported |
| Women with an exact published count | **6,801** (JUPITER) | reported |
| HOPE-3 women | **46% — no exact count is published** | reported (percentage only) |
| CARDS women | **not located in retrieved sources** | not_located |
| Menopausal status / hormone therapy | 0 of 2 trials | not reported |

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
cd backend && .venv/Scripts/python -m pytest -q    # 28 integrity + build-guard tests
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
- [Verification worksheet](VERIFICATION_WORKSHEET.md) · [Founder verification](FOUNDER_VERIFICATION.md)

## What remains before submission

- [ ] Named human sign-off on all 16 assertions and the 30 benchmark labels
- [ ] Run the extractor against the frozen held-out split and publish real results
