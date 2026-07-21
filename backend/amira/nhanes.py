"""Runtime loader for the NHANES population-context cache.

Reads the committed, versioned derived cache produced by
``pipeline/nhanes_context.py``. This module has NO heavy dependencies and makes
NO network calls — the survey computation happens offline when the cache is
(re)built. If the cache is absent, this reports that honestly instead of
inventing a number.

NHANES is population context, deliberately separate from AMIRA's clinical-trial
evidence.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

CACHE_PATH = Path(__file__).resolve().parents[2] / "dataset" / "nhanes" / "nhanes_context_v1.json"


@lru_cache(maxsize=1)
def _cache() -> Optional[dict]:
    if not CACHE_PATH.exists():
        return None
    return json.loads(CACHE_PATH.read_text(encoding="utf-8"))


def available() -> bool:
    return _cache() is not None


def _base(cache: dict) -> dict:
    return {k: cache[k] for k in (
        "cycle", "domain", "measure", "weight_variable", "design_variables",
        "variance_method", "suppression_rule", "age_range_years",
        "unweighted_denominator_women", "files", "retrieved_at", "cache_version",
        "usage_boundary",
    )}


def context_for_class(drug_class: str) -> Dict:
    """Population-context result for a drug class, or an honest 'not available'."""
    cache = _cache()
    if cache is None:
        return {
            "available": False,
            "status": "cache_missing",
            "note": (
                "NHANES population context has not been cached yet. Run "
                "`python pipeline/nhanes_context.py` to build dataset/nhanes/nhanes_context_v1.json "
                "from the official CDC NHANES files. No population figure is shown until then."
            ),
        }
    row = next((r for r in cache["results"]
                if r["drug_class"].strip().lower() == (drug_class or "").strip().lower()), None)
    if row is None:
        return {"available": True, "status": "class_not_computed",
                **_base(cache),
                "note": f"NHANES use has not been computed for the '{drug_class}' class.",
                "result": None}
    return {"available": True, "status": "ok", **_base(cache), "result": row}


def all_classes() -> Dict:
    cache = _cache()
    if cache is None:
        return {"available": False, "status": "cache_missing"}
    return {"available": True, "status": "ok", **_base(cache), "results": cache["results"]}
