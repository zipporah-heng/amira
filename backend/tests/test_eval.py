"""The evaluation runner must run reproducibly over the pilot benchmark."""

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "eval"))

import run_eval  # noqa: E402


def test_benchmark_has_30_rows_split_20_10():
    dev = run_eval.load_rows("dev")
    held = run_eval.load_rows("heldout")
    assert len(dev) == 20
    assert len(held) == 10


def test_eval_reports_all_metrics():
    rows = run_eval.load_rows("heldout")
    report = run_eval.evaluate(rows, "heuristic")
    for key in (
        "overall_field_accuracy",
        "per_field_accuracy",
        "macro_f1_reported",
        "numeric_accuracy",
        "citation_support_accuracy",
        "abstention_accuracy",
    ):
        assert key in report
    assert 0.0 <= report["overall_field_accuracy"] <= 1.0


def test_eval_is_deterministic():
    rows = run_eval.load_rows("dev")
    a = run_eval.evaluate(rows, "heuristic")
    b = run_eval.evaluate(rows, "heuristic")
    assert a == b


def test_citation_support_never_exceeds_one():
    report = run_eval.evaluate(run_eval.load_rows(None), "heuristic")
    # Fail-closed downgrade guarantees every affirmative claim is citation-backed.
    assert report["citation_support_accuracy"] == 1.0
