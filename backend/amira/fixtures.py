"""Load and validate verified demo fixtures.

Every hero/demo fixture is parsed through the schema before it can be served,
so a malformed fixture fails at load time, not in front of a judge.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from .schema import EvidenceReport

# repo_root/fixtures  (this file is repo_root/backend/amira/fixtures.py)
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


def _load_report(path: Path) -> EvidenceReport:
    data = json.loads(path.read_text(encoding="utf-8"))
    return EvidenceReport.model_validate(data)


def load_hero() -> EvidenceReport:
    return _load_report(FIXTURES_DIR / "hero_evidence.json")


def load_all_reports() -> List[EvidenceReport]:
    reports: List[EvidenceReport] = []
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        reports.append(_load_report(path))
    for path in sorted((FIXTURES_DIR / "medicines").glob("*.json")):
        reports.append(_load_report(path))
    return reports


def build_index() -> Dict[str, EvidenceReport]:
    """Map (medicine|condition|life_stage|hormone_therapy) -> report."""

    index: Dict[str, EvidenceReport] = {}
    for report in load_all_reports():
        index[_key(
            report.medicine,
            report.condition,
            report.life_stage.value,
            report.hormonal_context.hormone_therapy.value,
        )] = report
    return index


def _key(medicine: str, condition: str, life_stage: str, hormone_therapy: str) -> str:
    return "|".join(
        p.strip().lower() for p in (medicine, condition, life_stage, hormone_therapy)
    )


def lookup(
    index: Dict[str, EvidenceReport],
    *,
    medicine: str,
    condition: str,
    life_stage: str,
    hormone_therapy: str,
) -> EvidenceReport | None:
    """Best-effort deterministic lookup.

    Exact match first; then fall back to ignoring hormone_therapy, then life
    stage, so the demo always resolves to the same medicine/condition fixture.
    """

    exact = index.get(_key(medicine, condition, life_stage, hormone_therapy))
    if exact:
        return exact
    # Fall back across hormone_therapy and life_stage variants of same med/condition.
    for report in index.values():
        if (
            report.medicine.strip().lower() == medicine.strip().lower()
            and report.condition.strip().lower() == condition.strip().lower()
        ):
            return report
    return None
