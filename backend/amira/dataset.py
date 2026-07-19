"""Loader for the normalized real-evidence dataset.

The API, the UI and the downloadable CSV/JSONL all read through this module, so
there is exactly one set of numbers in the system.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

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
        "screening_log": _read("screening_log"),
    }
    _validate(data)
    return data


def _validate(data: Dict[str, Any]) -> None:
    trials = data["trials"]
    sources = {s["source_id"] for s in data["source_documents"]}
    trial_ids = {t["trial_id"] for t in trials}

    # NCT de-duplication: one trial per NCT id, no repeats.
    ncts = [t["nct_id"] for t in trials]
    if len(ncts) != len(set(ncts)):
        raise DatasetError(f"duplicate NCT ids in trials: {ncts}")

    for a in data["evidence_assertions"]:
        if a["trial_id"] not in trial_ids:
            raise DatasetError(f"assertion {a['assertion_id']} references unknown trial")
        if a["source_id"] not in sources:
            raise DatasetError(f"assertion {a['assertion_id']} references unknown source")
        if a["value_basis"] not in ("reported", "derived", "not_reported"):
            raise DatasetError(f"assertion {a['assertion_id']} has invalid value_basis")
        # An assertion must never claim human verification without a named verifier.
        if a.get("human_verified") and not a.get("verifier"):
            raise DatasetError(
                f"assertion {a['assertion_id']} is human_verified without a named verifier"
            )
        # Every assertion must carry a citable passage.
        if not (a.get("exact_passage") or "").strip():
            raise DatasetError(f"assertion {a['assertion_id']} has no exact_passage")


def manifest() -> Dict[str, Any]:
    return load()["manifest"]


def trials() -> List[dict]:
    return load()["trials"]


def sources() -> List[dict]:
    return load()["source_documents"]


def assertions() -> List[dict]:
    return load()["evidence_assertions"]


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
