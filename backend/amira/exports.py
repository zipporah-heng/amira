"""CSV / JSONL exports generated from the SAME normalized records the API serves.

This is what guarantees the UI, the API and the downloadable dataset agree
numerically: there is one source of records and one export path.
"""

from __future__ import annotations

import csv
import io
import json
from typing import List

from . import dataset

TRIAL_COLUMNS = [
    "trial_id", "nct_id", "display_name", "medicine", "condition", "study_type",
    "total_enrollment", "total_enrollment_basis",
    "female_n", "female_n_basis", "female_pct", "female_pct_basis",
    "sex_specific_efficacy_reported", "sex_specific_safety_reported",
    "menopause_status_reported", "hormone_therapy_reported",
    "pregnancy_evidence_reported",
    "minimum_age", "sex_eligibility", "start_date", "completion_date",
    "registry_url", "has_registry_results",
]

ASSERTION_COLUMNS = [
    "assertion_id", "trial_id", "dimension", "value", "value_basis",
    "source_id", "source_type", "nct_id", "pmid", "pmcid", "source_url",
    "exact_passage", "source_locator", "source_verified", "human_verified",
    "verifier", "retrieved_at", "notes",
]


def trial_rows() -> List[dict]:
    rows = []
    for t in dataset.trials():
        tid = t["trial_id"]
        f_count, f_basis, _ = dataset.assertion_value(tid, "female_enrollment_count")
        f_pct, p_basis, _ = dataset.assertion_value(tid, "female_enrollment_pct")
        total, t_basis, _ = dataset.assertion_value(tid, "total_enrollment")
        row = {
            "trial_id": tid,
            "nct_id": t["nct_id"],
            "display_name": t["display_name"],
            "medicine": t["medicine"],
            "condition": t["condition"],
            "study_type": t["study_type"],
            "total_enrollment": total if t_basis != "absent" else t["enrollment_actual"],
            "total_enrollment_basis": t_basis,
            "female_n": f_count if f_basis == "reported" else "",
            "female_n_basis": f_basis,
            "female_pct": f_pct if p_basis in ("reported", "derived") else "",
            "female_pct_basis": p_basis,
            "minimum_age": t.get("minimum_age"),
            "sex_eligibility": t.get("sex_eligibility"),
            "start_date": t.get("start_date"),
            "completion_date": t.get("completion_date"),
            "registry_url": t["registry_url"],
            "has_registry_results": t.get("has_registry_results"),
        }
        for dim in ("sex_specific_efficacy_reported", "sex_specific_safety_reported",
                    "menopause_status_reported", "hormone_therapy_reported",
                    "pregnancy_evidence_reported"):
            v, b, _ = dataset.assertion_value(tid, dim)
            row[dim] = v if b != "absent" else "not_reported"
        rows.append(row)
    return rows


def assertion_rows() -> List[dict]:
    rows = []
    for a in dataset.assertions():
        s = dataset.source_by_id(a["source_id"])
        rows.append({
            "assertion_id": a["assertion_id"],
            "trial_id": a["trial_id"],
            "dimension": a["dimension"],
            "value": "" if a["value"] is None else a["value"],
            "value_basis": a["value_basis"],
            "source_id": s["source_id"],
            "source_type": s["source_type"],
            "nct_id": s.get("nct_id") or "",
            "pmid": s.get("pmid") or "",
            "pmcid": s.get("pmcid") or "",
            "source_url": s["url"],
            "exact_passage": a["exact_passage"],
            "source_locator": a.get("source_locator") or "",
            "source_verified": a.get("source_verified", False),
            "human_verified": a.get("human_verified", False),
            "verifier": a.get("verifier") or "",
            "retrieved_at": a.get("retrieved_at") or "",
            "notes": a.get("notes") or "",
        })
    return rows


def _csv(rows: List[dict], columns: List[str]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue()


def _jsonl(rows: List[dict]) -> str:
    return "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)


def trials_csv() -> str:
    return _csv(trial_rows(), TRIAL_COLUMNS)


def trials_jsonl() -> str:
    return _jsonl(trial_rows())


def assertions_csv() -> str:
    return _csv(assertion_rows(), ASSERTION_COLUMNS)


def assertions_jsonl() -> str:
    return _jsonl(assertion_rows())


FINDING_COLUMNS = [
    "finding_id", "medicine", "drug_class", "scope", "finding_type", "endpoint",
    "female_estimate", "male_estimate", "effect_measure", "female_ci", "male_ci",
    "female_rate", "male_rate", "comparison_test", "comparison_p", "significance",
    "interpretation", "source_id", "source_url", "exact_passage", "source_locator",
    "source_verified", "human_verified", "verifier",
]


def finding_rows() -> List[dict]:
    rows = []
    for f in dataset.findings():
        s = dataset.source_by_id(f["source_id"])
        rows.append({
            **{k: f.get(k, "") if f.get(k) is not None else "" for k in FINDING_COLUMNS
               if k not in ("source_url",)},
            "source_url": s["url"],
        })
    return rows


def findings_csv() -> str:
    return _csv(finding_rows(), FINDING_COLUMNS)


def findings_jsonl() -> str:
    return _jsonl(finding_rows())
