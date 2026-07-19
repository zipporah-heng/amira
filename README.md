# AMIRA — Clearer evidence for women's health

> **The question AMIRA answers:** *"Was this medicine studied in women like me?"*

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

**Frozen corpus v1.0.0** (source cutoff 2026-07-18): rosuvastatin —
**JUPITER** ([NCT00239681](https://clinicaltrials.gov/study/NCT00239681)) and
**HOPE-3** ([NCT00468923](https://clinicaltrials.gov/study/NCT00468923)).

| Fact | Value | Basis |
|---|---|---|
| Participants across the corpus | 30,507 | reported |
| Women with an exact published count | **6,801** (JUPITER) | reported |
| HOPE-3 women | **46% — no exact count is published** | reported (percentage only) |
| Sex-specific outcomes | 1 of 2 trials | reported |
| Menopausal status | 0 of 2 trials | not reported |
| Hormone therapy use | 0 of 2 trials | not reported |
| **Derived evidence level** | **2 of 5 — Women Analyzed** | derived at request time |

### Three integrity rules the code enforces

1. **Reported ≠ derived.** A published count and a number AMIRA computed are never
   silently summed. Mixed figures are labelled `mixed_reported_and_derived`.
2. **Age is never used to infer menopause.** JUPITER enrolled women ≥60 and HOPE-3 ≥65;
   neither advances the maturity level. Level 3 requires an explicit menopausal-status
   report.
3. **Nothing unverified is marked verified.** All 16 assertions are *source-verified*
   (machine-checked against the retrieved source); **none** has named human sign-off yet,
   so `human_verified` is `false` throughout. See
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
