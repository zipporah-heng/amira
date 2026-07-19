"""Derived clinician-facing outputs: sex-specific effectiveness, sex-specific
safety, and drug-class comparison.

Every state is DERIVED from source-linked findings and assertions at request
time. Nothing is stored. Two rules are enforced structurally:

  * "No statistically significant difference" is only ever returned when an actual
    sex-specific comparison exists in a source. Absence of a comparison yields
    "insufficient", never "no difference".
  * Statistical significance is never inferred. A `significance` value only comes
    from a reported test result in the finding; if no test was reported, the state
    cannot be "significant" or "no significant difference" on that finding alone.
"""

from __future__ import annotations

from typing import Dict, List

from . import dataset, maturity

# ---- effectiveness states ---- #
EFF_SIGNIFICANT = "Significant sex difference identified"
EFF_NO_DIFF = "No statistically significant sex difference identified"
EFF_CONFLICTING = "Conflicting sex-specific results"
EFF_INSUFFICIENT = "Insufficient sex-specific evidence"
EFF_NOT_REPORTED = "Sex-specific effectiveness not reported"

# ---- safety states ---- #
SAF_SIGNIFICANT = "Significant sex-specific safety difference identified"
SAF_TRENDS = "Non-significant sex-specific trends identified"
SAF_NO_DIFF = "No significant sex-specific difference identified"
SAF_CONFLICTING = "Conflicting safety findings"
SAF_INSUFFICIENT = "Insufficient sex-specific safety evidence"
SAF_NOT_REPORTED = "Sex-specific safety not reported"


def _source_link(finding: dict) -> dict:
    s = dataset.source_by_id(finding["source_id"])
    return {"source_id": s["source_id"], "title": s["title"], "url": s["url"],
            "nct_id": s.get("nct_id"), "pmid": s.get("pmid"), "pmcid": s.get("pmcid"),
            "source_type": s["source_type"]}


def _finding_view(f: dict) -> dict:
    return {
        "finding_id": f["finding_id"], "scope": f["scope"], "finding_type": f["finding_type"],
        "endpoint": f["endpoint"],
        "female_estimate": f.get("female_estimate"), "male_estimate": f.get("male_estimate"),
        "effect_measure": f.get("effect_measure"),
        "female_ci": f.get("female_ci"), "male_ci": f.get("male_ci"),
        "female_rate": f.get("female_rate"), "male_rate": f.get("male_rate"),
        "comparison_test": f.get("comparison_test"), "comparison_p": f.get("comparison_p"),
        "significance": f.get("significance"),
        "interpretation": f.get("interpretation"),
        "exact_passage": f.get("exact_passage"), "source_locator": f.get("source_locator"),
        "source_verified": f.get("source_verified", False),
        "human_verified": f.get("human_verified", False),
        "source": _source_link(f),
    }


def _efficacy_reporting_counts(medicine: str) -> Dict[str, int]:
    trials = [t for t in dataset.trials() if t["medicine"].lower() == medicine.lower()]
    reporting = 0
    for t in trials:
        v, _, _ = dataset.assertion_value(t["trial_id"], "sex_specific_efficacy_reported")
        if v == "yes":
            reporting += 1
    return {"n_reporting": reporting, "n_trials": len(trials)}


def effectiveness_state(medicine: str) -> dict:
    findings = dataset.findings_for(medicine, "efficacy")
    counts = _efficacy_reporting_counts(medicine)

    sigs = {f.get("significance") for f in findings}
    # A finding can only assert "no difference" when it carries an actual comparison.
    has_real_comparison = any(
        f.get("significance") in ("significant", "no_significant_difference")
        and (f.get("comparison_p") is not None or f.get("comparison_test"))
        for f in findings
    )

    if not findings:
        # Distinguish "a source says it wasn't analysed" from "we haven't located one".
        bases = {
            dataset.assertion_value(t["trial_id"], "sex_specific_efficacy_reported")[1]
            for t in dataset.trials() if t["medicine"].lower() == medicine.lower()
        }
        if bases == {"not_reported"}:
            state = EFF_NOT_REPORTED
        else:
            state = EFF_INSUFFICIENT
    elif "significant" in sigs:
        state = EFF_SIGNIFICANT
    elif "significant" in sigs and "no_significant_difference" in sigs:
        state = EFF_CONFLICTING
    elif has_real_comparison and sigs <= {"no_significant_difference", "not_tested"}:
        state = EFF_NO_DIFF
    else:
        state = EFF_INSUFFICIENT

    headline = {
        EFF_SIGNIFICANT: "A sex difference in effectiveness was reported.",
        EFF_NO_DIFF: "Effectiveness in women was reported and did not differ significantly from men.",
        EFF_CONFLICTING: "Sex-specific effectiveness results conflict across sources.",
        EFF_INSUFFICIENT: "Not enough sex-specific effectiveness evidence to draw a conclusion.",
        EFF_NOT_REPORTED: "Effectiveness was not analysed separately for women in the reviewed trials.",
    }[state]

    return {
        "dimension": "sex_specific_effectiveness",
        "state": state,
        "headline": headline,
        "n_reporting": counts["n_reporting"],
        "n_trials": counts["n_trials"],
        "caveat": ("'No significant difference' does not mean identical effectiveness, and "
                   "'insufficient evidence' does not mean the medicine is ineffective in women."),
        "findings": [_finding_view(f) for f in findings],
        "derived": True,
    }


