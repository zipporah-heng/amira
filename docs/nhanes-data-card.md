# NHANES Population-Context — Data Card

**Module:** Population Context — NHANES
**Cache:** `dataset/nhanes/nhanes_context_v1.json` (committed, versioned)
**Builder:** `pipeline/nhanes_context.py`
**Loader:** `backend/amira/nhanes.py` (no network, no heavy dependencies)
**Feature flag:** `AMIRA_ENABLE_NHANES` (default on)

## Purpose and boundary

This module reports **reported medication use in the surveyed U.S. population**,
by drug class, among women — from the CDC National Health and Nutrition
Examination Survey. It is **population context**, kept deliberately **separate
from AMIRA's clinical-trial evidence**.

It is **never** used to claim that a medicine:
caused an outcome · is effective · is safer · is prescribed most often · matches
a trial result · should be recommended.

The phrase shown to users is *"Reported medication use in the surveyed
population"* — never "most prescribed medicine".

## Source

| File | Purpose | Data URL |
| ---- | ------- | -------- |
| `DEMO_J` | Demographics, weights, design vars | `https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.xpt` |
| `RXQ_RX_J` | Prescription medication use | `https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/RXQ_RX_J.xpt` |

- **Cycle:** 2017–2018 (NHANES public-use files, U.S. Government public domain).
- Documentation: the `.htm` docs linked from the module and the JSON cache.

## Method

- **Domain:** women (`RIAGENDR == 2`) aged ≥ 18 (`RIDAGEYR`).
- **Measure:** any reported use of the drug class (ingredient-name match in
  `RXDDRUG`), per respondent.
- **Weights:** interview weight `WTINT2YR`.
- **Design:** masked strata `SDMVSTRA` and PSU `SDMVPSU` are respected.
- **Variance:** Taylor-series linearization of a domain proportion (a ratio
  estimator), summed across strata/PSUs. Reported as a standard error and a
  relative standard error (RSE).
- **Unweighted sample sizes** (numerator and denominator) are always reported.

### Variables used

`SEQN`, `RIAGENDR`, `RIDAGEYR`, `WTINT2YR`, `SDMVSTRA`, `SDMVPSU` (DEMO_J);
`SEQN`, `RXDDRUG` (RXQ_RX_J).

## Suppression rule (NCHS-style)

An estimate is **suppressed** — shown as *"Estimate not displayed because the
available sample is insufficient for a stable population estimate"*, never a
number — when either:

- the unweighted numerator (women reporting use) is **< 30**, or
- the relative standard error is **> 30%**.

This adapts the NCHS Data Presentation Standards for Proportions. No fabricated
value is ever shown to fill a card.

## Results in the committed cache (cycle 2017–2018)

| Drug class | Unweighted users | Weighted use % (SE) | Shown? |
| ---------- | ---------------- | ------------------- | ------ |
| Statin | 559 | 15.08% (0.99) | ✅ shown |
| Angiotensin receptor blocker | 245 | 6.81% (0.59) | ✅ shown |
| Cardiac glycoside (digoxin) | 7 | — | 🔒 suppressed |
| SGLT2 inhibitor (dapagliflozin) | 7 | — | 🔒 suppressed |

The digoxin and SGLT2 classes are correctly suppressed: their NHANES samples are
far too small for a stable population estimate. This is the honest, intended
behaviour — it demonstrates the suppression rule rather than inventing a number.

## Reproducibility

```bash
python pipeline/nhanes_context.py            # download from CDC + compute + write cache
python pipeline/nhanes_context.py --raw DIR  # use pre-downloaded DEMO_J.xpt / RXQ_RX_J.xpt
```

Only `pandas`/`numpy`/`requests` are needed, and only to (re)build the cache
offline. The application reads the committed JSON with no heavy dependencies and
no network access, so the deployed app is deterministic and offline-safe.

## Limitations

- One cycle (2017–2018); prevalence is not a time series.
- Medication use is self-reported (interview) and matched by ingredient name.
- This is population prevalence of *use*, not of *appropriateness* or *outcome*.
