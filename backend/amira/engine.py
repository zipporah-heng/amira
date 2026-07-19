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

from . import dataset, maturity

LIFE_STAGES = {"premenopause", "perimenopause", "postmenopause", "not_specified"}
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

    return {
        **envelope,
        "supported": True,
        "bounded_response": None,
        "maturity": maturity.evaluate(trial_ids),
        "totals": aggregate_participants(trial_ids),
        "dimensions": dimension_summary(trial_ids),
        "trials": trial_rows,
        "life_stage_context": life_stage_context(life_stage, trial_ids),
        "hormone_therapy_context": hormone_therapy_context(hormone_therapy, trial_ids),
        "sources": dataset.sources(),
        "evaluation_status": "EVALUATION PENDING",
    }
