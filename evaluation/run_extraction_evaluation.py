"""Evaluation harness for AMIRA-Extract.

IMPORTANT — what this does and does NOT claim:

  * It reports PROCESS metrics: schema-validity rate and exact-quote verification
    rate across the corpus passages. These measure whether the extractor produces
    well-formed, source-grounded output.
  * It does NOT claim a clinical-accuracy figure. The benchmark labels are
    ``pending_human_review`` — no gold standard has been signed off by a named
    reviewer, so any accuracy/F1 number would be unfounded. The harness therefore
    reports ``clinical_accuracy: null`` with an explicit "evaluation pending"
    status until reviewed labels exist.

Writing ``evaluation/results.json`` keeps the API honest: ``/api/benchmark``
surfaces this status verbatim.

Usage:
    python evaluation/run_extraction_evaluation.py           # print report
    python evaluation/run_extraction_evaluation.py --write   # + write results.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from amira import dataset, extract  # noqa: E402

RESULTS_PATH = REPO / "evaluation" / "results.json"
# Pinned to the dataset build time so the report is deterministic (no wall clock).
_RUN_TIMESTAMP = "2026-07-20T18:42:00Z"


def run() -> dict:
    passages = extract.approved_passages()
    total = len(passages)
    schema_valid = 0
    quote_verified = 0
    per_item = []
    for p in passages:
        obj = extract.extract_and_validate(p["passage"], p)
        errs = extract._schema_errors(obj)
        is_schema_valid = not errs
        schema_valid += is_schema_valid
        quote_verified += obj["validation_state"] == "quote_verified"
        per_item.append({
            "passage_id": p["passage_id"],
            "medicine": p["medicine"],
            "schema_valid": is_schema_valid,
            "validation_state": obj["validation_state"],
        })

    manifest = dataset.manifest()
    return {
        "status": "EVALUATION PENDING",
        "evaluation_type": "process_metrics_only",
        "run_at": _RUN_TIMESTAMP,
        "provider": extract.provider_config(),
        "dataset_version": manifest["dataset_version"],
        "corpus_passages_evaluated": total,
        "schema_validity_rate": round(schema_valid / total, 3) if total else None,
        "quote_verification_rate": round(quote_verified / total, 3) if total else None,
        "clinical_accuracy": None,
        "macro_f1": None,
        "note": (
            "Process metrics only. No clinical-accuracy figure is claimed: the benchmark labels are "
            "pending human review, so there is no gold standard to score against. A validated accuracy "
            "figure will be reported only after named human sign-off of the benchmark labels."
        ),
        "per_item": per_item,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="write evaluation/results.json")
    args = ap.parse_args()

    report = run()
    print("AMIRA-Extract evaluation (process metrics only)")
    print(f"  provider              : {report['provider']['provider']}")
    print(f"  passages evaluated    : {report['corpus_passages_evaluated']}")
    print(f"  schema validity rate  : {report['schema_validity_rate']}")
    print(f"  quote verification    : {report['quote_verification_rate']}")
    print(f"  clinical accuracy     : {report['clinical_accuracy']} (evaluation pending)")

    if args.write:
        RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        RESULTS_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nwrote {RESULTS_PATH.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
