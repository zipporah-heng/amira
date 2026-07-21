"""Loader for the normalized real-evidence dataset.

The API, the UI and the downloadable CSV/JSONL all read through this module, so
there is exactly one set of numbers in the system.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

DATASET_DIR = Path(__file__).resolve().parents[2] / "dataset"

# Evidence dimensions AMIRA tracks, in display order.
DIMENSIONS = [
    "female_enrollment_count",
    "female_enrollment_pct",
    "total_enrollment",
    "sex_specific_efficacy_reported",
    "sex_specific_safety_reported",
    "menopause_status_reported",
    "hormone_therapy_reported",
    "outcomes_stratified_by_life_stage_and_hormone_context",
    "pregnancy_evidence_reported",
]

# Values that count as an affirmative report.
AFFIRMATIVE = "yes"


class DatasetError(RuntimeError):
    """Raised when the dataset is missing or internally inconsistent."""


def _read(name: str) -> Any:
    path = DATASET_DIR / f"{name}.json"
    if not path.exists():
        raise DatasetError(
            f"dataset file missing: {path}. Run `python pipeline/ingest.py` to build it."
        )
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load() -> Dict[str, Any]:
    data = {
        "manifest": _read("manifest"),
        "trials": _read("trials"),
        "source_documents": _read("source_documents"),
        "evidence_assertions": _read("evidence_assertions"),
        "findings": _read("findings"),
        "direct_comparisons": _read("direct_comparisons"),
        "screening_log": _read("screening_log"),
    }
    _validate(data)
    return data


def _validate(data: Dict[str, Any]) -> None:
    trials = data["trials"]
    sources = {s["source_id"] for s in data["source_documents"]}
    trial_ids = {t["trial_id"] for t in trials}

    # NCT de-duplication: one trial per NCT id, no repeats.
    ncts = [t["nct_id"] for t in trials if t.get("nct_id")]
    if len(ncts) != len(set(ncts)):
        raise DatasetError(f"duplicate NCT ids in trials: {ncts}")

    for a in data["evidence_assertions"]:
        if a["trial_id"] not in trial_ids:
            raise DatasetError(f"assertion {a['assertion_id']} references unknown trial")
        if a["source_id"] not in sources:
            raise DatasetError(f"assertion {a['assertion_id']} references unknown source")
        if a["value_basis"] not in ("reported", "derived", "not_reported", "not_located"):
            raise DatasetError(f"assertion {a['assertion_id']} has invalid value_basis")
        # An assertion must never claim human verification without a named verifier.
        if a.get("human_verified") and not a.get("verifier"):
            raise DatasetError(
                f"assertion {a['assertion_id']} is human_verified without a named verifier"
            )
        # Every assertion must carry a citable passage.
        if not (a.get("exact_passage") or "").strip():
            raise DatasetError(f"assertion {a['assertion_id']} has no exact_passage")

    for comparison in data["direct_comparisons"]:
        if comparison["trial_id"] not in trial_ids:
            raise DatasetError(
                f"comparison {comparison['comparison_id']} references unknown trial"
            )
        if comparison["source_id"] not in sources:
            raise DatasetError(
                f"comparison {comparison['comparison_id']} references unknown source"
            )
        if not comparison.get("outcomes"):
            raise DatasetError(f"comparison {comparison['comparison_id']} has no outcomes")
        if not (comparison.get("exact_passage") or "").strip():
            raise DatasetError(f"comparison {comparison['comparison_id']} has no exact_passage")
        for index, outcome in enumerate(comparison["outcomes"], start=1):
            if not (outcome.get("exact_passage") or "").strip():
                raise DatasetError(
                    f"comparison {comparison['comparison_id']} outcome {index} has no exact_passage"
                )


def manifest() -> Dict[str, Any]:
    return load()["manifest"]


def trials() -> List[dict]:
    return load()["trials"]


def sources() -> List[dict]:
    return load()["source_documents"]


def assertions() -> List[dict]:
    return load()["evidence_assertions"]


def findings() -> List[dict]:
    return load()["findings"]


def direct_comparisons() -> List[dict]:
    return load()["direct_comparisons"]


def direct_comparisons_for(medicine: str) -> List[dict]:
    return [
        c for c in direct_comparisons()
        if c["medicine"].strip().lower() == medicine.strip().lower()
    ]


def findings_for(medicine: str, finding_type: str) -> List[dict]:
    return [
        f for f in findings()
        if f["medicine"].strip().lower() == medicine.strip().lower()
        and f["finding_type"] == finding_type
    ]


def source_by_id(source_id: str) -> dict:
    for s in sources():
        if s["source_id"] == source_id:
            return s
    raise DatasetError(f"unknown source {source_id}")


def assertions_for(trial_id: str, dimension: str) -> List[dict]:
    return [
        a for a in assertions()
        if a["trial_id"] == trial_id and a["dimension"] == dimension
    ]


def assertion_value(trial_id: str, dimension: str):
    """Return (value, basis, assertion) for a trial/dimension, or (None, 'absent', None)."""
    found = assertions_for(trial_id, dimension)
    if not found:
        return None, "absent", None
    a = found[0]
    return a["value"], a["value_basis"], a


# Evidence bases that may back an exported/aggregated numeric value.
POSITIVE_NUMERIC_BASES = ("reported", "derived")

# --------------------------------------------------------------------------- #
# Authoritative-source URL validation (real parsing — no substring matching)
# --------------------------------------------------------------------------- #
AUTHORITATIVE_HOSTS = frozenset({
    "clinicaltrials.gov",
    "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov",
    "pmc.ncbi.nlm.nih.gov",
    "nejm.org", "www.nejm.org",
    "nature.com", "www.nature.com",
})
# Approved subdomain suffixes (exact-suffix match on the parsed hostname only).
APPROVED_HOST_SUFFIXES = (".ncbi.nlm.nih.gov",)


def authoritative_url_ok(url: str) -> bool:
    """True only for an https URL whose PARSED hostname is an approved
    authoritative host (exact) or an approved subdomain. No substring matching,
    so path-based spoofs (https://evil.invalid/path/clinicaltrials.gov) and
    suffix spoofs (https://clinicaltrials.gov.evil.invalid) are rejected."""
    try:
        p = urlparse(url or "")
    except (ValueError, TypeError):
        return False
    if p.scheme != "https":
        return False
    host = (p.hostname or "").lower()
    if not host:
        return False
    if host in AUTHORITATIVE_HOSTS:
        return True
    return any(host.endswith(sfx) for sfx in APPROVED_HOST_SUFFIXES)


# --------------------------------------------------------------------------- #
# THE canonical verified-evidence gate. Every trusted public / derived surface
# must read evidence through assertion_validity — never off a raw basis check.
# --------------------------------------------------------------------------- #
def source_is_valid(source_id) -> tuple:
    """(ok, reason) for a source_id: exists, resolves, authoritative https URL."""
    if not source_id:
        return False, "missing source_id"
    try:
        s = source_by_id(source_id)
    except DatasetError:
        return False, "dangling source_id"
    if not authoritative_url_ok(s.get("url", "")):
        return False, "non-authoritative or invalid source URL"
    return True, ""


def verified_evidence(record: dict) -> bool:
    """Reusable predicate for an assertion OR finding: it may influence a public
    value/conclusion only with a resolvable, authoritative, source_verified source."""
    if not record or not record.get("source_verified", False):
        return False
    ok, _ = source_is_valid(record.get("source_id"))
    return ok


def _invalid(state: str, reason: str, basis: str = None, source_id=None) -> dict:
    return {"value": None, "basis": basis or state, "state": state, "source_id": source_id,
            "source_verified": False, "valid": False, "invalid_reason": reason,
            "coverage": "incomplete"}


def assertion_validity(trial_id: str, dimension: str, *,
                       require_verified: bool = True, require_numeric: bool = False,
                       _seen=None) -> dict:
    """Canonical gate for one trial/dimension. A value is trusted (`valid: True`)
    only when ALL hold: assertion exists; exactly one (no duplicate/conflict);
    source_id exists, resolves, and is authoritative https; source_verified (when
    required); value structurally valid; and — for derived values — every declared
    dependency is itself valid (recursively). Otherwise `value` is None and
    `invalid_reason`/`state` explain why. Fail closed."""
    found = assertions_for(trial_id, dimension)
    if not found:
        return _invalid("absent", "no assertion")
    if len(found) > 1:
        values = {json.dumps(x.get("value"), sort_keys=True) for x in found}
        reason = "conflicting assertions" if len(values) > 1 else "duplicate assertions"
        return _invalid("conflict", reason)
    a = found[0]
    value, basis = a["value"], a["value_basis"]
    source_id = a.get("source_id")
    ok, why = source_is_valid(source_id)
    if not ok:
        return _invalid(basis, why, basis=basis, source_id=source_id)
    verified = bool(a.get("source_verified", False))
    if require_verified and not verified:
        return _invalid(basis, "source not verified", basis=basis, source_id=source_id)
    if basis == "derived":
        dep_ok, dep_reason = _derived_dependencies_valid(a, _seen or set())
        if not dep_ok:
            return _invalid(basis, f"derived dependency invalid: {dep_reason}",
                            basis=basis, source_id=source_id)
    if require_numeric and not isinstance(value, (int, float)):
        return _invalid(basis, "value is not numeric", basis=basis, source_id=source_id)
    return {"value": value, "basis": basis, "state": basis, "source_id": source_id,
            "source_verified": verified, "valid": True, "invalid_reason": None,
            "coverage": "complete"}


def _derived_dependencies_valid(a: dict, seen: set) -> tuple:
    """Recursively verify a derived assertion's declared dependencies. A derived
    value is never stronger than its weakest required dependency."""
    key = a.get("assertion_id")
    if key in seen:
        return False, "circular dependency"
    seen = seen | {key}
    deps = a.get("derived_from")
    if not deps:
        return False, "no declared dependency provenance"
    by_id = {x["assertion_id"]: x for x in assertions()}
    for dep_id in deps:
        dep = by_id.get(dep_id)
        if dep is None:
            return False, f"missing dependency {dep_id}"
        v = assertion_validity(dep["trial_id"], dep["dimension"],
                               require_verified=True, require_numeric=True, _seen=seen)
        if not v["valid"]:
            return False, f"{dep_id} ({v['invalid_reason']})"
    return True, ""


def total_enrollment_projection(trial_id: str) -> dict:
    """THE single, verified projection for a trial's total enrollment. Read here
    everywhere — never off raw trials.json ``enrollment_actual``.

    Fail-closed AND cross-surface-consistent: a real number is returned ONLY for a
    verified, conflict-free, ``reported`` assertion with an authoritative source. A
    derived total is deliberately NOT trusted yet (returned as
    ``unsupported-derived`` with value None) so every surface makes the identical
    trust decision. Returns value|None, basis, state, source_id, source_verified,
    valid, invalid_reason, coverage."""
    v = assertion_validity(trial_id, "total_enrollment", require_verified=True, require_numeric=True)
    if v["valid"] and v["basis"] == "reported":
        return {"value": int(v["value"]), "basis": "reported", "state": "reported",
                "source_id": v["source_id"], "source_verified": True, "valid": True,
                "invalid_reason": None, "coverage": "complete"}
    # Derived totals are consistently withheld until derived-total provenance is trusted.
    state = "unsupported-derived" if v["basis"] == "derived" else v["state"]
    return {"value": None, "basis": v["basis"], "state": state,
            "source_id": v["source_id"], "source_verified": v["source_verified"],
            "valid": False, "invalid_reason": v.get("invalid_reason") or "not a verified reported total",
            "coverage": "incomplete"}
