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
    "trial_id", "nct_id", "display_name", "medicine", "drug_class", "condition",
    "study_phase", "study_type",
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
        # Trusted values + never-collapsed states ONLY through the canonical
        # projection — identical rule to the API and aggregates, so every surface
        # makes the same trust decision.
        te = dataset.total_enrollment_projection(tid)
        cv = dataset.evidence_projection(tid, "female_enrollment_count", require_numeric=True)
        pv = dataset.evidence_projection(tid, "female_enrollment_pct", require_numeric=True)
        row = {
            "trial_id": tid,
            "nct_id": t["nct_id"],
            "display_name": t["display_name"],
            "medicine": t["medicine"],
            "drug_class": t.get("drug_class"),
            "condition": t["condition"],
            # Health Area for the Research Map hierarchy (categorization via taxonomy;
            # not exported to CSV — not in TRIAL_COLUMNS — so the frozen CSV is unchanged).
            "health_area": dataset.health_area_of(t["condition"]),
            "study_phase": t.get("study_phase"),
            "study_type": t["study_type"],
            # Fail-closed: an evidence-backed total is exported ONLY when a
            # `total_enrollment` assertion is actually reported. When the assertion
            # is absent/not_reported/not_located we leave the cell blank rather than
            # leaking trials.json::enrollment_actual as a normal total. Value and
            # basis stay inseparable, and this matches engine.aggregate_participants,
            # which only counts a `reported` total.
            "total_enrollment": te["value"] if te["coverage"] == "complete" else "",
            "total_enrollment_basis": te["basis"],
            "female_n": cv["value"] if (cv["trusted"] and cv["basis"] == "reported") else "",
            "female_n_basis": cv["state"],
            "female_pct": pv["value"] if pv["trusted"] else "",
            "female_pct_basis": pv["state"],
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
            # Canonical fail-closed categorical: a verified affirmative keeps its
            # value; anything untrusted (absent/not_located/conflict/unverified/
            # invalid) is exported as its explicit state — never silently downgraded
            # to a "not_reported" claim about the underlying literature.
            row[dim] = dataset.displayed_categorical(tid, dim)
        rows.append(row)
    return rows


# Export fields that are presented as evidence-backed, mapped to the assertion
# dimension that must support them and the value bases that are acceptable.
# General invariant: a non-empty evidence-backed export field must have a
# corresponding assertion with an acceptable basis AND a linked source.
EVIDENCE_BACKED_FIELDS = {
    "total_enrollment": ("total_enrollment", {"reported"}),
    "female_n": ("female_enrollment_count", {"reported"}),
    "female_pct": ("female_enrollment_pct", {"reported", "derived"}),
}


def evidence_backed_export_violations(rows: List[dict] | None = None) -> List[dict]:
    """Verify the evidence boundary on the export surface: any non-empty
    evidence-backed field must be supported by an assertion with an acceptable
    basis and a resolvable source. Returns a list of
    ``{"trial_id", "dimension", "reason"}`` for every violation (empty when the
    corpus is fully evidenced, so this never false-fails on the frozen corpus)."""
    rows = trial_rows() if rows is None else rows
    violations: List[dict] = []
    for r in rows:
        tid = r.get("trial_id")
        for field, (dimension, ok_bases) in EVIDENCE_BACKED_FIELDS.items():
            val = r.get(field, "")
            if val == "" or val is None:
                continue  # a blank field makes no evidence claim
            _, basis, a = dataset.assertion_value(tid, dimension)
            if a is None:
                violations.append({"trial_id": tid, "dimension": dimension,
                                   "reason": "exported value with no supporting assertion"})
            elif basis not in ok_bases:
                violations.append({"trial_id": tid, "dimension": dimension,
                                   "reason": f"exported value with unacceptable basis '{basis}'"})
            elif not a.get("source_id"):
                violations.append({"trial_id": tid, "dimension": dimension,
                                   "reason": "exported value with no linked source"})
    return violations


# Dimensions every trial must carry an assertion for (a documented gap counts as
# present; only a wholly missing assertion — basis 'absent' — is a violation).
REQUIRED_TRIAL_DIMENSIONS = (
    "total_enrollment", "female_enrollment_count",
    "sex_specific_efficacy_reported", "sex_specific_safety_reported",
    "menopause_status_reported", "hormone_therapy_reported", "pregnancy_evidence_reported",
)
_POSITIVE_BASES = ("reported", "derived")


def required_assertion_violations() -> List[dict]:
    """Every trial must independently carry an assertion for each required
    dimension. A wholly missing assertion ('absent') is a violation even when the
    export correctly serializes blank/null for it."""
    out: List[dict] = []
    for t in dataset.trials():
        tid = t["trial_id"]
        for dim in REQUIRED_TRIAL_DIMENSIONS:
            _, basis, a = dataset.assertion_value(tid, dim)
            if a is None or basis == "absent":
                out.append({"trial_id": tid, "dimension": dim, "reason": "missing assertion (absent)"})
    return out


def _source_resolves(source_id) -> tuple:
    if not source_id:
        return False, "missing source_id"
    try:
        s = dataset.source_by_id(source_id)
    except dataset.DatasetError:
        return False, "dangling source_id"
    if not dataset.authoritative_url_ok(s.get("url", "")):
        return False, "source has no valid authoritative https URL"
    return True, ""


def source_integrity_violations() -> List[dict]:
    """Every evidence-backed value must resolve to an existing, URL-bearing source;
    positive-evidence assertions (reported/derived) must also be source_verified.
    Applies equally to trial assertions, findings, direct comparisons, and trial
    primary_source_id — the same verification bar for every public record."""
    out: List[dict] = []
    for a in dataset.assertions():
        ok, why = _source_resolves(a.get("source_id"))
        if not ok:
            out.append({"trial_id": a.get("trial_id"), "dimension": a.get("dimension"),
                        "assertion_id": a.get("assertion_id"), "reason": why})
        elif a.get("value_basis") in _POSITIVE_BASES and not a.get("source_verified", False):
            out.append({"trial_id": a.get("trial_id"), "dimension": a.get("dimension"),
                        "assertion_id": a.get("assertion_id"),
                        "reason": "positive-evidence assertion is not source_verified"})
    # Findings are public evidence: the source must resolve AND be verified.
    for f in dataset.findings():
        ok, why = _source_resolves(f.get("source_id"))
        if not ok:
            out.append({"finding_id": f.get("finding_id"), "reason": why})
        elif not f.get("source_verified", False):
            out.append({"finding_id": f.get("finding_id"),
                        "reason": "public finding is not source_verified"})
    # Direct comparisons drive a public arm-vs-arm view: same bar.
    for c in dataset.direct_comparisons():
        ok, why = _source_resolves(c.get("source_id"))
        if not ok:
            out.append({"comparison_id": c.get("comparison_id"), "reason": why})
        elif not c.get("source_verified", False):
            out.append({"comparison_id": c.get("comparison_id"),
                        "reason": "direct comparison is not source_verified"})
    for t in dataset.trials():
        ok, why = _source_resolves(t.get("primary_source_id"))
        if not ok:
            out.append({"trial_id": t.get("trial_id"), "dimension": "primary_source_id", "reason": why})
    return out


def duplicate_or_conflicting_assertions() -> List[dict]:
    """At most one assertion per (trial, dimension). Multiple = duplicate;
    multiple with differing values = conflicting."""
    out: List[dict] = []
    seen: dict = {}
    for a in dataset.assertions():
        key = (a["trial_id"], a["dimension"])
        seen.setdefault(key, []).append(a)
    for (tid, dim), group in seen.items():
        if len(group) > 1:
            values = {json.dumps(g.get("value"), sort_keys=True) for g in group}
            out.append({"trial_id": tid, "dimension": dim,
                        "reason": "conflicting assertions" if len(values) > 1 else "duplicate assertions"})
    return out


def value_equality_violations() -> List[dict]:
    """A serialized evidence-backed export value must equal its assertion value."""
    out: List[dict] = []
    for r in trial_rows():
        tid = r["trial_id"]
        v, basis, a = dataset.assertion_value(tid, "total_enrollment")
        if r["total_enrollment"] != "" and (a is None or r["total_enrollment"] != v):
            out.append({"trial_id": tid, "dimension": "total_enrollment",
                        "reason": "exported total_enrollment does not equal the assertion value"})
    return out


def evidence_integrity_report() -> dict:
    """Aggregate all evidence-boundary checks. Empty lists = fully fail-closed."""
    return {
        "required_assertions": required_assertion_violations(),
        "source_integrity": source_integrity_violations(),
        "duplicates_conflicts": duplicate_or_conflicting_assertions(),
        "value_equality": value_equality_violations(),
        "export_evidence_backed": evidence_backed_export_violations(),
    }


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
        # Fail closed: an unverified finding never enters the public download surface.
        if not dataset.verified_evidence(f):
            continue
        s = dataset.source_link_safe(f["source_id"])
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
