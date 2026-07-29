# AMIRA Evidence Readiness — Pilot v0.1 (methodology)

**Rules version:** `0.1`
**Status:** pilot methodology under expert review. **Not a validated score.**
**Default:** **OFF** (`AMIRA_ENABLE_PILOT_SCORE=0`). The verified 1–5 Evidence
Maturity level is the primary, default-visible score; this experimental 0–100
score is shown only when explicitly enabled, and always below the maturity level.
**Implementation:** `backend/amira/readiness.py` (deterministic).
**Tests:** `backend/tests/test_readiness.py`, `backend/tests/test_studies_and_flags.py`.

## What the score measures — and what it does not

The pilot score is a 0–100 measure of the **completeness of women-specific
evidence** for a medicine. It sits alongside — and does not replace — the
scientifically implemented 1–5 Evidence Maturity level.

It does **not** measure treatment effectiveness, clinical safety, medicine
quality, or prescribing preference. Displayed beneath every score:

> This score measures the completeness of women-specific evidence—not whether
> this medicine is better.

A higher score means *more complete women-specific evidence*, never a *more
effective or safer* medicine. (Digoxin — which carries a harm signal in women —
and dapagliflozin both score 70; the score is about reporting completeness.)

## The five dimensions

Each dimension contributes up to **20 points**. The engine is deterministic: it
reads the committed evidence assertions and findings and applies fixed rules. An
LLM never influences the score.

| # | Dimension | Question |
| - | --------- | -------- |
| 1 | Included | Were women enrolled and was female participation reported? |
| 2 | Analyzed | Were women's effectiveness outcomes reported separately? |
| 3 | Compared | Was a formal sex-by-treatment comparison reported? |
| 4 | Protected | Were adverse events reported by sex and formally compared? |
| 5 | Personalized | Were menopause, hormone therapy and hormonal life stages considered? |

## Evidence states and points

| State | Points | Meaning |
| ----- | ------ | ------- |
| `complete` | 20 | Fully reported. |
| `partial` | 10 | Reported without a formal comparison, or only one of a pair. |
| `insufficient` | 0 | Some evidence, not enough to score the dimension. |
| `not_reported` | 0 | A source was reviewed and reports none. |
| `not_located` | 0 | No accessible source with this value was retrieved. |
| `excluded` | 0 | Reserved for explicit exclusions. |
| `not_applicable` | — | Genuinely N/A; **removed from the denominator**. |

`not_located` and `not_reported` are **never collapsed into "No"** — they are
distinct states with distinct meanings and are shown as such.

### Per-dimension rules (v0.1)

- **Included:** `complete` if an exact female count is reported; `partial` if
  only a percentage is reported or a count is derived; `not_located` if neither
  was retrieved; `not_reported` if a source states none is available.
- **Analyzed:** `complete` if a sex-specific effectiveness outcome is reported
  (including an explicitly women-only study); else `not_reported`/`not_located`.
- **Compared:** `complete` if a drug-specific finding reports a formal
  sex-by-treatment interaction/heterogeneity test; `partial` if effectiveness is
  reported by sex but no formal test was located; `not_applicable` for a
  women-only study (no between-sex comparison possible); else
  `not_reported`/`not_located`.
- **Protected:** `complete` if adverse events are reported by sex **and** a
  formal between-sex comparison is reported; `partial` if reported by sex but
  only within-sex (e.g. vs placebo) or narratively for women; else
  `not_reported`/`not_located`.
- **Personalized:** `complete` if both menopausal status and hormone-therapy
  context are reported; `partial` if one is; else `not_reported`/`not_located`.

## Scoring formula

```
score = round(100 * points_earned / max_eligible_points)
max_eligible_points = 20 * (number of dimensions NOT marked not_applicable)
```

Excluded (N/A) dimensions are removed from the denominator, and the adjustment is
shown to the user (e.g. Valsartan: *Compared* is N/A for a women-only study, so
the denominator is 80, and the score is `70 / 80 → 88`).

## Withholding

If the foundational **Included** evidence is only `not_located`, the whole score
is **withheld** as `not_established` — never shown as 0. This mirrors the
maturity engine and prevents incomplete source coverage from being misread as
confirmed absence of evidence (e.g. Atorvastatin, whose female count lives only
in a full text AMIRA has not ingested).

## Worked examples (from the committed corpus)

| Medicine | Included | Analyzed | Compared | Protected | Personalized | Score |
| -------- | -------- | -------- | -------- | --------- | ------------ | ----- |
| Rosuvastatin | complete | complete | partial | not_reported | not_reported | 50 / 100 |
| Dapagliflozin | complete | complete | complete | partial | not_reported | 70 / 100 |
| Digoxin | complete | complete | complete | partial | not_reported | 70 / 100 |
| Valsartan | complete | complete | *N/A* | partial | complete | 88 (70 / 80) |
| Atorvastatin | not_located | — | — | — | — | withheld |

## Governance

This is `v0.1`. The rule table above is versioned with `RULES_VERSION` in code.
Any change to weights, states, or thresholds bumps the version so published
scores remain reproducible and auditable. The methodology is under expert review
and is labelled provisional everywhere it appears.
