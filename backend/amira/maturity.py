"""The single AMIRA evidence-maturity calculator.

Levels are DERIVED from evidence assertions at request time. The final level is
never stored in the source dataset — `pipeline/ingest.py` writes no level, and a
test asserts the dataset contains none.

Levels (Mantis rules):
    1  Women Counted              female enrollment is reported (count or percentage)
    2  Women Analyzed             sex-specific efficacy OR safety outcomes are reported
    3  Life Stage Aware           menopausal status / life stage is reported
    4  Hormone Aware              hormone therapy use is reported
    5  Precision Women's Evidence sex-specific outcomes reported AND stratified by both
                                  life stage and hormonal context

Levels are cumulative: the awarded level is the highest N for which every level
1..N is satisfied.

HARD RULE: age is never used to infer menopausal status. Only an explicit
menopausal-status report can satisfy level 3.
"""

from __future__ import annotations

from typing import Dict, List

from . import dataset

LEVEL_LABELS = {
    1: "Women Counted",
    2: "Women Analyzed",
    3: "Life Stage Aware",
    4: "Hormone Aware",
    5: "Precision Women's Evidence",
}

LEVEL_DESCRIPTIONS = {
    1: "Studies report how many women were enrolled.",
    2: "Studies report outcomes separately for women.",
    3: "Studies report menopausal status or life stage.",
    4: "Studies report hormone therapy use and hormonal context.",
    5: "Sex-specific outcomes are reported and stratified by life stage and hormonal context.",
}


def _reports(trial_id: str, dimension: str) -> bool:
    """True only when a dimension is affirmatively reported for the trial."""
    value, basis, _ = dataset.assertion_value(trial_id, dimension)
    if basis == "not_reported" or basis == "absent":
        return False
    return value == dataset.AFFIRMATIVE


def _has_enrollment_report(trial_id: str) -> bool:
    """Level 1: a female count OR a female percentage, actually reported."""
    for dim in ("female_enrollment_count", "female_enrollment_pct"):
        value, basis, _ = dataset.assertion_value(trial_id, dim)
        if basis == "reported" and value is not None:
            return True
    return False


def evaluate(trial_ids: List[str]) -> Dict:
    """Derive the maturity level across the given trials, with a rule trace."""
    checks = {
        1: any(_has_enrollment_report(t) for t in trial_ids),
        2: any(
            _reports(t, "sex_specific_efficacy_reported")
            or _reports(t, "sex_specific_safety_reported")
            for t in trial_ids
        ),
        3: any(_reports(t, "menopause_status_reported") for t in trial_ids),
        4: any(_reports(t, "hormone_therapy_reported") for t in trial_ids),
    }
    # Level 5 requires sex-specific outcomes stratified by BOTH life stage and hormones.
    checks[5] = checks[2] and checks[3] and checks[4]

    level = 0
    for n in (1, 2, 3, 4, 5):
        if checks[n]:
            level = n
        else:
            break  # cumulative: stop at the first unmet level

    # Dimensions whose assertions explain each level's pass/fail.
    level_dims = {
        1: ("female_enrollment_count", "female_enrollment_pct"),
        2: ("sex_specific_efficacy_reported", "sex_specific_safety_reported"),
        3: ("menopause_status_reported",),
        4: ("hormone_therapy_reported",),
    }

    def _evidence(n: int) -> list:
        ev = []
        for tid in trial_ids:
            for dim in level_dims.get(n, ()):
                _, basis, a = dataset.assertion_value(tid, dim)
                if a is None:
                    continue
                s = dataset.source_by_id(a["source_id"])
                ev.append({
                    "trial_id": tid, "dimension": dim,
                    "value": a["value"], "value_basis": basis,
                    "passage": a["exact_passage"], "source_url": s["url"],
                    "source_id": s["source_id"],
                    "pmid": s.get("pmid"), "nct_id": s.get("nct_id"),
                    "assertion_id": a["assertion_id"],
                })
        return ev

    trace = []
    for n in (1, 2, 3, 4, 5):
        trace.append({
            "level": n,
            "label": LEVEL_LABELS[n],
            "satisfied": bool(checks[n]),
            "awarded": n <= level,
            "requirement": LEVEL_DESCRIPTIONS[n],
            "evidence": _evidence(n),
        })

    return {
        "level": level,
        "label": LEVEL_LABELS.get(level, "No women's evidence"),
        "description": LEVEL_DESCRIPTIONS.get(level, ""),
        "max_level": 5,
        "derived": True,
        "derivation_note": (
            "Derived from evidence assertions at request time; never stored in the "
            "dataset. Age is not used to infer menopausal status."
        ),
        "rule_trace": trace,
    }
