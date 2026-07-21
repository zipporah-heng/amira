"""Evidence engine: computes every displayed number from the normalized dataset.

Count-basis safety
------------------
A `reported` count (stated in a source) and a `derived` count (computed by AMIRA)
are never silently summed. Where the corpus mixes bases, the engine returns the
reported subtotal AND a clearly-labelled estimate, never a single number that
claims to be reported when part of it was derived.

Life stage / hormone therapy
----------------------------
Selections are applied against what each medicine's reviewed evidence actually
reports. Age eligibility is surfaced as a fact but is NEVER converted into a
menopausal-status claim.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from . import clinical, dataset, flags, maturity, readiness

# The five agreed clinical life stages, plus an explicit "not specified" default.
# Age is NEVER used to infer any of these — a specific stage returns a bounded
# response unless a source actually reports menopausal status.
LIFE_STAGES = {
    "childhood_prepubertal", "puberty_adolescence", "reproductive_years",
    "perimenopause", "menopause_postmenopause", "not_specified",
}
HORMONE_THERAPY = {"yes", "no", "any", "not_specified"}

# Dimensions surfaced as the UI's summary evidence cards (below the hero).
CARD_DIMENSIONS = [
    ("sex_specific_efficacy_reported", "Sex-specific outcomes",
     "trials reported sex-specific effectiveness outcomes"),
    ("sex_specific_safety_reported", "Sex-specific safety",
     "trials reported adverse events separately by sex"),
    ("menopause_status_reported", "Menopause status",
     "trials reported menopausal status"),
    ("hormone_therapy_reported", "Hormone therapy",
     "studies reported hormone therapy use"),
    ("pregnancy_evidence_reported", "Pregnancy",
     "studies included pregnancy-specific evidence"),
]


def _norm(v: Optional[str], default: str) -> str:
    return (v or default).strip().lower().replace(" ", "_")


def _source_links(assertion: dict) -> dict:
    s = dataset.source_by_id(assertion["source_id"])
    return {
        "source_id": s["source_id"],
        "title": s["title"],
        "source_type": s["source_type"],
        "publisher": s.get("publisher"),
        "year": s.get("year"),
        "nct_id": s.get("nct_id"),
        "pmid": s.get("pmid"),
        "pmcid": s.get("pmcid"),
        "url": s["url"],
        "license_note": s.get("license_note"),
    }


def _assertion_view(a: dict) -> dict:
    return {
        "assertion_id": a["assertion_id"],
        "trial_id": a["trial_id"],
        "dimension": a["dimension"],
        "value": a["value"],
        "value_basis": a["value_basis"],
        "exact_passage": a["exact_passage"],
        "source_locator": a.get("source_locator"),
        "source_verified": a.get("source_verified", False),
        "human_verified": a.get("human_verified", False),
        "verifier": a.get("verifier"),
        "notes": a.get("notes", ""),
        "source": _source_links(a),
    }


# --------------------------------------------------------------------------- #
# Aggregation
# --------------------------------------------------------------------------- #
def aggregate_participants(trial_ids: List[str]) -> dict:
    """Totals with explicit basis handling. Never mixes reported and derived."""
    participants_total = 0
    participants_basis_ok = True
    women_reported = 0
    trials_with_reported_count: List[str] = []
    trials_with_pct_only: List[str] = []
    trials_without_women_data: List[str] = []
    estimated_extra = 0
    estimate_components: List[dict] = []

    for tid in trial_ids:
        total, t_basis, _ = dataset.assertion_value(tid, "total_enrollment")
        if t_basis == "reported" and isinstance(total, (int, float)):
            participants_total += int(total)
        else:
            participants_basis_ok = False

        count, c_basis, _ = dataset.assertion_value(tid, "female_enrollment_count")
        if c_basis == "reported" and isinstance(count, (int, float)):
            women_reported += int(count)
            trials_with_reported_count.append(tid)
            continue

        pct, p_basis, _ = dataset.assertion_value(tid, "female_enrollment_pct")
        if p_basis == "reported" and isinstance(pct, (int, float)) and isinstance(total, (int, float)):
            est = int(round(float(pct) / 100.0 * int(total)))
            estimated_extra += est
            trials_with_pct_only.append(tid)
            estimate_components.append({
                "trial_id": tid, "reported_pct": pct, "total_enrollment": int(total),
                "derived_count": est,
                "note": "Derived by AMIRA from a reported percentage; no exact count is published.",
            })
        else:
            trials_without_women_data.append(tid)

    women_estimated_total = women_reported + estimated_extra
    if trials_without_women_data:
        basis = "incomplete"
    elif trials_with_pct_only:
        basis = "mixed_reported_and_derived"
    else:
        basis = "reported"

    women_pct_of_participants = (
        round(women_estimated_total / participants_total * 100, 1)
        if participants_total and not trials_without_women_data else None
    )

    if trials_without_women_data:
        count_warning = (
            "Women-count coverage is incomplete: an exact count or percentage is available for "
            f"{len(trial_ids) - len(trials_without_women_data)} of {len(trial_ids)} trials. "
            "AMIRA reports the known subtotal and does not calculate a combined percentage."
        )
    elif trials_with_pct_only:
        count_warning = (
            "An exact female participant count is published for "
            f"{len(trials_with_reported_count)} of {len(trial_ids)} trials. "
            "The remaining trial(s) report only a percentage, so the combined figure is "
            "part reported and part derived and is labelled accordingly."
        )
    else:
        count_warning = None

    return {
        "trials": len(trial_ids),
        "participants_total": participants_total,
        "participants_basis": "reported" if participants_basis_ok else "incomplete",
        "women_reported_count": women_reported,
        "women_reported_basis": "reported",
        "trials_with_reported_female_count": trials_with_reported_count,
        "trials_with_percentage_only": trials_with_pct_only,
        "trials_without_female_count_or_percentage": trials_without_women_data,
        "women_estimated_total": women_estimated_total,
        "women_estimated_basis": basis,
        "women_estimate_components": estimate_components,
        "women_pct_of_participants": women_pct_of_participants,
        "women_pct_basis": (
            "not_calculated_incomplete_coverage"
            if trials_without_women_data else "derived"
        ),
        "count_basis_warning": count_warning,
    }


def dimension_summary(trial_ids: List[str]) -> List[dict]:
    out = []
    for dim, title, sub in CARD_DIMENSIONS:
        supporting, absent = [], []
        for tid in trial_ids:
            value, basis, a = dataset.assertion_value(tid, dim)
            if a is None:
                continue
            (supporting if value == dataset.AFFIRMATIVE else absent).append(_assertion_view(a))
        out.append({
            "dimension": dim,
            "title": title,
            "subtitle": sub,
            "n_reporting": len(supporting),
            "n_trials": len(trial_ids),
            "display": f"{len(supporting)} / {len(trial_ids)}",
            "supporting_assertions": supporting,
            "non_reporting_assertions": absent,
        })
    return out


# --------------------------------------------------------------------------- #
# Context filtering
# --------------------------------------------------------------------------- #
def life_stage_context(life_stage: str, trial_ids: List[str]) -> dict:
    """Life stage genuinely changes the returned context.

    Age eligibility is reported as a fact, explicitly not as a menopause claim.
    Only an affirmative source assertion can support a selected life stage.
    """
    all_reporting = [
        t for t in trial_ids
        if dataset.assertion_value(t, "menopause_status_reported")[0] == dataset.AFFIRMATIVE
    ]
    if life_stage == "not_specified":
        reporting = all_reporting
    else:
        reporting = [
            tid for tid in all_reporting
            if life_stage in next(
                t for t in dataset.trials() if t["trial_id"] == tid
            ).get("reported_life_stages", [])
        ]

    age_facts = []
    for tid in trial_ids:
        t = next(x for x in dataset.trials() if x["trial_id"] == tid)
        age_facts.append({
            "trial_id": tid,
            "minimum_age": t.get("minimum_age"),
            "sex_eligibility": t.get("sex_eligibility"),
            "registry_url": t.get("registry_url"),
        })

    supported = bool(reporting) or life_stage == "not_specified"
    if life_stage == "not_specified":
        message = (
            f"No life stage filter applied. {len(reporting)} reviewed trial(s) explicitly "
            "report menopausal status."
            if reporting else
            "No life stage filter applied. Menopausal status is not reported by any "
            "trial in the reviewed evidence."
        )
        status = "no_filter_applied"
    elif reporting:
        message = f"{len(reporting)} trial(s) report menopausal status."
        status = "supported"
    elif all_reporting:
        message = (
            "The reviewed evidence reports a different life stage, not the selected life stage. "
            "Age is not used to infer menopausal status."
        )
        status = "life_stage_not_represented"
    else:
        message = (
            f"No trial in the reviewed corpus reports menopausal status, so AMIRA cannot "
            f"determine which participants were {life_stage.replace('_', ' ')}. "
            "The trials restricted enrolment by age, but age is not used to infer "
            "menopausal status."
        )
        status = "not_established_in_corpus"

    return {
        "selected": life_stage,
        "status": status,
        "supported": supported,
        "message": message,
        "trials_reporting_menopausal_status": reporting,
        "age_eligibility_facts": age_facts,
        "inference_policy": "Age is never used to infer menopausal status.",
    }


def hormone_therapy_context(hormone_therapy: str, trial_ids: List[str]) -> dict:
    all_reporting = [
        t for t in trial_ids
        if dataset.assertion_value(t, "hormone_therapy_reported")[0] == dataset.AFFIRMATIVE
    ]

    def _matches(tid: str) -> bool:
        trial = next(t for t in dataset.trials() if t["trial_id"] == tid)
        population = trial.get("hormone_therapy_population")
        if hormone_therapy == "yes":
            return population == "using"
        if hormone_therapy == "no":
            return population in ("not_using", "excluded_current_or_prior")
        return True

    reporting = all_reporting if hormone_therapy in ("any", "not_specified") else [
        tid for tid in all_reporting if _matches(tid)
    ]

    if hormone_therapy in ("any", "not_specified"):
        status = "no_filter_applied"
        message = (
            f"No hormone therapy filter applied. {len(reporting)} reviewed trial(s) explicitly "
            "report hormone therapy criteria or use."
            if reporting else
            "No hormone therapy filter applied. Hormone therapy use is not reported "
            "by any trial in the reviewed evidence."
        )
        supported = True
    elif reporting:
        status = "supported"
        message = (
            f"{len(reporting)} trial(s) explicitly represent people who are "
            f"{'using' if hormone_therapy == 'yes' else 'not using'} menopausal hormone therapy."
        )
        supported = True
    elif all_reporting:
        status = "hormone_therapy_population_not_represented"
        message = (
            "Hormone therapy was explicitly reported, but the selected population was not "
            "represented. In the reviewed postmenopausal study, current or prior hormone "
            "replacement therapy was an exclusion criterion."
        )
        supported = False
    else:
        status = "not_established_in_corpus"
        message = (
            f"No trial in the reviewed corpus reports hormone therapy use, so AMIRA cannot "
            f"report evidence specific to people who are {'using' if hormone_therapy == 'yes' else 'not using'} "
            "menopausal hormone therapy."
        )
        supported = False

    return {
        "selected": hormone_therapy,
        "status": status,
        "supported": supported,
        "message": message,
        "trials_reporting_hormone_therapy": reporting,
        "trials_with_any_hormone_therapy_reporting": all_reporting,
    }


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def check_evidence(condition: str, medicine: str,
                   life_stage: str = "not_specified",
                   hormone_therapy: str = "any") -> dict:
    m = dataset.manifest()
    life_stage = _norm(life_stage, "not_specified")
    hormone_therapy = _norm(hormone_therapy, "any")

    if life_stage not in LIFE_STAGES:
        life_stage = "not_specified"
    if hormone_therapy not in HORMONE_THERAPY:
        hormone_therapy = "any"

    all_trials = dataset.trials()
    matched = [
        t for t in all_trials
        if t["medicine"].strip().lower() == (medicine or "").strip().lower()
    ]

    envelope = {
        "dataset_version": m["dataset_version"],
        "source_cutoff": m["source_cutoff"],
        "commit_hash": m["commit_hash"],
        "generated_at": m["generated_at"],
        "human_verification_status": m.get("human_verification_status", "pending"),
        "query": {
            "condition": condition, "medicine": medicine,
            "life_stage": life_stage, "hormone_therapy": hormone_therapy,
        },
    }

    if not matched:
        supported_meds = sorted({t["medicine"] for t in all_trials})
        envelope.update({
            "supported": False,
            "bounded_response": {
                "status": "medicine_not_in_corpus",
                "message": (
                    f"'{medicine}' is not in the reviewed evidence corpus. AMIRA only "
                    f"reports on evidence it has actually ingested and verified. "
                    f"Currently available: {', '.join(supported_meds)}."
                ),
                "supported_medicines": supported_meds,
            },
            "maturity": None, "totals": None, "dimensions": [], "trials": [],
            "sources": [],
        })
        return envelope

    trial_ids = [t["trial_id"] for t in matched]
    drug_class = matched[0].get("drug_class") or "Statin"
    indication = matched[0].get("indication")

    mat = maturity.evaluate(trial_ids)
    effectiveness = clinical.effectiveness_state(medicine)
    safety = clinical.safety_state(medicine)
    comparison = clinical.class_comparison(drug_class)

    trial_rows = []
    for t in matched:
        f_count, f_basis, f_a = dataset.assertion_value(t["trial_id"], "female_enrollment_count")
        p_val, p_basis, p_a = dataset.assertion_value(t["trial_id"], "female_enrollment_pct")
        row = {
            "trial_id": t["trial_id"],
            "display_name": t["display_name"],
            "nct_id": t["nct_id"],
            "year": t.get("publication_year") or (
                int((t.get("completion_date") or t.get("start_date") or "0")[:4] or 0) or None
            ),
            "study_type": t["study_type"],
            "total_enrollment": t["enrollment_actual"],
            "female_n": f_count if f_basis == "reported" else None,
            "female_n_basis": f_basis,
            "female_pct": p_val if p_basis in ("reported", "derived") else None,
            "female_pct_basis": p_basis,
            "registry_url": t["registry_url"],
            "minimum_age": t.get("minimum_age"),
            "assertions": [
                _assertion_view(a) for a in dataset.assertions()
                if a["trial_id"] == t["trial_id"]
            ],
            "source_label": t.get("primary_source_label") or (
                "ClinicalTrials.gov" if t.get("nct_id") else "Primary publication"
            ),
        }
        for dim, _, _ in CARD_DIMENSIONS:
            v, b, _a = dataset.assertion_value(t["trial_id"], dim)
            row[dim] = v if b != "absent" else "not_reported"
        trial_rows.append(row)

    totals = aggregate_participants(trial_ids)
    why = _why_this_result(medicine, drug_class, mat, effectiveness, safety, totals)

    return {
        **envelope,
        "supported": True,
        "bounded_response": None,
        "medicine_profile": {
            "medicine": medicine, "drug_class": drug_class, "indication": indication,
            "trials": [t["display_name"] for t in matched],
        },
        "banner": {
            "medicine": medicine,
            "drug_class": drug_class,
            "indication": indication,
            "maturity": {"level": mat["level"], "max_level": mat["max_level"],
                         "label": mat["label"], "display": mat["display"],
                         "scorable": mat["scorable"]},
            "effectiveness": {"state": effectiveness["state"], "headline": effectiveness["headline"],
                              "evidence_level": effectiveness.get("evidence_level")},
            "safety": {"state": safety["state"], "headline": safety["headline"]},
            "class_comparison": {
                "drug_class": drug_class,
                "verified_count": comparison["verified_count"],
                "scored_count": comparison["scored_count"],
                "this_rank": _rank_of(medicine, comparison),
                "summary": comparison["ranking"]["summary"],
                "basis": comparison["ranking"]["basis"],
                "rankable": comparison["ranking"]["rankable"],
            },
            "why_this_result": why,
        },
        "maturity": mat,
        "effectiveness": effectiveness,
        "safety": safety,
        "class_comparison": comparison,
        "direct_comparisons": [
            clinical.direct_comparison_view(c)
            for c in dataset.direct_comparisons_for(medicine)
        ],
        "who_was_studied": clinical.who_was_studied(trial_ids),
        "study_selection": study_selection(medicine, matched),
        "totals": totals,
        "dimensions": dimension_summary(trial_ids),
        "evidence_gaps": evidence_gaps(trial_ids, effectiveness, safety),
        "trials": trial_rows,
        "life_stage_context": life_stage_context(life_stage, trial_ids),
        "hormone_therapy_context": hormone_therapy_context(hormone_therapy, trial_ids),
        "sources": dataset.sources(),
        "evaluation_status": "EVALUATION PENDING",
        # Pilot 0-100 readiness score (deterministic, feature-flagged). The maturity
        # 1-5 level above is the scientifically implemented measure; this is a
        # provisional completeness lens under expert review.
        "readiness": readiness.evaluate(medicine) if flags.enable_pilot_score() else None,
        "feature_flags": flags.snapshot(),
    }


def _rank_of(medicine: str, comparison: dict) -> str:
    """Only return a rank when at least two medicines are actually scorable, and
    only for a scorable medicine. Rank is over scored medicines, never over unscored."""
    if not comparison["ranking"]["rankable"]:
        return ""
    scored = [r for r in comparison["rows"] if r["maturity_scorable"]]
    for i, r in enumerate(scored, 1):
        if r["medicine"].lower() == medicine.lower():
            return f"Evidence maturity rank: {i} of {len(scored)} reviewed {comparison['drug_class'].lower()}s"
    return ""


def _why_this_result(medicine, drug_class, mat, eff, saf, totals) -> str:
    """Compose the one-line explanation from what the evidence ACTUALLY shows.

    Every clause is derived from the reviewed records, so this can never contradict
    the hero states rendered above it.
    """
    women = totals["women_reported_count"]
    if not mat["scorable"]:
        return (
            f"{medicine}'s evidence maturity is not yet established: female enrolment evidence "
            "was not located in the reviewed accessible sources. This reflects incomplete source "
            "coverage, not confirmed absence of evidence."
        )

    # A drug-specific interaction test only counts when it comes from a trial-scoped
    # finding for this medicine — class-level tests never justify a drug conclusion.
    drug_findings = [f for f in eff["findings"] if f["scope"].startswith("trial:")]
    interaction = next((f for f in drug_findings if f.get("comparison_p") is not None), None)

    missing_count_trials = totals.get("trials_without_female_count_or_percentage", [])
    if missing_count_trials:
        have: List[str] = [
            f"an exact count of {women:,} women was reported in "
            f"{len(totals['trials_with_reported_female_count'])} of {totals['trials']} studies"
        ]
    else:
        have = [f"{women:,} women were included"]
    missing: List[str] = []

    if eff["n_reporting"] > 0:
        if eff["state"] == clinical.EFF_WOMEN_ONLY:
            have.append("outcomes were reported in an explicitly defined women-only life-stage study")
        elif eff["state"] == clinical.EFF_CONFLICTING:
            have.append(
                "sex-specific findings differed between the historical post hoc analysis and "
                "the contemporary low-dose trial"
            )
        elif interaction:
            clause = ("effectiveness was analysed by sex with a formal sex-by-treatment "
                      f"interaction test (P = {interaction['comparison_p']})")
            if interaction["significance"] == "no_significant_difference":
                clause += " showing no statistically significant difference"
            have.append(clause)
        else:
            have.append("effectiveness was analysed by sex")
            missing.append(f"a formal {medicine.lower()}-specific sex-by-treatment interaction test")
    else:
        missing.append("sex-specific effectiveness analysis")

    # Safety is stated as its own sentence so the bound on the claim cannot be lost
    # in a long clause list.
    safety_sentence = ""
    if saf["n_reporting"] > 0:
        if saf["state"] == clinical.SAF_WOMEN_ONLY:
            safety_sentence = (
                " Side effects were reported in the women-only life-stage study; this was a "
                "comparison between treatment regimens, not between women and men."
            )
        elif saf["state"] == clinical.SAF_WOMEN_REPORTED_NO_COMPARISON:
            safety_sentence = (
                " The contemporary publication discussed low-dose safety in women, but a formal "
                "between-sex adverse-event comparison was not located."
            )
        elif saf["state"] == clinical.SAF_NO_DIFF:
            safety_sentence = (" Safety outcomes were reported separately by sex, and a formal "
                               "between-sex comparison found no significant difference.")
        elif saf["state"] == clinical.SAF_REPORTED_NO_COMPARISON:
            safety_sentence = (" Safety outcomes were reported separately by sex, with no excess "
                               "versus placebo reported in either sex. A formal between-sex safety "
                               "comparison was not reported.")
        else:
            safety_sentence = " Safety outcomes were reported separately by sex."
    else:
        missing.append("sex-stratified side-effect analysis")

    trace = {r["level"]: r["satisfied"] for r in mat["rule_trace"]}
    if not trace.get(3):
        missing.append("menopausal status")
    if not trace.get(4):
        missing.append("hormone therapy use")
    if trace.get(4) and not trace.get(5):
        missing.append("joint stratification of outcomes by life stage and hormone context")

    sentence = (f"{medicine} reached Evidence Maturity {mat['level']}/{mat['max_level']} "
                f"({mat['label']}): "
                + ", ".join(have[:-1]) + (", and " if len(have) > 1 else "") + have[-1] + ".")
    sentence += safety_sentence
    if missing:
        joined = (", ".join(missing[:-1]) + (" and " if len(missing) > 1 else "") + missing[-1])
        sentence += f" {joined[0].upper()}{joined[1:]} " + (
            "were not reported in the reviewed evidence."
            if len(missing) > 1 else "was not reported in the reviewed evidence."
        )
    return sentence


def study_selection(medicine: str, matched: List[dict]) -> dict:
    """Reconcile study-selection counts by clearly-defined scope, so the
    'Studies included' card and the screening section can never be confused."""
    rows = dataset.load()["screening_log"]
    included = [r for r in rows if r["decision"] == "include"]
    excluded = [r for r in rows if r["decision"] == "exclude"]
    deferred = [r for r in rows if r["decision"] == "defer"]

    included_ncts = {r["candidate"] for r in included if r["identifier_type"] == "nct"}
    included_pubs = [r for r in included if r["identifier_type"] in ("pmid", "pmcid")]

    # Publications in the dataset linked to THIS medicine's trials.
    med_ncts = {t["nct_id"] for t in matched if t.get("nct_id")}
    med_primary_sources = {t.get("primary_source_id") for t in matched}
    med_pubs = [s for s in dataset.sources()
                if s.get("source_type") == "journal_article"
                and (s.get("nct_id") in med_ncts or s.get("source_id") in med_primary_sources)]

    return {
        "candidate_records_screened": len(rows),
        "evidence_sources_included": len(included),
        "records_excluded": len(excluded),
        "records_deferred": len(deferred),
        "trial_registry_records_included": len(included_ncts),
        "randomized_studies_in_corpus": len(dataset.trials()),
        "randomized_studies_for_selected_medicine": len(matched),
        # Retained for API compatibility; the value now means included registry
        # records, not an assertion that every study is Phase 3.
        "unique_phase3_rcts_identified": len(included_ncts),
        "publications_included": len(included_pubs),
        "rcts_for_selected_medicine": len(matched),
        "publications_for_selected_medicine": len(med_pubs),
        "medicine": medicine,
        "reconciliation": (
            f"{len(rows)} candidate records screened. {len(included)} evidence sources were "
            f"included: {len(included_ncts)} trial registry records and "
            f"{len(included_pubs)} publication records. The corpus represents "
            f"{len(dataset.trials())} randomized studies; {len(matched)} are shown for {medicine}."
        ),
    }


def evidence_gaps(trial_ids: List[str], effectiveness: dict, safety: dict) -> List[dict]:
    """Measurable gap statements with exact counts."""
    gaps = []
    for dim, label in [
        ("menopause_status_reported", "Menopause status"),
        ("hormone_therapy_reported", "Hormone therapy"),
        ("pregnancy_evidence_reported", "Pregnancy-specific evidence"),
    ]:
        reporting = sum(1 for t in trial_ids if dataset.assertion_value(t, dim)[0] == "yes")
        gaps.append({
            "dimension": dim, "label": label,
            "n_reporting": reporting, "n_trials": len(trial_ids),
            "statement": f"Not reported in {len(trial_ids) - reporting} of {len(trial_ids)} included trials.",
        })
    gaps.append({
        "dimension": "sex_specific_effectiveness", "label": "Sex-specific effectiveness",
        "n_reporting": effectiveness["n_reporting"], "n_trials": effectiveness["n_trials"],
        "statement": f"Analysed in {effectiveness['n_reporting']} of {effectiveness['n_trials']} included trials.",
    })
    gaps.append({
        "dimension": "sex_specific_safety", "label": "Sex-specific safety",
        "n_reporting": safety["n_reporting"], "n_trials": safety["n_trials"],
        "statement": f"Analysed in {safety['n_reporting']} of {safety['n_trials']} included trials.",
    })
    return gaps
