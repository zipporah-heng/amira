"""Structured evidence extraction with abstention and validation.

Flow (mission section 12):
    passage -> structured extraction -> schema validation -> citation validation
    -> confidence assignment -> human-verification flag

The extractor supports two backends:
  * "recorded": deterministic, reads pre-recorded model outputs from a fixtures
    directory. Used by tests and offline demos (no API key needed).
  * "openai": live OpenAI structured output. Used when OPENAI_API_KEY is set.

Whichever backend produces the raw dict, it goes through the SAME validation and
citation-checking path, so trusted fields are never populated by unvalidated text.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

from ..schema import ReportedStatus
from .prompts import (
    EXTRACTION_FIELDS,
    EXTRACTION_SYSTEM_PROMPT,
    build_user_prompt,
)

_REPORTED_ENUM_FIELDS = {
    "sex_stratified_efficacy_reported",
    "sex_stratified_safety_reported",
    "sex_by_treatment_interaction_tested",
    "menopausal_status_reported",
    "hormonal_factors_reported",
    "hormone_therapy_reported",
    "pregnancy_excluded",
}
_NUMERIC_FIELDS = {"female_n", "female_pct", "total_n"}
_VALID_ENUM = {"yes", "no", "uncertain", "not_reported"}

RECORDED_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "recorded_extractions"


class ExtractionError(Exception):
    """Raised when extraction output cannot be trusted. Fails closed."""


@dataclass
class FieldResult:
    value: object
    citation: Optional[str]
    confidence: float
    citation_verified: bool = False


@dataclass
class ExtractionResult:
    fields: Dict[str, FieldResult]
    overall_confidence: float
    abstained_fields: list = field(default_factory=list)
    human_verified: bool = False

    def as_summary_kwargs(self) -> dict:
        """Map validated fields into EvidenceSummary constructor kwargs."""

        out: dict = {}
        for name, res in self.fields.items():
            if name in _NUMERIC_FIELDS:
                out[name] = res.value
            elif name in _REPORTED_ENUM_FIELDS:
                out[name] = ReportedStatus(res.value)
        return out


def _validate_raw(raw: dict) -> dict:
    """Schema-validate the raw extraction dict. Fail closed on malformed output."""

    if not isinstance(raw, dict):
        raise ExtractionError("extraction output is not an object")
    cleaned: dict = {}
    for name in EXTRACTION_FIELDS:
        if name not in raw:
            # Missing field is treated as abstention, not an error.
            cleaned[name] = {"value": "not_reported" if name in _REPORTED_ENUM_FIELDS
                             else None, "citation": None, "confidence": 0.0}
            continue
        item = raw[name]
        if not isinstance(item, dict) or "value" not in item:
            raise ExtractionError(f"field '{name}' is malformed: {item!r}")
        value = item["value"]
        if name in _REPORTED_ENUM_FIELDS:
            if value not in _VALID_ENUM:
                raise ExtractionError(
                    f"field '{name}' has invalid enum value {value!r}"
                )
        elif name in _NUMERIC_FIELDS:
            if value is not None and not isinstance(value, (int, float)):
                raise ExtractionError(
                    f"numeric field '{name}' has non-numeric value {value!r}"
                )
        cleaned[name] = {
            "value": value,
            "citation": item.get("citation"),
            "confidence": float(item.get("confidence", 0.0) or 0.0),
        }
    return cleaned


def _verify_citation(passage: str, value, citation: Optional[str]) -> bool:
    """A non-abstained claim must cite an exact substring of the passage.

    Abstentions (not_reported / null) need no citation. Any affirmative value
    without a verifiable citation is downgraded to abstention by the caller.
    """

    if value in ("not_reported", None, "unknown"):
        return True
    if not citation:
        return False
    return citation.strip().lower() in passage.lower()


def _finalize(raw_clean: dict, passage: str) -> ExtractionResult:
    fields: Dict[str, FieldResult] = {}
    abstained = []
    confidences = []
    for name, item in raw_clean.items():
        value = item["value"]
        citation = item.get("citation")
        conf = item["confidence"]
        verified = _verify_citation(passage, value, citation)

        if name in _REPORTED_ENUM_FIELDS and value in ("yes", "no", "uncertain") and not verified:
            # Affirmative claim without a valid citation -> abstain (fail closed).
            value = "not_reported"
            citation = None
            conf = 0.0
        if name in _NUMERIC_FIELDS and value is not None and not verified:
            value = None
            citation = None
            conf = 0.0

        if value in ("not_reported", None):
            abstained.append(name)
        fields[name] = FieldResult(value, citation, conf, verified)
        confidences.append(conf)

    overall = round(sum(confidences) / len(confidences), 3) if confidences else 0.0
    return ExtractionResult(fields=fields, overall_confidence=overall,
                            abstained_fields=abstained)


def extract_from_passage(
    passage: str,
    source_title: str,
    *,
    backend: Optional[str] = None,
    recorded_key: Optional[str] = None,
) -> ExtractionResult:
    """Extract structured fields from one passage.

    backend: "recorded" (default when no OPENAI_API_KEY) or "openai".
    recorded_key: filename stem under fixtures/recorded_extractions for recorded mode.
    """

    backend = backend or ("openai" if os.getenv("OPENAI_API_KEY") else "recorded")

    if backend == "recorded":
        raw = _load_recorded(recorded_key)
    elif backend == "openai":
        raw = _call_openai(passage, source_title)
    else:
        raise ExtractionError(f"unknown backend {backend!r}")

    raw_clean = _validate_raw(raw)
    return _finalize(raw_clean, passage)


def _load_recorded(recorded_key: Optional[str]) -> dict:
    if not recorded_key:
        raise ExtractionError("recorded backend requires recorded_key")
    path = RECORDED_DIR / f"{recorded_key}.json"
    if not path.exists():
        raise ExtractionError(f"no recorded extraction at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _call_openai(passage: str, source_title: str) -> dict:  # pragma: no cover
    """Live OpenAI structured extraction. Exercised only when a key is present."""

    from openai import OpenAI

    client = OpenAI()
    resp = client.chat.completions.create(
        model=os.getenv("AMIRA_OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(passage, source_title)},
        ],
    )
    return json.loads(resp.choices[0].message.content)
