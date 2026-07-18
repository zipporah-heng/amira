# AMIRA pilot benchmark

30 human-labeled examples (20 development / 10 held-out) for evaluating structured
evidence extraction. **Pilot benchmark — small scale; does not prove broad
generalization.**

- Data: [`pilot_benchmark.jsonl`](pilot_benchmark.jsonl)
- Runner: [`../eval/run_eval.py`](../eval/run_eval.py)
- Latest results: [`../eval/results/latest.json`](../eval/results/latest.json)

## Run

```bash
python eval/run_eval.py --write            # heuristic baseline, all splits, writes latest.json
python eval/run_eval.py --split heldout    # held-out only
python eval/run_eval.py --backend openai   # live model (needs OPENAI_API_KEY)
```

## Metrics reported

- Field-level accuracy (per field + overall)
- Macro-F1 across reported-status classes
- Numeric extraction accuracy (`female_n`, `female_pct`, `total_n`)
- Citation-support accuracy (affirmative claims backed by an in-passage span)
- Abstention accuracy (correctly returning `not_reported` when the label is silent)
- Held-out performance

## Baseline (heuristic, committed)

| Metric | All (30) | Held-out (10) |
|---|---|---|
| Overall field accuracy | 0.87 | 0.92 |
| Macro-F1 (reported fields) | 0.64 | — |
| Citation support | 1.00 | 1.00 |
| Abstention accuracy | 0.98 | 0.98 |
| Numeric extraction | 0.51 | 0.50 |

The heuristic is a transparent rule-based baseline included so the eval is reproducible
without an API key and so there is headroom to score the live model against. Citation
support is 1.00 by construction: the shared pipeline downgrades any uncited affirmative
claim to abstention (fail closed).

## Labeling rubric

Each reported-status field is labeled from the passage alone:

- **`yes`** — the passage explicitly reports/analyzes the factor.
- **`no`** — the passage explicitly states the factor was *not* done.
- **`uncertain`** — the passage mentions the factor but is ambiguous.
- **`not_reported`** — the passage is silent on the factor (the most common label, and
  the correct answer for abstention).

Numbers are labeled only when explicitly present in the passage; otherwise `null`.
`expected_abstention` is `true` when the passage is silent on the menopause/hormone
fields.
