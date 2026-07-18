"""Reproducible evaluation runner for the AMIRA pilot benchmark.

Usage:
    python eval/run_eval.py                 # heuristic baseline, all splits
    python eval/run_eval.py --split heldout # held-out only
    python eval/run_eval.py --backend openai

Reports:
  * Field-level accuracy (per field and overall)
  * Macro-F1 for reported-status fields
  * Numeric extraction accuracy (female_n, female_pct, total_n)
  * Citation-support accuracy (affirmative claims backed by an in-passage span)
  * Abstention accuracy (did we correctly abstain when the label is not_reported)
  * Held-out performance

Results are written to eval/results/latest.json for the dashboard's benchmark page.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from amira.extraction.extractor import _finalize, _validate_raw  # noqa: E402

BENCHMARK = REPO / "benchmark" / "pilot_benchmark.jsonl"
RESULTS_DIR = REPO / "eval" / "results"

REPORTED_FIELDS = [
    "sex_specific_efficacy",
    "sex_specific_safety",
    "sex_treatment_interaction",
    "menopause_reported",
    "hormonal_factors_reported",
    "hormone_therapy_reported",
]
# Map benchmark label keys -> extractor field names.
LABEL_TO_FIELD = {
    "sex_specific_efficacy": "sex_stratified_efficacy_reported",
    "sex_specific_safety": "sex_stratified_safety_reported",
    "sex_treatment_interaction": "sex_by_treatment_interaction_tested",
    "menopause_reported": "menopausal_status_reported",
    "hormonal_factors_reported": "hormonal_factors_reported",
    "hormone_therapy_reported": "hormone_therapy_reported",
}
NUMERIC_FIELDS = ["female_n", "female_pct", "total_n"]
ENUM_VALUES = ["yes", "no", "uncertain", "not_reported"]


def load_rows(split: str | None):
    rows = []
    for line in BENCHMARK.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if split and row["split"] != split:
            continue
        rows.append(row)
    return rows


def run_backend(passage: str, backend: str, recorded_key=None) -> dict:
    if backend == "heuristic":
        from heuristic_extractor import extract
        raw = extract(passage)
    elif backend == "openai":  # pragma: no cover - network
        import os
        from amira.extraction.prompts import EXTRACTION_SYSTEM_PROMPT, build_user_prompt
        from openai import OpenAI
        client = OpenAI()
        resp = client.chat.completions.create(
            model=os.getenv("AMIRA_OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(passage, "benchmark")},
            ],
        )
        raw = json.loads(resp.choices[0].message.content)
    else:
        raise ValueError(f"unknown backend {backend}")
    cleaned = _validate_raw(raw)
    return _finalize(cleaned, passage)


def _macro_f1(confusion: dict) -> float:
    f1s = []
    for cls in ENUM_VALUES:
        tp = confusion["tp"][cls]
        fp = confusion["fp"][cls]
        fn = confusion["fn"][cls]
        if tp + fp + fn == 0:
            continue
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        f1s.append(f1)
    return round(sum(f1s) / len(f1s), 3) if f1s else 0.0


def evaluate(rows, backend: str) -> dict:
    field_correct = defaultdict(int)
    field_total = defaultdict(int)
    numeric_correct = defaultdict(int)
    numeric_total = defaultdict(int)
    citation_supported = 0
    citation_claims = 0
    abstain_correct = 0
    abstain_total = 0
    confusion = {"tp": defaultdict(int), "fp": defaultdict(int), "fn": defaultdict(int)}

    for row in rows:
        result = run_backend(row["passage"], backend)

        # Reported enum fields
        for label_key in REPORTED_FIELDS:
            field = LABEL_TO_FIELD[label_key]
            gold = row[label_key]
            pred = result.fields[field].value
            field_total[label_key] += 1
            if pred == gold:
                field_correct[label_key] += 1
                confusion["tp"][gold] += 1
            else:
                confusion["fp"][pred] += 1
                confusion["fn"][gold] += 1
            # Abstention accuracy (gold == not_reported)
            if gold == "not_reported":
                abstain_total += 1
                if pred == "not_reported":
                    abstain_correct += 1
            # Citation support: affirmative pred must be citation_verified
            if pred in ("yes", "no", "uncertain"):
                citation_claims += 1
                if result.fields[field].citation_verified:
                    citation_supported += 1

        # Numerics
        for nf in NUMERIC_FIELDS:
            gold = row.get(nf)
            pred = result.fields[nf].value
            numeric_total[nf] += 1
            if gold is None and pred is None:
                numeric_correct[nf] += 1
            elif gold is not None and pred is not None and abs(float(pred) - float(gold)) < 0.5:
                numeric_correct[nf] += 1

    overall_field_acc = round(
        sum(field_correct.values()) / max(1, sum(field_total.values())), 3
    )
    numeric_acc = {
        nf: round(numeric_correct[nf] / max(1, numeric_total[nf]), 3) for nf in NUMERIC_FIELDS
    }
    return {
        "backend": backend,
        "n_examples": len(rows),
        "overall_field_accuracy": overall_field_acc,
        "per_field_accuracy": {
            k: round(field_correct[k] / max(1, field_total[k]), 3) for k in REPORTED_FIELDS
        },
        "macro_f1_reported": _macro_f1(confusion),
        "numeric_accuracy": numeric_acc,
        "numeric_accuracy_overall": round(
            sum(numeric_correct.values()) / max(1, sum(numeric_total.values())), 3
        ),
        "citation_support_accuracy": round(citation_supported / max(1, citation_claims), 3),
        "citation_claims_evaluated": citation_claims,
        "abstention_accuracy": round(abstain_correct / max(1, abstain_total), 3),
        "abstention_cases": abstain_total,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["dev", "heldout"], default=None)
    ap.add_argument("--backend", default="heuristic", choices=["heuristic", "openai"])
    ap.add_argument("--write", action="store_true", help="write results/latest.json")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(__file__).resolve().parent))

    report = {
        "benchmark": "AMIRA pilot benchmark (30 examples: 20 dev / 10 held-out)",
        "note": "Pilot benchmark. Small scale; does not prove broad generalization.",
        "backend": args.backend,
        "splits": {},
    }
    for split in (["dev", "heldout"] if args.split is None else [args.split]):
        report["splits"][split] = evaluate(load_rows(split), args.backend)
    report["splits"]["all"] = evaluate(load_rows(None), args.backend)

    print(json.dumps(report, indent=2))
    if args.write:
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        (RESULTS_DIR / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nWrote {RESULTS_DIR / 'latest.json'}")
    return report


if __name__ == "__main__":
    main()
