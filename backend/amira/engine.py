"""Evidence engine: computes every displayed number from the normalized dataset.

Count-basis safety
------------------
A `reported` count (stated in a source) and a `derived` count (computed by AMIRA)
are never silently summed. Where the corpus mixes bases, the engine returns the
reported subtotal AND a clearly-labelled estimate, never a single number that
claims to be reported when part of it was derived.

Life stage / hormone therapy
----------------------------
Selections are applied against what the corpus actually reports. Because the
frozen corpus reports neither menopausal status nor hormone therapy use, any
specific selection returns a bounded response naming exactly what is missing.
Age eligibility is surfaced as a fact but is NEVER converted into a menopausal
status claim.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from . import clinical, dataset, maturity

# The five agreed clinical life stages, plus an explicit "not specified" default.
# Age is NEVER used to infer any of these — a specific stage returns a bounded
# response unless a source actually reports menopausal status.
LIFE_STAGES = {
    "childhood_prepubertal", "puberty_adolescence", "reproductive_years",
    "perimenopause", "menopause_postmenopause", "not_specified",
}
HORMONE_THERAPY = {"yes", "no", "any", "not_specified"}

# Dimensions surfaced as the UI's evidence cards.
CARD_DIMENSIONS = [
    ("sex_specific_efficacy_reported", "Sex-specific outcomes",
     "studies reported results separately for women"),
    ("menopause_status_reported", "Menopause status",
     "studies reported menopausal status"),
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

    women_estimated_total = women_reported + estimated_extra
    basis = "reported" if not trials_with_pct_only else "mixed_reported_and_derived"

    women_pct_of_participants = (
        round(women_estimated_total / participants_total * 100, 1)
        if participants_total else None
    )

    return {
        "trials": len(trial_ids),
        "participants_total": participants_total,
        "participants_basis": "reported" if participants_basis_ok else "incomplete",
        "women_reported_count": women_reported,
        "women_reported_basis": "reported",
        "trials_with_reported_female_count": trials_with_reported_count,
        "trials_with_percentage_only": trials_with_pct_only,
        "women_estimated_total": women_estimated_total,
        "women_estimated_basis": basis,
        "women_estimate_components": estimate_components,
        "women_pct_of_participants": women_pct_of_participants,
        "women_pct_basis": "derived",
        "count_basis_warning": (
            "An exact female participant count is published for "
            f"{len(trials_with_reported_count)} of {len(trial_ids)} trials. "
            "The remaining trial(s) report only a percentage, so the combined figure is "
            "part reported and part derived and is labelled accordingly."
        ) if trials_with_pct_only else None,
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

    No trial in the frozen corpus reports menopausal status, so no life stage can
    be evidenced. Age eligibility is reported as a fact, explicitly not as a
    menopause claim.
    """
    reporting = [t for t in trial_ids
                 if dataset.assertion_value(t, "menopause_status_reported")[0] == dataset.AFFIRMATIVE]

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
        message = ("No life stage filter applied. Menopausal status is not reported by any "
                   "trial in the reviewed corpus.")
        status = "no_filter_applied"
    elif reporting:
        message = f"{len(reporting)} trial(s) report menopausal status."
        status = "supported"
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
    reporting = [t for t in trial_ids
                 if dataset.assertion_value(t, "hormone_therapy_reported")[0] == dataset.AFFIRMATIVE]

    if hormone_therapy in ("any", "not_specified"):
        status = "no_filter_applied"
        message = ("No hormone therapy filter applied. Hormone therapy use is not reported "
                   "by any trial in the reviewed corpus.")
        supported = True
    elif reporting:
        status = "supported"
        message = f"{len(reporting)} trial(s) report hormone therapy use."
        supported = True
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
            "year": int((t.get("completion_date") or t.get("start_date") or "0")[:4] or 0) or None,
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
    women = totals["women_reported_count"]
    if not mat["scorable"]:
        return (
            f"{medicine}'s evidence maturity is not yet established: female enrolment evidence "
            "was not located in the reviewed accessible sources. This reflects incomplete source "
            "coverage, not confirmed absence of evidence."
        )
    return (
        f"{medicine} reached evidence maturity {mat['display']} ({mat['label']}): "
        f"{women:,} women have a reported count and effectiveness was analysed by sex, but no "
        f"formal {medicine.lower()}-specific interaction test, menopausal status, hormone therapy, "
        f"or sex-stratified side-effect analysis was located in the reviewed sources."
    )


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
    med_ncts = {t["nct_id"] for t in matched}
    med_pubs = [s for s in dataset.sources()
                if s.get("source_type") == "journal_article" and s.get("nct_id") in med_ncts]

    return {
        "candidate_records_screened": len(rows),
        "evidence_sources_included": len(included),
        "records_excluded": len(excluded),
        "records_deferred": len(deferred),
        "unique_phase3_rcts_identified": len(included_ncts),
        "publications_included": len(included_pubs),
        "rcts_for_selected_medicine": len(matched),
        "publications_for_selected_medicine": len(med_pubs),
        "medicine": medicine,
        "reconciliation": (
            f"{len(rows)} candidate records screened → {len(included)} evidence sources included "
            f"({len(included_ncts)} unique Phase 3 RCTs + {len(included_pubs)} linked publications). "
            f"The 'Studies included' figure counts the {len(matched)} Phase 3 RCT(s) for "
            f"{medicine} shown on this page."
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
