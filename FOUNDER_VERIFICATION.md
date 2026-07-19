# Founder verification — AMIRA clinician-first evidence platform

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
needs a Render account, which I don't have access to — that step is yours. The build
command must run `python pipeline/ingest.py` first; it needs network access.)*

## Visible without scrolling (the 5-second answer)

The top banner answers all four questions above the fold:

| Cell | Value |
|---|---|
| **Evidence maturity** | **2 / 5 — Women Analyzed** |
| **Sex-specific effectiveness** | Sex-specific analysis reported, statistical comparison unclear |
| **Sex-specific side effects** | Insufficient sex-specific safety evidence |
| **Class comparison — Statin** | 1 statin has a verified maturity score; 2 represented |

Plus a one-sentence **"Why this result"**. Each banner cell is clickable and jumps to
its detailed section.

## The 15-point checklist

| # | Check | Where |
|---|---|---|
| 1 | Evidence maturity visible without scrolling | Top banner, cell 1 |
| 2 | Sex-specific effectiveness visible without scrolling | Top banner, cell 2 |
| 3 | Sex-specific side effects visible without scrolling | Top banner, cell 3 |
| 4 | Drug class comparison visible without scrolling | Top banner, cell 4 |
| 5 | Effectiveness findings link to real sources | PMID 20176986, PMID 25579834 |
| 6 | Side-effect findings link to real sources | PMID 25579834 (class-level) |
| 7 | Significant differences visually highlighted | amber card + left rule (none present — see below) |
| 8 | Non-significant trends labelled as trends | "Trend only · not statistically significant" tag |
| 9 | All included studies visible | *Studies behind this result* table |
| 10 | Study selection methodology visible | *How studies were selected* → View screening methodology |
| 11 | Included/excluded counts reproducible | 12 screened · 8 included · 3 excluded · 1 deferred |
| 12 | Class comparison contains only verified medicines | Rosuvastatin + Atorvastatin only |
| 13 | Downloads reproduce UI values | `/api/download/*.csv|.jsonl` — test-locked |
| 14 | Benchmark passages are real | 30 verbatim passages, 5 real sources |
| 15 | No synthetic scientific claims remain | build guard test suite |

## The real numbers you should see

**Sex-specific effectiveness (rosuvastatin)** — a genuine prespecified analysis:

- Women: **HR 0.54** (95% CI 0.37–0.80, P=0.002)
- Men: **HR 0.58** (95% CI 0.45–0.73, P<0.001)
- Source: Mora et al., *Circulation* 2010, PMID 20176986 (JUPITER sex-specific analysis)
- Class-level: women **RR 0.84** vs men **RR 0.78**, **heterogeneity-by-sex p = 0.33**
  (CTT, *Lancet* 2015, PMID 25579834 — 27 trials, 46,675 women)

**Class comparison (statins, sorted by maturity):**

| Medicine | Maturity | Effectiveness | Side effects |
|---|---|---|---|
| Rosuvastatin | 2/5 Women Analyzed | Sex-specific analysis reported, comparison unclear | Insufficient |
| Atorvastatin | **Not yet established** (female count not located) | Insufficient | Insufficient |

*Atorvastatin is not scored 0/5 and is not ranked: its female enrolment count is `not_located`
(in the paywalled CARDS full text), which is incomplete coverage, not confirmed absence.*

## Four honest boundaries — please read these

1. **No significant sex-specific side-effect difference is shown, because none was
   found.** 0 of 2 rosuvastatin trials reported adverse events by sex. Checklist item 7
   therefore has nothing to highlight — the highlighting logic exists and is test-locked,
   but I will not invent a finding to demonstrate it. This is the honest state and it is
   exactly the gap AMIRA exists to expose.
2. **Atorvastatin scores 0/5 because CARDS' female count was not in the sources I
   retrieved** (registry has no posted results; the count sits in the paywalled full-text
   baseline table). It is recorded as `not_located` — an open gap, **not** a claim that
   the trial failed to report it. Ingesting the full text would likely raise this.
3. **The JUPITER effectiveness comparison has no formal interaction p-value** in the
   reviewed abstract. "No significant difference" there rests on the authors' reported
   comparison of similar relative risk reductions, plus the class-level CTT heterogeneity
   test (p=0.33). The UI states this explicitly rather than implying a test that wasn't run.
4. **Nothing is human-verified.** 23 assertions + 3 findings are *source-verified* by
   machine; none has named human sign-off.
   [`VERIFICATION_WORKSHEET.md`](VERIFICATION_WORKSHEET.md) lists all 26 with direct
   source links.

## What the filters actually do

- **Life stage → any specific stage** → bounded response: no trial reports menopausal
  status; age is not used to infer it.
- **Hormone therapy → Yes/No** → bounded response: no trial reports hormone therapy use.
- **Medicine → Pravastatin** → `medicine_not_in_corpus` with the supported list.
- **Medicine → Atorvastatin** → recalculates to its own (weaker) real evidence.

## Tests

**49 passing**, including: Phase 3 filtering, RCT identification, trial and publication
deduplication, participant double-count prevention, count-basis compatibility,
interaction-p parsing, significant-vs-trend separation, **no significance inference
without a test**, **no equality inference from absent comparison**, no age-to-menopause
inference, maturity derivation, drug-class membership, class-comparison eligibility, no
direct-efficacy-superiority claims, source URL validity, UI/API/CSV/JSONL equality, and a
production build guard rejecting `example.org`, `DEMO DATA`, synthetic claims, hard-coded
levels and retired demo constants.

## Remaining gates

- ⬜ Named human sign-off on 23 assertions + 3 findings + 30 benchmark labels
- ⬜ Real evaluation run against the frozen held-out split (currently **EVALUATION PENDING**)
