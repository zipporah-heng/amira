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

import re
from typing import Dict, List, Optional

from . import clinical, dataset, flags, maturity, readiness


def _first_sentence(text: str) -> str:
    """First sentence of a finding, split ONLY on a period followed by whitespace.

    This never truncates a decimal such as ``0.79`` (there is no space after the
    decimal point), fixing the "HR 0." bug from a naive ``split('.')``."""
    text = (text or "").strip()
    if not text:
        return ""
    first = re.split(r"\.\s+", text, maxsplit=1)[0].rstrip(". ")
    return first + "."


def _ci_bounds(ci: Optional[str]):
    """Extract (lower, upper) numeric bounds from a CI string like
    '95% CI 0.59-1.06' or '95% CI, 0.37 to 0.80'. Returns None if not parseable."""
    if not ci:
        return None
    nums = re.findall(r"\d+(?:\.\d+)?", ci.replace("95%", "").replace("CI", ""))
    vals = [float(n) for n in nums]
    if len(vals) >= 2:
        return vals[-2], vals[-1]
    return None


def _ci_crosses_one(ci: Optional[str]) -> bool:
    b = _ci_bounds(ci)
    return bool(b and b[0] < 1.0 < b[1])

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
    sid = assertion.get("source_id")
    try:
        s = dataset.source_by_id(sid)
    except dataset.DatasetError:
        # Fail closed, do not crash: a dangling source is surfaced as unresolved,
        # never as a usable citation.
        return {"source_id": sid, "title": None, "source_type": None, "publisher": None,
                "year": None, "nct_id": None, "pmid": None, "pmcid": None,
                "url": None, "license_note": None, "resolved": False}
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
        "resolved": dataset.authoritative_url_ok(s.get("url", "")),
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
    trials_with_reported_total: List[str] = []
    trials_without_reported_total: List[str] = []
    estimated_extra = 0
    estimate_components: List[dict] = []

    for tid in trial_ids:
        # Totals only through the verified projection (reported + verified + authoritative).
        te = dataset.total_enrollment_projection(tid)
        total = te["value"]
        total_ok = te["coverage"] == "complete"
        if total_ok:
            participants_total += int(total)
            trials_with_reported_total.append(tid)
        else:
            participants_basis_ok = False
            trials_without_reported_total.append(tid)

        cv = dataset.assertion_validity(tid, "female_enrollment_count", require_numeric=True)
        if cv["valid"] and cv["basis"] == "reported":
            women_reported += int(cv["value"])
            trials_with_reported_count.append(tid)
            continue

        pv = dataset.assertion_validity(tid, "female_enrollment_pct", require_numeric=True)
        # Derive a female count from a percentage only when the percentage is a
        # verified REPORTED value AND the SAME trial's total is verified-supported.
        if pv["valid"] and pv["basis"] == "reported" and total_ok:
            est = int(round(float(pv["value"]) / 100.0 * int(total)))
            estimated_extra += est
            trials_with_pct_only.append(tid)
            estimate_components.append({
                "trial_id": tid, "reported_pct": pv["value"], "total_enrollment": int(total),
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

    # A combined female percentage is only valid when BOTH coverages are complete
    # over the SAME set of trials: every trial has a reported total AND a
    # reported/derived female count. Otherwise the numerator and denominator would
    # span mismatched populations (e.g. 110 women / 100 supported participants =
    # 110%), which must be impossible. Fail closed to null.
    coverage_matches = (
        not trials_without_reported_total          # total coverage complete
        and not trials_without_women_data          # female coverage complete
        and participants_total > 0
    )
    women_pct_of_participants = (
        round(women_estimated_total / participants_total * 100, 1)
        if coverage_matches else None
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
        # Explicit total-enrollment coverage: the same trials the export leaves
        # blank are the ones excluded from participants_total here.
        "trials_with_reported_total_enrollment": trials_with_reported_total,
        "trials_without_reported_total_enrollment": trials_without_reported_total,
        "participant_total_coverage": "complete" if not trials_without_reported_total else "incomplete",
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
            "derived" if women_pct_of_participants is not None
            else "not_calculated_incomplete_coverage"
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
        # Trusted values only through the canonical verified gate.
        _fv = dataset.assertion_validity(t["trial_id"], "female_enrollment_count", require_numeric=True)
        _pv = dataset.assertion_validity(t["trial_id"], "female_enrollment_pct", require_numeric=True)
        _te = dataset.total_enrollment_projection(t["trial_id"])
        row = {
            "trial_id": t["trial_id"],
            "display_name": t["display_name"],
            "nct_id": t["nct_id"],
            "year": t.get("publication_year") or (
                int((t.get("completion_date") or t.get("start_date") or "0")[:4] or 0) or None
            ),
            "study_type": t["study_type"],
            # Assertion-backed total: a number only when a `reported` total_enrollment
            # assertion with a resolvable source exists — never raw enrollment_actual.
            "total_enrollment": _te["value"],
            "total_enrollment_basis": _te["basis"],
            "total_enrollment_state": _te["state"],
            "female_n": _fv["value"] if (_fv["valid"] and _fv["basis"] == "reported") else None,
            "female_n_basis": f_basis,
            "female_pct": _pv["value"] if _pv["valid"] else None,
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
            # Preserve the evidence state; NEVER collapse absent/not_located into
            # a "not_reported" claim about the literature.
            row[dim] = v if b not in ("absent",) else "absent"
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
            if dataset.verified_evidence(c)   # unverified comparisons never support a conclusion
        ],
        "who_was_studied": clinical.who_was_studied(trial_ids),
        "study_selection": study_selection(medicine, matched),
        "studies_behind": studies_behind(medicine, matched),
        "other_evidence_paths": other_evidence_paths(medicine, matched[0].get("condition") or condition),
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
    # Rank only over completed-ingestion, scorable medicines (never partial ingestion).
    scored = [r for r in comparison["rows"] if r.get("rankable")]
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


def other_evidence_paths(medicine: str, condition: str) -> List[dict]:
    """Other medicines studied for the same condition, shown as SEPARATE evidence
    paths — never as a head-to-head comparison or a treatment recommendation.

    For Digoxin (heart failure) this surfaces Dapagliflozin as its own path, with a
    prominent "not a head-to-head comparison" boundary."""
    cond = (condition or "").strip().lower()
    others = sorted({
        t["medicine"] for t in dataset.trials()
        if (t.get("condition") or "").strip().lower() == cond
        and t["medicine"].strip().lower() != (medicine or "").strip().lower()
    })
    paths = []
    for med in others:
        med_trials = [t for t in dataset.trials() if t["medicine"] == med]
        eff = [f for f in dataset.findings_for(med, "efficacy") if f["scope"].startswith("trial:")]
        if not eff:
            continue
        f = eff[0]
        trial_id = f["scope"].split(":", 1)[1]
        c_val, c_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_count")
        p_val, p_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_pct")
        # Assertion-backed total only (never raw enrollment_actual).
        total = dataset.total_enrollment_projection(trial_id)["value"]
        bullets = []
        if total:
            bullets.append(f"{f['scope'].split(':',1)[1]}: {int(total):,} participants")
        if c_basis == "reported":
            pct = f" ({p_val}%)" if p_basis in ("reported", "derived") else ""
            bullets.append(f"{int(c_val):,} women{pct}")
        if f.get("female_estimate"):
            bullets.append(f"Women {f['female_estimate']}" + (f" ({f['female_ci']})" if f.get("female_ci") else ""))
        if f.get("male_estimate"):
            bullets.append(f"Men {f['male_estimate']}" + (f" ({f['male_ci']})" if f.get("male_ci") else ""))
        if f.get("comparison_p") is not None:
            bullets.append(f"Sex-by-treatment interaction P = {f['comparison_p']}")
        s = dataset.source_by_id(f["source_id"])
        # Full first sentence — NEVER truncated at a decimal (fixes the "HR 0." bug).
        headline = _first_sentence(f["interpretation"]) if f.get("interpretation") else f["endpoint"]
        # When the female CI crosses 1.0, the estimate is statistically inconclusive.
        female_ci = f.get("female_ci")
        inconclusive = _ci_crosses_one(female_ci)
        note = None
        if inconclusive:
            b = _ci_bounds(female_ci)
            rng = f"{b[0]}–{b[1]}" if b else "the reported range"
            note = (f"The estimate ({f.get('female_estimate') or 'the point estimate'}) suggests possible "
                    f"benefit, but the result is statistically inconclusive: the 95% CI ({rng}) crosses 1.0. "
                    "Menopause-specific evidence remains limited or unavailable in the reviewed record.")
        paths.append({
            "medicine": med,
            "drug_class": med_trials[0].get("drug_class"),
            "headline": headline,
            "bullets": bullets,
            "significance": f.get("significance"),
            "female_estimate": f.get("female_estimate"),
            "female_ci": female_ci,
            "ci_crosses_one": inconclusive,
            "interpretation_note": note,
            "boundary": "This is not a head-to-head comparison or treatment recommendation.",
            "source": {"title": s["title"], "url": s["url"], "pmid": s.get("pmid"),
                       "source_type": s["source_type"]},
        })
    return paths


def studies_behind(medicine: str, matched: List[dict]) -> List[dict]:
    """Source records behind a medicine's result, one row per source DOCUMENT.

    A trial can contribute more than one row — e.g. Digoxin shows the DIG registry
    record, the 2002 sex-based DIG analysis publication, and the DECISION primary
    report. Every row's numbers are SOURCE-LOCAL to that row's own trial; a value
    is never borrowed from another trial (DIG never shows DECISION's 284 women)."""
    def _women_display(trial_id: str):
        c_val, c_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_count")
        p_val, p_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_pct")
        if c_basis == "reported":
            pct = f" ({int(p_val)}%)" if p_basis in ("reported", "derived") and p_val is not None else ""
            return f"{int(c_val):,}{pct}", "reported"
        if c_basis == "not_located" or p_basis == "not_located":
            return "Not located", "not_located"
        return "Not reported", "not_reported"

    def _dim_label(trial_id: str, dim: str):
        v, b, _ = dataset.assertion_value(trial_id, dim)
        if v == "yes":
            return "Reported"
        return "Not located" if b == "not_located" else "Not reported"

    def _sex_outcomes(trial_id: str, source_id: str, is_registry: bool):
        # A formal test, when a finding for this trial+source reports one.
        fs = [f for f in dataset.findings()
              if f.get("scope") == f"trial:{trial_id}" and f.get("source_id") == source_id
              and f.get("comparison_p") is not None]
        if fs:
            return f"Formal interaction P={fs[0]['comparison_p']}"
        v, b, _ = dataset.assertion_value(trial_id, "sex_specific_efficacy_reported")
        if v == "yes":
            role = next((t.get("evidence_role", "") for t in matched if t["trial_id"] == trial_id), "")
            return "Reported (post hoc)" if "post_hoc" in role else "Reported"
        return "Not located" if b == "not_located" else "Not reported"

    def _years(trial: dict, source: dict, is_primary_registry: bool):
        if is_primary_registry and (trial.get("start_date") or trial.get("completion_date")):
            s = (trial.get("start_date") or "")[:4]
            e = (trial.get("completion_date") or "")[:4]
            return f"{s}–{e}" if s and e and s != e else (s or e or None)
        return source.get("year")

    def _study_type(trial: dict, source: dict, is_registry: bool):
        phase = trial.get("study_phase")
        if is_registry:
            return f"{phase} RCT" if phase and phase.startswith("Phase") else (trial.get("study_type") or "Trial")
        # A publication: post hoc analysis vs primary report.
        role = trial.get("evidence_role", "")
        has_posthoc_finding = any(
            f.get("scope") == f"trial:{trial['trial_id']}" and f.get("source_id") == source["source_id"]
            and f.get("comparison_p") is not None
            for f in dataset.findings())
        if "post_hoc" in role and has_posthoc_finding:
            return "Post hoc analysis"
        return f"{phase} RCT" if phase and phase.startswith("Phase") else "Primary publication"

    rows: List[dict] = []
    for trial in matched:
        tid = trial["trial_id"]
        primary_sid = trial.get("primary_source_id")
        women_disp, women_basis = _women_display(tid)
        seen_sources = set()

        # 1) The trial's primary source record.
        if primary_sid:
            s = dataset.source_by_id(primary_sid)
            is_reg = s.get("source_type") == "trial_registry_record"
            seen_sources.add(primary_sid)
            rows.append({
                "trial_id": tid,
                "study": f"{trial['display_name']} trial" if is_reg else trial["display_name"],
                "year": _years(trial, s, is_reg),
                "women": women_disp, "women_basis": women_basis,
                "sex_outcomes": _sex_outcomes(tid, primary_sid, is_reg),
                "menopause": _dim_label(tid, "menopause_status_reported"),
                "hormone_therapy": _dim_label(tid, "hormone_therapy_reported"),
                "study_type": _study_type(trial, s, is_reg),
                "source_label": s.get("publisher") or ("ClinicalTrials.gov" if is_reg else "Publication"),
                "source_url": s["url"],
                "record_kind": "trial_registry_record" if is_reg else "primary_publication",
            })

        # 2) Additional publications that carry a sex-specific FINDING for this trial.
        finding_sids = [f["source_id"] for f in dataset.findings()
                        if f.get("scope") == f"trial:{tid}" and f["source_id"] not in seen_sources]
        for sid in dict.fromkeys(finding_sids):  # ordered-unique
            s = dataset.source_by_id(sid)
            seen_sources.add(sid)
            has_formal = any(
                f.get("scope") == f"trial:{tid}" and f.get("source_id") == sid
                and f.get("comparison_p") is not None for f in dataset.findings())
            is_posthoc = "post_hoc" in trial.get("evidence_role", "") and has_formal
            rows.append({
                "trial_id": tid,
                "study": f"Sex-based {trial['display_name']} analysis",
                "year": s.get("year"),
                "women": women_disp, "women_basis": women_basis,
                "sex_outcomes": _sex_outcomes(tid, sid, False),
                "menopause": _dim_label(tid, "menopause_status_reported"),
                "hormone_therapy": _dim_label(tid, "hormone_therapy_reported"),
                # A secondary publication is never itself an "RCT".
                "study_type": "Post hoc analysis" if is_posthoc else "Sex-specific analysis",
                "source_label": s.get("publisher") or "Publication",
                "source_url": s["url"],
                "record_kind": "analysis_publication",
            })
    return rows


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
