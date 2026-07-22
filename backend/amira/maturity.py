"""The single AMIRA evidence-maturity calculator.

Levels are DERIVED from evidence assertions at request time. The final level is
never stored in the source dataset — `pipeline/ingest.py` writes no level, and a
test asserts the dataset contains none.

Levels (Mantis rules):
    1  Women Counted              female enrollment is reported (count or percentage)
    2  Women Analyzed             sex-specific efficacy OR safety outcomes are reported
    3  Life Stage Aware           menopausal status / life stage is reported
    4  Hormone Aware              hormone therapy use is reported
    5  Precision Women's Evidence outcomes explicitly stratified by both life stage
                                  and hormonal context

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
    """True only when the dimension is affirmatively reported through the canonical
    verified gate: `reported` basis, verified + authoritative + conflict-free source.
    A `yes` with a not_located/absent basis, an unverified source, a spoofed URL, or
    a conflicting assertion never advances the maturity score (fail closed)."""
    v = dataset.assertion_validity(trial_id, dimension, require_verified=True)
    return v["valid"] and v["basis"] == "reported" and v["value"] == dataset.AFFIRMATIVE


def _has_enrollment_report(trial_id: str) -> bool:
    """Level 1: a female count OR percentage, reported through the verified gate."""
    for dim in ("female_enrollment_count", "female_enrollment_pct"):
        v = dataset.assertion_validity(trial_id, dim, require_verified=True, require_numeric=True)
        if v["valid"] and v["basis"] == "reported":
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
    # Level 5 requires an explicit source assertion that outcomes were stratified by
    # BOTH life stage and hormonal context. Reporting both variables alone is not enough.
    checks[5] = any(
        _reports(t, "outcomes_stratified_by_life_stage_and_hormone_context")
        for t in trial_ids
    )

    level = 0
    for n in (1, 2, 3, 4, 5):
        if checks[n]:
            level = n
        else:
            break  # cumulative: stop at the first unmet level

    # Scorability: a level of 0 is only a genuine score when a source was actually
    # checked and found NOT to report enrolment (not_reported). If the level-1
    # evidence is merely "not_located" (inaccessible source), the maturity cannot be
    # established, and a 0/5 would misrepresent incomplete coverage as absent evidence.
    enrol_reported = level >= 1
    enrol_not_located = False
    enrol_not_reported = False
    enrol_any_assertion = False
    for tid in trial_ids:
        for dim in ("female_enrollment_count", "female_enrollment_pct"):
            _, basis, _a = dataset.assertion_value(tid, dim)
            if _a is not None:
                enrol_any_assertion = True
            if basis == "not_located":
                enrol_not_located = True
            elif basis == "not_reported":
                enrol_not_reported = True
    # Fail closed: a level is only a genuine SCORE when foundational enrolment
    # evidence was actually reported+verified, or a reviewed source explicitly did
    # not report it. Absent assertions (none at all) and not_located evidence are
    # NOT scored as 0/5 — they are "not established".
    scorable = enrol_reported or (enrol_not_reported and not enrol_not_located and enrol_any_assertion)
    status = "established" if scorable else "not_established"

    # Dimensions whose assertions explain each level's pass/fail.
    level_dims = {
        1: ("female_enrollment_count", "female_enrollment_pct"),
        2: ("sex_specific_efficacy_reported", "sex_specific_safety_reported"),
        3: ("menopause_status_reported",),
        4: ("hormone_therapy_reported",),
        5: ("outcomes_stratified_by_life_stage_and_hormone_context",),
    }

    def _evidence(n: int) -> list:
        ev = []
        for tid in trial_ids:
            for dim in level_dims.get(n, ()):
                _, basis, a = dataset.assertion_value(tid, dim)
                if a is None:
                    continue
                # Dangling-safe: a derived value whose dependency points at a missing
                # source must NOT crash check_evidence while building this trace.
                s = dataset.source_link_safe(a["source_id"])
                ev.append({
                    "trial_id": tid, "dimension": dim,
                    "value": a["value"], "value_basis": basis,
                    "passage": a["exact_passage"], "source_url": s["url"],
                    "source_id": s["source_id"], "source_resolved": s["resolved"],
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

    if scorable:
        label = LEVEL_LABELS.get(level, "No women's evidence")
        display = f"{level} / 5"
    else:
        label = "Not yet established"
        display = "Not yet established"

    return {
        "level": level,
        "scorable": scorable,
        "status": status,
        "label": label,
        "display": display,
        "unscored_reason": (
            None if scorable else
            "Female enrolment evidence was not located in the reviewed accessible sources, "
            "so an evidence maturity level cannot be established. This is incomplete source "
            "coverage, not confirmed absence of evidence."
        ),
        "description": LEVEL_DESCRIPTIONS.get(level, "") if scorable else "",
        "max_level": 5,
        "derived": True,
        "derivation_note": (
            "Derived from evidence assertions at request time; never stored in the "
            "dataset. Age is not used to infer menopausal status."
        ),
        "rule_trace": trace,
    }
