"""Submission-corrections mission: licensing, benchmark truthfulness, and the
Dapagliflozin truncation/inconclusive fix (API-level)."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

import main

REPO = Path(__file__).resolve().parents[2]
client = TestClient(main.app)


# --- Licensing ------------------------------------------------------------- #
def test_license_files_present():
    assert (REPO / "LICENSE").exists(), "Apache-2.0 LICENSE must be present"
    licenses = (REPO / "LICENSES.md").read_text(encoding="utf-8")
    assert "Apache License" in (REPO / "LICENSE").read_text(encoding="utf-8")
    assert "CC BY 4.0" in licenses
    # Third-party material notice: publication text is not relicensed.
    assert "not relicensed" in licenses.lower()
    assert "no ownership of any source publication text" in licenses.lower()


def test_assets_api_reports_licensing():
    a = client.get("/api/assets").json()
    assert a["license_present"] is True
    assert a["licenses"]["code"] == "Apache-2.0"
    assert a["licenses"]["content"] == "CC-BY-4.0"
    assert any("not relicensed" in s.lower() for s in a["honest_status"])


# --- Benchmark truthfulness ------------------------------------------------ #
def test_benchmark_uses_draft_label_not_gold_label():
    lines = (REPO / "benchmark" / "amira_benchmark.jsonl").read_text(encoding="utf-8").splitlines()
    items = [json.loads(l) for l in lines if l.strip()]
    assert items and all("draft_label" in it for it in items)
    assert all("gold_label" not in it for it in items)


def test_benchmark_manifest_has_completion_protocol_and_no_accuracy():
    m = json.loads((REPO / "benchmark" / "benchmark_manifest.json").read_text(encoding="utf-8"))
    assert m["annotation_status"] == "pending_human_review"
    assert m["human_verified_items"] == 0
    assert isinstance(m.get("completion_protocol"), list) and len(m["completion_protocol"]) >= 3
    assert m.get("label_field") == "draft_label"
    # 30-passage 18/6/6 structure unchanged.
    assert (m["total"], m["development"], m["validation"], m["held_out"]) == (30, 18, 6, 6)


def test_benchmark_api_is_evaluation_pending_with_no_accuracy_claim():
    b = client.get("/api/benchmark").json()
    ev = b.get("evaluation", {})
    assert ev.get("status") in ("EVALUATION PENDING", None) or "PENDING" in str(ev)
    assert ev.get("clinical_accuracy") in (None, "null")
    assert ev.get("macro_f1") in (None, "null")


# --- Dapagliflozin path (API) ---------------------------------------------- #
def test_dapagliflozin_path_full_ci_and_inconclusive():
    r = client.post("/api/check-evidence", json={"medicine": "Digoxin", "condition": "Heart failure"}).json()
    dapa = next(p for p in r["other_evidence_paths"] if p["medicine"] == "Dapagliflozin")
    assert "0.79" in dapa["headline"] and "0.59-1.06" in dapa["headline"]
    assert dapa["ci_crosses_one"] is True
    note = dapa["interpretation_note"].lower()
    assert "inconclusive" in note and "possible benefit" in note
    # Never positively described as superior / a replacement / better than Digoxin.
    blob = json.dumps(dapa).lower()
    for banned in ("superior", "replacement", "better than digoxin"):
        assert banned not in blob
    # "recommendation" may appear only inside the negation "not a ... treatment recommendation".
    assert "recommend" not in blob.replace("not a head-to-head comparison or treatment recommendation.", "")
