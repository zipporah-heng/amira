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
EFF_REPORTED_UNCLEAR = "Sex-specific analysis reported, statistical comparison unclear"
EFF_WOMEN_ONLY = "Women's outcomes reported; no comparison with men"
EFF_CONFLICTING = "Conflicting sex-specific results"
EFF_INSUFFICIENT = "Insufficient sex-specific evidence"
EFF_NOT_REPORTED = "Sex-specific effectiveness not reported"

# ---- safety states ---- #
SAF_SIGNIFICANT = "Significant sex-specific safety difference identified"
SAF_TRENDS = "Non-significant sex-specific trends identified"
SAF_NO_DIFF = "No significant sex-specific difference identified"
# Reported by sex, but only against placebo within each sex — no between-sex test.
SAF_REPORTED_NO_COMPARISON = "Reported by sex, no formal between-sex comparison"
SAF_WOMEN_ONLY = "Safety reported in women; no comparison with men"
SAF_WOMEN_REPORTED_NO_COMPARISON = "Women's safety discussed; no formal between-sex comparison"
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
        "population_scope": f.get("population_scope", "women_and_men"),
        "reporting_scope": f.get("reporting_scope", "women_and_men_separate"),
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


def direct_comparison_view(comparison: dict) -> dict:
    """Return a source-linked treatment-arm comparison for the selected medicine."""
    source = dataset.source_by_id(comparison["source_id"])
    return {
        **comparison,
        "source": {
            "source_id": source["source_id"],
            "title": source["title"],
            "url": source["url"],
            "pmid": source.get("pmid"),
            "pmcid": source.get("pmcid"),
            "source_type": source["source_type"],
        },
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
    """Derive the sex-specific effectiveness state from DRUG-SPECIFIC findings only.

    Class-level evidence (e.g. a statin-class meta-analysis) is surfaced separately
    and is NEVER allowed to justify a drug-specific significance conclusion.
    """
    all_findings = dataset.findings_for(medicine, "efficacy")
    drug_findings = [f for f in all_findings if f.get("scope", "").startswith("trial:")]
    class_findings = [f for f in all_findings if f.get("scope", "").startswith("class:")]
    counts = _efficacy_reporting_counts(medicine)

    drug_sigs = {f.get("significance") for f in drug_findings}
    women_only = bool(drug_findings) and all(
        f.get("population_scope") == "women_only_life_stage" for f in drug_findings
    )
    # A drug-specific "no difference" claim requires a real drug-specific comparison
    # (a numeric interaction/heterogeneity p reported for THIS medicine).
    has_drug_comparison = any(
        f.get("significance") in ("significant", "no_significant_difference")
        and f.get("comparison_p") is not None
        for f in drug_findings
    )

    if not drug_findings:
        # Distinguish "a source says it wasn't analysed" (not_reported) from
        # "we haven't located an accessible source" (not_located/absent).
        bases = {
            dataset.assertion_value(t["trial_id"], "sex_specific_efficacy_reported")[1]
            for t in dataset.trials() if t["medicine"].lower() == medicine.lower()
        }
        state = EFF_NOT_REPORTED if bases == {"not_reported"} else EFF_INSUFFICIENT
    elif women_only:
        state = EFF_WOMEN_ONLY
    elif "significant" in drug_sigs and "no_significant_difference" in drug_sigs:
        state = EFF_CONFLICTING
    elif "significant" in drug_sigs:
        state = EFF_SIGNIFICANT
    elif has_drug_comparison and drug_sigs <= {"no_significant_difference", "not_tested"}:
        state = EFF_NO_DIFF
    else:
        # Estimates were reported for women and men, but no formal drug-specific
        # comparison was located. We do NOT infer equality.
        state = EFF_REPORTED_UNCLEAR

    headline = {
        EFF_SIGNIFICANT: "A drug-specific sex difference in effectiveness was reported.",
        EFF_NO_DIFF: "A drug-specific sex comparison was reported and found no significant difference.",
        EFF_REPORTED_UNCLEAR: (
            f"Effectiveness was reported separately for women and men, but a formal "
            f"{medicine.lower()}-specific sex-by-treatment interaction test was not located in "
            "the reviewed sources."),
        EFF_WOMEN_ONLY: (
            "Effectiveness outcomes were reported in an explicitly defined women-only population. "
            "The study did not compare outcomes between women and men."
        ),
        EFF_CONFLICTING: "Drug-specific sex-specific effectiveness results conflict across sources.",
        EFF_INSUFFICIENT: "Not enough sex-specific effectiveness evidence to draw a conclusion.",
        EFF_NOT_REPORTED: "Effectiveness was not analysed separately for women in the reviewed trials.",
    }[state]

    return {
        "dimension": "sex_specific_effectiveness",
        "state": state,
        "evidence_level": "drug_specific",
        "headline": headline,
        "n_reporting": counts["n_reporting"],
        "n_trials": counts["n_trials"],
        "caveat": ("'No significant difference' does not mean identical effectiveness, and "
                   "'insufficient evidence' does not mean the medicine is ineffective in women."),
        "findings": [_finding_view(f) for f in drug_findings],
        "class_level_findings": [_finding_view(f) for f in class_findings],
        "class_level_note": (
            "Class-level evidence describes the statin class as a whole, not this medicine "
            "specifically. It is shown for context and does not change the drug-specific result "
            "above." if class_findings else None),
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
    women_only = bool(drug_specific) and all(
        f.get("population_scope") == "women_only_life_stage" for f in drug_specific
    )
    women_report_only = bool(drug_specific) and all(
        f.get("reporting_scope") == "women_only_narrative" for f in drug_specific
    )

    if women_only:
        state = SAF_WOMEN_ONLY
    elif women_report_only:
        state = SAF_WOMEN_REPORTED_NO_COMPARISON
    elif "significant" in sigs:
        state = SAF_SIGNIFICANT
    elif "trend_only" in sigs:
        state = SAF_TRENDS
    elif drug_specific and any(
        f.get("significance") == "no_significant_difference"
        and (f.get("comparison_p") is not None or f.get("comparison_test"))
        for f in drug_specific
    ):
        # Only claim "no significant difference" when a real BETWEEN-SEX comparison exists.
        state = SAF_NO_DIFF
    elif drug_specific and reporting > 0:
        # Safety was reported by sex, but the source only compares each sex against
        # placebo. No between-sex test was reported, so neither difference nor
        # equivalence may be asserted.
        state = SAF_REPORTED_NO_COMPARISON
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
        SAF_REPORTED_NO_COMPARISON: (
            "Safety outcomes were reported separately by sex, with no excess versus placebo "
            "reported in either sex. A formal between-sex safety comparison was not reported."),
        SAF_WOMEN_ONLY: (
            "Side effects were reported in an explicitly defined women-only population. "
            "The study did not compare side effects between women and men."
        ),
        SAF_WOMEN_REPORTED_NO_COMPARISON: (
            "The publication discussed safety in women, but a formal between-sex "
            "adverse-event comparison was not located."
        ),
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
        if not any(
            dataset.assertion_value(
                t, "outcomes_stratified_by_life_stage_and_hormone_context"
            )[0] == "yes"
            for t in trial_ids
        ):
            gaps.append("No joint life-stage and hormone-context analysis")
        rows.append({
            "medicine": med,
            "drug_class": drug_class,
            "maturity_level": m["level"],
            "maturity_scorable": m["scorable"],
            "maturity_display": m["display"],
            "maturity_label": m["label"],
            "effectiveness_state": eff["state"],
            "safety_state": saf["state"],
            "key_gap": gaps[0] if gaps else "None identified",
            "n_trials": len(trial_ids),
        })
    # Scored medicines first (by maturity desc); unscored medicines listed after,
    # explicitly NOT ranked.
    rows.sort(key=lambda r: (not r["maturity_scorable"], -r["maturity_level"], r["medicine"]))

    scored = [r for r in rows if r["maturity_scorable"]]
    cls = drug_class.lower()
    cls_plural = cls + "s"
    if len(scored) >= 2:
        ranking = {
            "rankable": True,
            "summary": f"Evidence maturity rank shown for {len(scored)} of {len(meds)} reviewed {cls_plural}.",
            "basis": "Based on women-specific evidence maturity, not clinical effectiveness.",
        }
    else:
        med_word = cls if len(scored) == 1 else cls_plural
        rep_word = cls if len(meds) == 1 else cls_plural
        ranking = {
            "rankable": False,
            "summary": (f"{len(scored)} {med_word} currently has a verified Evidence Maturity score; "
                        f"{len(meds)} {rep_word} currently represented in AMIRA."),
            "basis": ("Medicines without enough verified evidence to establish a maturity level are "
                      "not ranked."),
        }

    return {
        "drug_class": drug_class,
        "verified_count": len(meds),
        "verified_medicines": meds,
        "scored_count": len(scored),
        "ranking": ranking,
        "sort": "evidence_maturity_desc_then_unscored",
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
            "source_label": t.get("primary_source_label") or (
                "ClinicalTrials.gov" if t.get("nct_id") else "Primary publication"
            ),
            "age_note": "Age eligibility only. Age is not used to infer menopausal status.",
        })
    return out