def safety_state(medicine: str) -> dict:
    findings = dataset.findings_for(medicine, "safety")
    sigs = [f.get("significance") for f in findings]
    drug_specific = [f for f in findings if f["scope"].startswith("trial:")]

    trials = [t for t in dataset.trials() if t["medicine"].lower() == medicine.lower()]
    reporting = sum(
        1 for t in trials
        if dataset.assertion_value(t["trial_id"], "sex_specific_safety_reported")[0] == "yes"
    )

    if "significant" in sigs:
        state = SAF_SIGNIFICANT
    elif "trend_only" in sigs:
        state = SAF_TRENDS
    elif drug_specific and any(f.get("significance") == "no_significant_difference"
                               for f in drug_specific):
        state = SAF_NO_DIFF
    elif findings:
        # Only class-level or non-clinical-endpoint findings exist: not enough
        # drug-specific, sex-stratified adverse-event evidence to conclude.
        state = SAF_INSUFFICIENT
    else:
        bases = {
            dataset.assertion_value(t["trial_id"], "sex_specific_safety_reported")[1]
            for t in trials
        }
        state = SAF_NOT_REPORTED if bases == {"not_reported"} else SAF_INSUFFICIENT

    headline = {
        SAF_SIGNIFICANT: "A statistically significant sex difference in side effects was reported.",
        SAF_TRENDS: "Non-significant sex-specific safety trends were reported.",
        SAF_NO_DIFF: "Side effects were compared by sex and did not differ significantly.",
        SAF_CONFLICTING: "Sex-specific safety results conflict across sources.",
        SAF_INSUFFICIENT: "Not enough drug-specific, sex-stratified side-effect evidence to draw a conclusion.",
        SAF_NOT_REPORTED: "Side effects were not analysed separately for women in the reviewed trials.",
    }[state]

    return {
        "dimension": "sex_specific_safety",
        "state": state,
        "headline": headline,
        "n_reporting": reporting,
        "n_trials": len(trials),
        "caveat": ("A trend is not a confirmed difference. Sex-specific side effects are never "
                   "inferred from pooled adverse-event data."),
        "significant_findings": [_finding_view(f) for f in findings if f.get("significance") == "significant"],
        "trend_findings": [_finding_view(f) for f in findings if f.get("significance") == "trend_only"],
        "other_findings": [_finding_view(f) for f in findings
                           if f.get("significance") not in ("significant", "trend_only")],
        "derived": True,
    }


def _verified_medicines_in_class(drug_class: str) -> List[str]:
    return sorted({
        t["medicine"] for t in dataset.trials()
        if (t.get("drug_class") or "").lower() == drug_class.lower()
    })


def class_comparison(drug_class: str) -> dict:
    """Compare only verified medicines in the class, sorted by derived maturity."""
    meds = _verified_medicines_in_class(drug_class)
    rows = []
    for med in meds:
        trial_ids = [t["trial_id"] for t in dataset.trials() if t["medicine"] == med]
        m = maturity.evaluate(trial_ids)
        eff = effectiveness_state(med)
        saf = safety_state(med)
        # Key gap: highest unmet women's-evidence dimension.
        gaps = []
        if not any(dataset.assertion_value(t, "menopause_status_reported")[0] == "yes" for t in trial_ids):
            gaps.append("Menopausal status not reported")
        if not any(dataset.assertion_value(t, "hormone_therapy_reported")[0] == "yes" for t in trial_ids):
            gaps.append("Hormone therapy not reported")
        rows.append({
            "medicine": med,
            "drug_class": drug_class,
            "maturity_level": m["level"],
            "maturity_label": m["label"],
            "effectiveness_state": eff["state"],
            "safety_state": saf["state"],
            "key_gap": gaps[0] if gaps else "None identified",
            "n_trials": len(trial_ids),
        })
    rows.sort(key=lambda r: (-r["maturity_level"], r["medicine"]))
    return {
        "drug_class": drug_class,
        "verified_count": len(meds),
        "verified_medicines": meds,
        "sort": "evidence_maturity_desc",
        "rows": rows,
        "note": ("Only medicines with completed, verified evidence ingestion appear here. "
                 "Stronger women-specific evidence is not the same as greater effectiveness; "
                 "AMIRA does not rank medicines by clinical effectiveness."),
        "class_level_findings": [
            _finding_view(f) for f in dataset.findings()
            if f["scope"] == f"class:{drug_class}"
        ],
    }


def who_was_studied(trial_ids: List[str]) -> List[dict]:
    out = []
    for tid in trial_ids:
        t = next(x for x in dataset.trials() if x["trial_id"] == tid)
        fcount, fbasis, _ = dataset.assertion_value(tid, "female_enrollment_count")
        fpct, pbasis, _ = dataset.assertion_value(tid, "female_enrollment_pct")
        out.append({
            "trial_id": tid, "display_name": t["display_name"], "nct_id": t["nct_id"],
            "medicine": t["medicine"], "study_phase": t.get("study_phase"),
            "total_participants": t["enrollment_actual"],
            "female_n": fcount if fbasis == "reported" else None,
            "female_n_basis": fbasis,
            "female_pct": fpct if pbasis in ("reported", "derived") else None,
            "female_pct_basis": pbasis,
            "minimum_age": t.get("minimum_age"),
            "sex_eligibility": t.get("sex_eligibility"),
            "primary_endpoint": t.get("primary_endpoint"),
            "indication": t.get("indication"),
            "registry_url": t["registry_url"],
            "age_note": "Age eligibility only. Age is not used to infer menopausal status.",
        })
    return out
