"""ClinicalTrials.gov API v2 ingestion.

Fetches study records and normalizes them into candidate passages + partial source
metadata for the extraction pipeline. Network calls live only in fetch_studies();
normalization is pure and unit-testable offline.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import httpx

API_V2_BASE = "https://clinicaltrials.gov/api/v2/studies"


def fetch_studies(
    query_term: str,
    *,
    condition: Optional[str] = None,
    page_size: int = 10,
    timeout: float = 20.0,
) -> List[dict]:  # pragma: no cover - network
    """Query ClinicalTrials.gov v2. Returns raw study dicts."""

    params = {
        "query.term": query_term,
        "pageSize": page_size,
        "format": "json",
    }
    if condition:
        params["query.cond"] = condition
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(API_V2_BASE, params=params)
        resp.raise_for_status()
        return resp.json().get("studies", [])


def normalize_study(study: dict) -> Dict[str, Optional[object]]:
    """Normalize a v2 study record into partial source metadata + a passage.

    Pure function — safe to unit test with a canned record.
    """

    proto = study.get("protocolSection", {})
    ident = proto.get("identificationModule", {})
    design = proto.get("designModule", {})
    status = proto.get("statusModule", {})
    desc = proto.get("descriptionModule", {})
    elig = proto.get("eligibilityModule", {})

    nct_id = ident.get("nctId")
    title = ident.get("briefTitle") or ident.get("officialTitle") or "Untitled study"
    enrollment = (design.get("enrollmentInfo") or {}).get("count")
    start = (status.get("startDateStruct") or {}).get("date")
    year = int(start[:4]) if start and start[:4].isdigit() else None

    summary = desc.get("briefSummary") or ""
    sex = elig.get("sex")
    passage_parts = [summary.strip()]
    if sex:
        passage_parts.append(f"Eligible sex: {sex}.")
    if enrollment is not None:
        passage_parts.append(f"Reported enrollment: {enrollment} participants.")
    passage = " ".join(p for p in passage_parts if p).strip()

    return {
        "source_id": nct_id or title[:40],
        "source_title": title,
        "source_type": "clinical_trial",
        "url": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else None,
        "nct_id": nct_id,
        "publication_year": year,
        "total_n": enrollment,
        "relevant_passage": passage or "No structured summary available.",
        "source_location": "ClinicalTrials.gov v2 protocolSection",
    }


def chunk_passage(text: str, max_chars: int = 1200) -> List[str]:
    """Split a long passage into sentence-aware chunks for extraction."""

    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []
    chunks: List[str] = []
    current = ""
    for sentence in text.replace("\n", " ").split(". "):
        piece = sentence.strip()
        if not piece:
            continue
        candidate = f"{current} {piece}.".strip()
        if len(candidate) > max_chars and current:
            chunks.append(current.strip())
            current = f"{piece}."
        else:
            current = candidate
    if current.strip():
        chunks.append(current.strip())
    return chunks
