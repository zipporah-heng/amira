# Founder verification — AMIRA real data recovery

Everything below is **real evidence**, retrieved from ClinicalTrials.gov, PubMed and
PubMed Central. There is no synthetic data in the product.

## Run it

```bash
python pipeline/ingest.py && python pipeline/build_benchmark.py
cd ui && npm ci && npm run build && cd ..
uvicorn main:app --app-dir backend --port 8000
```

Open **http://localhost:8000/amira/check-evidence**.

*(Staging: `render.yaml` ships a Render blueprint. The "New → Blueprint → Apply" click
needs a Render account, which I don't have access to — that step is yours.)*

## The 13-step walkthrough

| # | Step | What you should see |
|---|---|---|
| 1 | Medicine → **Rosuvastatin** | Corpus: JUPITER, HOPE-3 |
| 2 | Life Stage → **Postmenopause** | — |
| 3 | Hormone Therapy → **Yes** | — |
| 4 | Click **Check Evidence** | Page recalculates from `POST /api/check-evidence` |
| 5 | Recalculated real evidence | Level **2 of 5 — Women Analyzed** (derived); 6,801 women; 1/2 · 0/2 · 0/2 · 0/2 |
| 6 | Open a study source | Click a table row → drawer lists every assertion with its exact passage |
| 7 | Verify source links | JUPITER → NCT00239681, HOPE-3 → NCT00468923, PMID 20176986, PMID 27040132, PMC8370761 — all resolve |
| 8 | Download CSV | `/api/download/evidence_assertions.csv` (and `trials.csv`) |
| 9 | Download JSONL | `/api/download/evidence_assertions.jsonl` |
| 10 | Numbers match | CSV women = 6,801 = UI = API; participants = 30,507 in all three (test-locked) |
| 11 | Open benchmark | `/amira/open-benchmark` |
| 12 | Real passages | 30 verbatim passages, each with NCT/PMID/PMCID and a live source link |
| 13 | Evaluation | **EVALUATION PENDING** — no scores are claimed |

## What changing the filters actually does

- **Life stage → any specific stage** → bounded response: *"No trial in the reviewed
  corpus reports menopausal status… the trials restricted enrolment by age, but age is
  not used to infer menopausal status."*
- **Hormone therapy → Yes/No** → bounded response naming that no trial reports hormone
  therapy use. `Any` applies no filter.
- **Medicine → Atorvastatin** → `medicine_not_in_corpus` with the supported list.

## Two honest boundaries you should know about

1. **HOPE-3 publishes no exact female count.** Only "46% of the study population"
   exists (PMC8370761). So the headline is **6,801** (JUPITER, reported) and the
   combined 12,645 figure is shown separately, labelled
   `mixed_reported_and_derived`. I did not invent a HOPE-3 count.
2. **Nothing is marked human-verified.** All 16 assertions are *source-verified*
   (machine-checked against the retrieved source), but I am not a human verifier and
   did not set that flag. [`VERIFICATION_WORKSHEET.md`](VERIFICATION_WORKSHEET.md)
   lists all 16 with direct source links for sign-off.

## Submission gate status

| Gate | Status |
|---|---|
| Every study row links to a real source | ✅ |
| Every displayed number reproducible | ✅ `pipeline/ingest.py` regenerates it |
| Check Evidence performs real filtering | ✅ dataset-backed |
| Life stage changes the evidence context | ✅ |
| Hormone therapy changes the evidence context | ✅ |
| Maturity level is derived | ✅ never stored; test-locked |
| Benchmark contains only real passages | ✅ 30 verbatim, 5 sources |
| Synthetic evidence absent from production | ✅ build guard fails on any marker |
| No example.org URLs remain | ✅ |
| UI, API, CSV and JSONL agree numerically | ✅ test-locked |
| Open package: data, schema, benchmark, code, docs | ✅ |
| **Every assertion human verified** | ⬜ **awaiting your sign-off** |
| **Real evaluation results published** | ⬜ **blocked on the above** |

The last two gates require a human. I've built everything up to them and made them
one-file changes.
