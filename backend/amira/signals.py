"""Critical Signals — AMIRA's intelligence layer for clinically important
sex-specific findings.

This is NOT a second source of truth. Every signal is DERIVED at request time from
an existing canonical finding and resolves back to that finding's trial, source, and
exact passage. A signal registry entry can never make evidence trusted: a signal
only appears when its underlying finding already passes the canonical
``verified_evidence`` gate, and it may only be FEATURED when the finding is a
significant, source-verified, passage-backed result. Incomplete / DISCOVERED-layer
medicines have no verified findings, so they generate no signals.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from . import dataset

MAX_FEATURED = 5

# Signal-type vocabulary (clinically bounded; no sensational wording).
SIGNAL_TYPES = ["Mortality", "Serious Safety", "Dosing / Regulatory Action", "Label Change",
                "Outcome Pattern / Safety", "Effectiveness", "Outcome Difference",
                "Other Clinically Important Signal"]
EVIDENCE_STATUSES = ["Source Verified", "Human Review Pending", "Human Reviewed",
                     "Evidence Review Incomplete"]

_CAUTIONS = [
    "Not a treatment recommendation",
    "Does not establish an individual patient's outcome",
]


def _trial(trial_id: str) -> Optional[dict]:
    return next((t for t in dataset.trials() if t["trial_id"] == trial_id), None)


def _pct(text: Optional[str], which: int) -> Optional[str]:
    if not text:
        return None
    all_ = re.findall(r"\d+(?:\.\d+)?\s*%", text)
    return all_[which].replace(" ", "") if len(all_) > which else None


def _signal_type(f: dict) -> str:
    ep = (f.get("endpoint") or "").lower()
    sig = f.get("significance")
    cat = f.get("signal_category")
    # A curated category names the signal type directly.
    if cat == "regulatory_dosing":
        return "Dosing / Regulatory Action"
    if cat == "regulatory_label":
        return "Label Change"
    if cat == "outcome_pattern":
        return "Outcome Pattern / Safety"
    if ("death" in ep or "mortalit" in ep) and sig == "significant":
        return "Mortality"
    if f.get("finding_type") == "safety":
        return "Serious Safety"
    if sig == "significant":
        return "Outcome Difference"
    return "Effectiveness"


def _evidence_status(f: dict) -> str:
    if f.get("human_verified"):
        return "Human Reviewed"
    # Source-verified but awaiting named human sign-off.
    return "Human Review Pending"


def _is_critical(f: dict) -> bool:
    """A finding is a CRITICAL signal only when it is VERIFIED and trial-scoped AND
    it is clinically high-importance for women — either:
      * a statistically SIGNIFICANT sex-specific finding (e.g. the digoxin mortality
        signal, the sotalol torsades sex difference), OR
      * a curated, source-verified serious-safety / regulatory signal explicitly
        flagged ``critical_signal`` (e.g. the pioglitazone fracture signal, the FDA
        zolpidem dosing action) — a signal that materially changes how a medicine is
        understood for women even when a formal between-sex interaction test is not
        reported.

    Explicitly NOT critical (they stay in Evidence Coverage + Check Evidence, never
    here): a `no_significant_difference` result, an ordinary `not_tested` estimate, a
    women-only outcome analysis without a curated flag, and class-level or unverified
    findings. Being sex-specific — or being named in an ingestion request — does not
    by itself make a finding critical."""
    if not f.get("scope", "").startswith("trial:"):
        return False
    if not dataset.verified_evidence(f):
        return False
    if f.get("significance") == "significant":
        return True
    return bool(f.get("critical_signal"))


def _featured_eligible(f: dict) -> bool:
    """Featured promotion rule (SEPARATELY controlled from Library inclusion):
    the finding must be a verified CRITICAL signal (see ``_is_critical``), carry an
    explicit curated ``featured_signal`` flag, resolve to an authoritative source, and
    have an exact passage. Featured status is decided by the explicit flag — NEVER by
    statistical significance alone and NEVER merely by Library/table presence. So a
    curated regulatory or serious-safety signal (e.g. zolpidem dosing, pioglitazone
    fracture) can be Featured, while a Library-only signal without the flag (e.g. the
    aspirin women-only outcome pattern) is never auto-promoted."""
    if not _is_critical(f):
        return False
    if not f.get("featured_signal"):
        return False
    ok, _ = dataset.source_is_valid(f.get("source_id"))
    return ok and bool((f.get("exact_passage") or "").strip())


def _headline(f: dict, medicine: str, stype: str) -> str:
    # A curated finding carries its own exact, source-grounded headline.
    if (f.get("signal_headline") or "").strip():
        return f["signal_headline"].strip()
    drug_pct = _pct(f.get("female_rate"), 0)
    if stype == "Mortality" and drug_pct:
        return f"{drug_pct} of women assigned {medicine.lower()} died during follow-up"
    endpoint = (f.get("endpoint") or "a sex-specific outcome").strip()
    if f.get("significance") == "no_significant_difference":
        return f"{medicine}: no statistically significant sex difference in {endpoint.lower()}"
    return f"{medicine}: sex-specific finding on {endpoint.lower()}"


def _summary(f: dict) -> str:
    # A curated finding carries its own exact statistics line.
    if (f.get("signal_summary") or "").strip():
        return f["signal_summary"].strip()
    # Otherwise: the finding's own estimate / CI / interaction wording, verbatim.
    placebo = _pct(f.get("female_rate"), 1)
    parts = [
        f"{placebo} placebo" if placebo else None,
        f.get("female_estimate"),
        f.get("female_ci"),
        f"{f.get('comparison_test') or 'sex-by-treatment interaction'} P = {f['comparison_p']}"
        if f.get("comparison_p") is not None else None,
    ]
    return " · ".join([p for p in parts if p])


def _signal(f: dict, featured: bool, priority: int) -> dict:
    t = _trial(f["scope"].split(":", 1)[1]) or {}
    condition = t.get("condition")
    medicine = f.get("medicine") or t.get("medicine") or ""
    stype = _signal_type(f)
    src = dataset.source_link_safe(f.get("source_id"))
    is_post_hoc = "post hoc" in (f.get("interpretation") or "").lower()
    # A curated finding carries its own bounded cautions; otherwise use the defaults
    # (prepending the historical-post-hoc caution when the finding is post hoc).
    if f.get("cautions"):
        cautions = list(f["cautions"])
    else:
        cautions = list(_CAUTIONS)
        if is_post_hoc:
            cautions = ["Historical post hoc signal", "Not menopause-specific", *cautions]
    return {
        "signal_id": f"SIG-{f['finding_id']}",
        "medicine": medicine,
        "health_area": dataset.health_area_of(condition),
        "condition": condition,
        "drug_class": t.get("drug_class"),
        "trial_id": t.get("trial_id"),
        "finding_id": f["finding_id"],
        "signal_type": stype,
        "headline": _headline(f, medicine, stype),
        "summary": _summary(f),
        "clinical_significance": (f.get("interpretation") or "").strip(),
        "evidence_status": _evidence_status(f),
        "source_id": src["source_id"],
        "source_url": src["url"],
        "source_resolved": src["resolved"],
        "exact_passage": f.get("exact_passage"),
        "sex_specific": True,
        # No signal is life-stage-specific in the current corpus; never inferred from age.
        "life_stage": "Not specified",
        "life_stage_context": "Not inferred from age",
        "hormonal_context": "Not reported" if stype == "Mortality" else "Not reported",
        "human_verified": bool(f.get("human_verified")),
        "cautions": cautions,
        # Bounded "why this matters" line, source-grounded (never a recommendation).
        "why_matters": (f.get("why_it_matters") or "").strip() or None,
        "featured": featured,
        "featured_priority": priority if featured else None,
    }


def library() -> List[dict]:
    """The Critical Evidence Library: ONLY findings meeting the high critical-
    importance threshold (see `_is_critical`). Non-critical verified findings
    (no-significant-difference, not-tested, women-only-without-difference) are
    deliberately excluded here — they remain in Evidence Coverage and the medicine's
    Check Evidence record. Incomplete medicines contribute none (no verified findings)."""
    findings = [f for f in dataset.findings() if _is_critical(f)]
    # Featured-eligible first, ordered by the curated featured_rank (then finding_id);
    # Library-only signals follow, ordered by finding_id.
    findings.sort(key=lambda f: (
        0 if _featured_eligible(f) else 1,
        f.get("featured_rank", 999) if _featured_eligible(f) else 0,
        f["finding_id"],
    ))
    out = []
    fpri = 0
    for f in findings:
        if _featured_eligible(f) and fpri < MAX_FEATURED:
            fpri += 1
            out.append(_signal(f, featured=True, priority=fpri))
        else:
            out.append(_signal(f, featured=False, priority=0))
    return out


def featured() -> List[dict]:
    """Featured cards only — capped at MAX_FEATURED, priority ordered."""
    feats = [s for s in library() if s["featured"]]
    feats.sort(key=lambda s: s["featured_priority"])
    return feats[:MAX_FEATURED]


def payload() -> dict:
    lib = library()
    return {
        "featured": [s for s in lib if s["featured"]][:MAX_FEATURED],
        "library": lib,
        "signal_types": SIGNAL_TYPES,
        "evidence_statuses": EVIDENCE_STATUSES,
        "max_featured": MAX_FEATURED,
    }
