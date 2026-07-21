"""AMIRA Evidence Readiness — Pilot v0.1 (deterministic 0-100 score).

This is a SEPARATE, provisional lens that sits alongside the scientifically
implemented 1-5 Evidence Maturity level (see ``maturity.py``). It measures the
COMPLETENESS of women-specific evidence — never treatment effectiveness, clinical
safety, medicine quality, or prescribing preference.

Design guarantees
------------------
* **Deterministic.** The score is a pure function of the committed evidence
  assertions and findings. No LLM, no network, no randomness. Given the same
  dataset, the same medicine always yields the same score and the same reasons.
* **The LLM never touches this.** AMIRA-Extract produces structured evidence;
  this engine consumes it. The two are deliberately decoupled so the score
  cannot inherit a model's opinion.
* **`not_located` is never collapsed into `No`.** A dimension whose supporting
  evidence was never retrieved is scored ``not_located`` (0 points, flagged as a
  coverage gap), distinctly from ``not_reported`` (a source was read and is
  silent). If the foundational *Included* evidence is only ``not_located``, the
  whole score is withheld as "not yet established" rather than shown as 0 —
  exactly as the maturity level behaves.
* **Genuinely not-applicable dimensions are excluded from the denominator.** A
  women-only life-stage study cannot run a between-sex comparison, so *Compared*
  is marked ``not_applicable`` and removed from the eligible points — and the
  adjustment is shown explicitly.

The published rule table lives in ``docs/evidence-readiness-pilot-v0.1.md`` and
is mirrored by ``RULES`` below; ``RULES_VERSION`` ties the two together.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from . import dataset, maturity

RULES_VERSION = "0.1"
MAX_PER_DIMENSION = 20

# Evidence states, most to least complete. `not_applicable` is excluded from the
# denominator; every other state keeps its 20-point slot eligible.
STATE_COMPLETE = "complete"
STATE_PARTIAL = "partial"
STATE_INSUFFICIENT = "insufficient"
STATE_NOT_REPORTED = "not_reported"
STATE_NOT_LOCATED = "not_located"
STATE_EXCLUDED = "excluded"
STATE_NOT_APPLICABLE = "not_applicable"

# Points earned per state (out of MAX_PER_DIMENSION). `partial` earns half.
STATE_POINTS = {
    STATE_COMPLETE: 20,
    STATE_PARTIAL: 10,
    STATE_INSUFFICIENT: 0,
    STATE_NOT_REPORTED: 0,
    STATE_NOT_LOCATED: 0,
    STATE_EXCLUDED: 0,
    STATE_NOT_APPLICABLE: 0,
}

# States that remove the dimension's 20 eligible points from the denominator.
_NON_ELIGIBLE_STATES = {STATE_NOT_APPLICABLE}

RULES = {
    "included": {
        "title": "Included",
        "question": "Were women enrolled and was female participation reported?",
        "rule": (
            "complete = an exact female count is reported in a source; "
            "partial = only a female percentage is reported, or a count is derived; "
            "not_located = neither an exact count nor a percentage was retrieved; "
            "not_reported = a source was reviewed and states none is available."
        ),
    },
    "analyzed": {
        "title": "Analyzed",
        "question": "Were women's effectiveness outcomes reported separately?",
        "rule": (
            "complete = a sex-specific effectiveness outcome is reported "
            "(including an explicitly women-only study); "
            "not_reported / not_located otherwise."
        ),
    },
    "compared": {
        "title": "Compared",
        "question": "Was a formal sex-by-treatment comparison reported?",
        "rule": (
            "complete = a drug-specific finding reports a formal sex-by-treatment "
            "interaction/heterogeneity test; "
            "partial = effectiveness is reported by sex but no formal test was located; "
            "not_applicable = a women-only study, where a between-sex comparison is "
            "impossible (excluded from the denominator); "
            "not_reported / not_located otherwise."
        ),
    },
    "protected": {
        "title": "Protected",
        "question": "Were adverse events reported by sex and formally compared?",
        "rule": (
            "complete = adverse events are reported by sex AND a formal between-sex "
            "safety comparison is reported; "
            "partial = safety is reported by sex but only within-sex (e.g. vs placebo), "
            "with no between-sex test, or discussed for a women-only population; "
            "not_reported / not_located otherwise."
        ),
    },
    "personalized": {
        "title": "Personalized",
        "question": "Were menopause, hormone therapy and hormonal life stages considered?",
        "rule": (
            "complete = both menopausal status and hormone-therapy context are reported; "
            "partial = one of the two is reported; "
            "not_reported / not_located otherwise."
        ),
    },
}
DIMENSION_ORDER = ["included", "analyzed", "compared", "protected", "personalized"]


def _trials_for(medicine: str) -> List[dict]:
    return [t for t in dataset.trials() if t["medicine"].strip().lower() == medicine.strip().lower()]


def _best_basis(medicine: str, dimension: str) -> Tuple[str, List[dict]]:
    """Return the strongest value_basis for a dimension across the medicine's trials
    and the assertion records that justify it."""
    order = {"reported": 4, "derived": 3, "yes": 4, "not_reported": 1, "not_located": 0, "absent": -1}
    best = "absent"
    records: List[dict] = []
    for t in _trials_for(medicine):
        value, basis, a = dataset.assertion_value(t["trial_id"], dimension)
        if a is None:
            continue
        records.append(_record(a))
        rank = order.get(basis, -1)
        if value == dataset.AFFIRMATIVE:
            rank = max(rank, 4)
        if rank > order.get(best, -1):
            best = basis if value != dataset.AFFIRMATIVE else "reported"
    return best, records


def _affirmative(medicine: str, dimension: str) -> bool:
    return any(
        dataset.assertion_value(t["trial_id"], dimension)[0] == dataset.AFFIRMATIVE
        for t in _trials_for(medicine)
    )


def _bases(medicine: str, dimension: str) -> set:
    out = set()
    for t in _trials_for(medicine):
        _, basis, a = dataset.assertion_value(t["trial_id"], dimension)
        if a is not None:
            out.add(basis)
    return out


def _record(a: dict) -> dict:
    s = dataset.source_by_id(a["source_id"])
    return {
        "assertion_id": a.get("assertion_id"),
        "trial_id": a.get("trial_id"),
        "dimension": a.get("dimension"),
        "value": a.get("value"),
        "value_basis": a.get("value_basis"),
        "exact_passage": a.get("exact_passage"),
        "source_id": s["source_id"],
        "source_url": s["url"],
        "pmid": s.get("pmid"),
        "nct_id": s.get("nct_id"),
        "source_verified": a.get("source_verified", False),
        "human_verified": a.get("human_verified", False),
    }


def _finding_record(f: dict) -> dict:
    s = dataset.source_by_id(f["source_id"])
    return {
        "finding_id": f.get("finding_id"),
        "scope": f.get("scope"),
        "endpoint": f.get("endpoint"),
        "comparison_test": f.get("comparison_test"),
        "comparison_p": f.get("comparison_p"),
        "significance": f.get("significance"),
        "exact_passage": f.get("exact_passage"),
        "source_id": s["source_id"],
        "source_url": s["url"],
        "pmid": s.get("pmid"),
        "source_verified": f.get("source_verified", False),
        "human_verified": f.get("human_verified", False),
    }


def _is_women_only(medicine: str) -> bool:
    """A medicine whose entire reviewed evidence is an explicitly women-only,
    life-stage-defined study cannot support a between-sex comparison."""
    fem_only = [t for t in _trials_for(medicine) if (t.get("sex_eligibility") or "").upper() == "FEMALE"]
    return bool(fem_only) and len(fem_only) == len(_trials_for(medicine))


# --------------------------------------------------------------------------- #
# Per-dimension deterministic classifiers
# --------------------------------------------------------------------------- #
def _dim_included(medicine: str) -> Tuple[str, str, List[dict]]:
    count_bases = _bases(medicine, "female_enrollment_count")
    pct_bases = _bases(medicine, "female_enrollment_pct")
    recs = _collect(medicine, ["female_enrollment_count", "female_enrollment_pct"])
    if "reported" in count_bases:
        return STATE_COMPLETE, "An exact female participant count is reported in a retrieved source.", recs
    if "reported" in pct_bases or "derived" in count_bases or "derived" in pct_bases:
        return STATE_PARTIAL, "A female percentage is reported (or a count derived), but no exact reported count was located.", recs
    if "not_located" in count_bases or "not_located" in pct_bases:
        return STATE_NOT_LOCATED, "No exact female count or percentage was located in the retrieved sources.", recs
    return STATE_NOT_REPORTED, "The reviewed sources report no female enrollment figure.", recs


def _dim_analyzed(medicine: str) -> Tuple[str, str, List[dict]]:
    recs = _collect(medicine, ["sex_specific_efficacy_reported"])
    if _affirmative(medicine, "sex_specific_efficacy_reported"):
        if _is_women_only(medicine):
            return STATE_COMPLETE, "Effectiveness outcomes are reported for an explicitly women-only population.", recs
        return STATE_COMPLETE, "A sex-specific effectiveness outcome is reported for women.", recs
    bases = _bases(medicine, "sex_specific_efficacy_reported")
    if bases == {"not_reported"}:
        return STATE_NOT_REPORTED, "A source was reviewed and reports no sex-specific effectiveness analysis.", recs
    if "not_located" in bases:
        return STATE_NOT_LOCATED, "No sex-specific effectiveness analysis was located in the retrieved sources.", recs
    return STATE_INSUFFICIENT, "Not enough sex-specific effectiveness evidence to score this dimension.", recs


def _dim_compared(medicine: str) -> Tuple[str, str, List[dict]]:
    eff_findings = [f for f in dataset.findings_for(medicine, "efficacy") if f.get("scope", "").startswith("trial:")]
    recs = [_finding_record(f) for f in eff_findings]
    if _is_women_only(medicine):
        return STATE_NOT_APPLICABLE, ("This medicine's reviewed evidence is an explicitly women-only study, so a "
                                      "between-sex comparison is not possible. This dimension is excluded from the score."), recs
    formal = [f for f in eff_findings
              if f.get("comparison_p") is not None
              and f.get("significance") in ("significant", "no_significant_difference")]
    if formal:
        return STATE_COMPLETE, "A drug-specific formal sex-by-treatment comparison is reported.", [_finding_record(f) for f in formal]
    if _affirmative(medicine, "sex_specific_efficacy_reported"):
        return STATE_PARTIAL, "Effectiveness is reported by sex, but no formal drug-specific sex-by-treatment test was located.", recs
    bases = _bases(medicine, "sex_specific_efficacy_reported")
    if "not_located" in bases:
        return STATE_NOT_LOCATED, "No sex-specific comparison was located in the retrieved sources.", recs
    return STATE_NOT_REPORTED, "No formal sex-by-treatment comparison is reported.", recs


def _dim_protected(medicine: str) -> Tuple[str, str, List[dict]]:
    saf_findings = [f for f in dataset.findings_for(medicine, "safety") if f.get("scope", "").startswith("trial:")]
    recs = _collect(medicine, ["sex_specific_safety_reported"]) + [_finding_record(f) for f in saf_findings]
    between_sex = [f for f in saf_findings
                   if f.get("significance") in ("significant", "no_significant_difference", "trend_only")
                   and (f.get("comparison_p") is not None or f.get("comparison_test"))]
    if between_sex:
        return STATE_COMPLETE, "Adverse events are reported by sex with a formal between-sex safety comparison.", [_finding_record(f) for f in between_sex]
    if _affirmative(medicine, "sex_specific_safety_reported"):
        return STATE_PARTIAL, ("Safety is reported by sex, but only within-sex (e.g. versus placebo) or narratively for "
                               "women — no formal between-sex safety test was located."), recs
    bases = _bases(medicine, "sex_specific_safety_reported")
    if bases == {"not_reported"}:
        return STATE_NOT_REPORTED, "A source was reviewed and reports no sex-specific safety analysis.", recs
    if "not_located" in bases:
        return STATE_NOT_LOCATED, "No sex-specific safety analysis was located in the retrieved sources.", recs
    return STATE_INSUFFICIENT, "Not enough sex-stratified safety evidence to score this dimension.", recs


def _dim_personalized(medicine: str) -> Tuple[str, str, List[dict]]:
    recs = _collect(medicine, ["menopause_status_reported", "hormone_therapy_reported"])
    meno = _affirmative(medicine, "menopause_status_reported")
    ht = _affirmative(medicine, "hormone_therapy_reported")
    if meno and ht:
        return STATE_COMPLETE, "Both menopausal status and hormone-therapy context are reported.", recs
    if meno or ht:
        which = "menopausal status" if meno else "hormone-therapy context"
        return STATE_PARTIAL, f"Only {which} is reported; the other hormonal-context dimension is not.", recs
    bases = _bases(medicine, "menopause_status_reported") | _bases(medicine, "hormone_therapy_reported")
    if "not_located" in bases and "not_reported" not in bases:
        return STATE_NOT_LOCATED, "No menopause or hormone-therapy information was located in the retrieved sources.", recs
    return STATE_NOT_REPORTED, "Neither menopausal status nor hormone-therapy context is reported.", recs


def _collect(medicine: str, dimensions: List[str]) -> List[dict]:
    out = []
    for t in _trials_for(medicine):
        for dim in dimensions:
            _, _, a = dataset.assertion_value(t["trial_id"], dim)
            if a is not None:
                out.append(_record(a))
    return out


_CLASSIFIERS = {
    "included": _dim_included,
    "analyzed": _dim_analyzed,
    "compared": _dim_compared,
    "protected": _dim_protected,
    "personalized": _dim_personalized,
}


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def evaluate(medicine: str) -> Dict:
    """Compute the pilot readiness score for a medicine, or withhold it honestly."""
    trials = _trials_for(medicine)
    if not trials:
        return {
            "scored": False,
            "status": "medicine_not_in_corpus",
            "rules_version": RULES_VERSION,
            "reason": f"'{medicine}' is not in the reviewed corpus.",
        }

    dims = []
    for key in DIMENSION_ORDER:
        state, reason, records = _CLASSIFIERS[key](medicine)
        eligible = 0 if state in _NON_ELIGIBLE_STATES else MAX_PER_DIMENSION
        points = STATE_POINTS[state]
        dims.append({
            "key": key,
            "title": RULES[key]["title"],
            "question": RULES[key]["question"],
            "rule": RULES[key]["rule"],
            "state": state,
            "points": points,
            "max_eligible": eligible,
            "reason": reason,
            "source_records": records,
        })

    # Withhold the score if the foundational Included evidence is only not_located
    # (mirror the maturity engine: incomplete coverage is not the same as absence).
    included = next(d for d in dims if d["key"] == "included")
    if included["state"] == STATE_NOT_LOCATED:
        return {
            "scored": False,
            "status": "not_established",
            "rules_version": RULES_VERSION,
            "label": "AMIRA Evidence Readiness — Pilot v0.1",
            "reason": (
                "A pilot readiness score is withheld because female-enrollment evidence was not located "
                "in the reviewed accessible sources. This reflects incomplete source coverage, not "
                "confirmed absence of evidence."
            ),
            "dimensions": dims,
            "disclaimer": DISCLAIMER,
            "pilot_note": PILOT_NOTE,
        }

    earned = sum(d["points"] for d in dims)
    max_eligible = sum(d["max_eligible"] for d in dims)
    excluded = [d["title"] for d in dims if d["state"] in _NON_ELIGIBLE_STATES]
    score = round(100 * earned / max_eligible) if max_eligible else 0

    return {
        "scored": True,
        "status": "scored",
        "rules_version": RULES_VERSION,
        "label": "AMIRA Evidence Readiness — Pilot v0.1",
        "score": score,
        "points_earned": earned,
        "max_eligible_points": max_eligible,
        "denominator_note": (
            f"{len(excluded)} dimension(s) excluded from the denominator as not applicable: "
            f"{', '.join(excluded)}." if excluded else "All five dimensions are eligible (100-point denominator)."
        ),
        "excluded_dimensions": excluded,
        "dimensions": dims,
        "disclaimer": DISCLAIMER,
        "pilot_note": PILOT_NOTE,
    }


DISCLAIMER = ("This score measures the completeness of women-specific evidence—not whether this "
              "medicine is better.")
PILOT_NOTE = "Pilot methodology under expert review. Not a validated score."
