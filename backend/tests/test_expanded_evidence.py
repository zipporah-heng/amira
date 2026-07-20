"""Integrity checks for the postmenopause and historic-versus-modern cases."""

import json

from fastapi.testclient import TestClient

from amira import clinical, dataset, maturity
from main import app


client = TestClient(app)


def _check(medicine: str, condition: str, life_stage="not_specified", hrt="any"):
    response = client.post(
        "/api/check-evidence",
        json={
            "condition": condition,
            "medicine": medicine,
            "life_stage": life_stage,
            "hormone_therapy": hrt,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_valsartan_is_explicit_postmenopause_evidence_not_an_age_inference():
    report = _check(
        "Valsartan", "Hypertension", life_stage="menopause_postmenopause"
    )
    assertion = next(
        a for a in dataset.assertions()
        if a["trial_id"] == "HAYOZ-2012"
        and a["dimension"] == "menopause_status_reported"
    )
    assert assertion["value"] == "yes"
    assert "125 postmenopausal hypertensive women" in assertion["exact_passage"]
    assert report["life_stage_context"]["supported"] is True
    assert report["life_stage_context"]["inference_policy"] == (
        "Age is never used to infer menopausal status."
    )


def test_valsartan_maturity_stops_at_four_without_joint_stratification():
    result = maturity.evaluate(["HAYOZ-2012"])
    assert result["level"] == 4
    trace = {row["level"]: row for row in result["rule_trace"]}
    assert trace[3]["satisfied"] is True
    assert trace[4]["satisfied"] is True
    assert trace[5]["satisfied"] is False
    assert "joint stratification" in _check("Valsartan", "Hypertension")["banner"][
        "why_this_result"
    ].lower()


def test_valsartan_direct_comparison_is_exact_and_bounded():
    report = _check("Valsartan", "Hypertension")
    assert len(report["direct_comparisons"]) == 1
    comparison = report["direct_comparisons"][0]
    assert comparison["population"] == "Postmenopausal women with hypertension"
    outcomes = {row["endpoint"]: row for row in comparison["outcomes"]}
    target = outcomes["Reached target office blood pressure"]
    edema = outcomes["Peripheral edema"]
    assert (target["medicine_value"], target["comparator_value"]) == ("71.7%", "71.4%")
    assert (edema["medicine_value"], edema["comparator_value"]) == ("14.3%", "77.4%")
    assert edema["comparison_p"] == "P < 0.001"
    assert "not a prescribing recommendation" in json.dumps(comparison).lower()
    assert "better for every patient" in json.dumps(comparison).lower()


def test_life_stage_and_hormone_therapy_filters_match_the_studied_population():
    wrong_stage = _check(
        "Valsartan", "Hypertension", life_stage="childhood_prepubertal"
    )
    assert wrong_stage["life_stage_context"]["supported"] is False
    assert wrong_stage["life_stage_context"]["status"] == "life_stage_not_represented"

    hrt_users = _check("Valsartan", "Hypertension", hrt="yes")
    assert hrt_users["hormone_therapy_context"]["supported"] is False
    assert "exclusion criterion" in hrt_users["hormone_therapy_context"]["message"]

    non_users = _check("Valsartan", "Hypertension", hrt="no")
    assert non_users["hormone_therapy_context"]["supported"] is True


def test_women_only_study_is_not_mislabeled_as_a_between_sex_analysis():
    report = _check("Valsartan", "Hypertension")
    assert report["effectiveness"]["state"] == clinical.EFF_WOMEN_ONLY
    assert report["safety"]["state"] == clinical.SAF_WOMEN_ONLY
    why = report["banner"]["why_this_result"].lower()
    assert "women-only" in why
    assert "effectiveness was analysed by sex" not in why


def test_digoxin_surfaces_historic_and_modern_tension_without_causal_language():
    report = _check("Digoxin", "Heart failure")
    assert report["maturity"]["level"] == 2
    assert report["effectiveness"]["state"] == clinical.EFF_CONFLICTING
    findings = {f["finding_id"]: f for f in report["effectiveness"]["findings"]}
    historic = findings["F-EFF-DIG-001"]
    modern = findings["F-EFF-DEC-001"]
    assert historic["comparison_p"] == "0.014"
    assert historic["female_rate"] == "33.1% digoxin vs 28.9% placebo"
    assert "post hoc" in historic["interpretation"].lower()
    assert "does not establish" in historic["interpretation"].lower()
    assert modern["comparison_p"] == "0.61"
    assert modern["significance"] == "no_significant_difference"
    blob = json.dumps(report).lower()
    assert "caused by digoxin" not in blob
    assert "30% fatality" not in blob


def test_digoxin_does_not_claim_postmenopause_or_complete_women_counts():
    report = _check(
        "Digoxin", "Heart failure", life_stage="menopause_postmenopause"
    )
    assert report["life_stage_context"]["supported"] is False
    assert report["hormone_therapy_context"]["trials_reporting_hormone_therapy"] == []
    totals = report["totals"]
    assert totals["women_reported_count"] == 284
    assert totals["trials_without_female_count_or_percentage"] == ["DIG"]
    assert totals["women_pct_of_participants"] is None
    assert totals["women_estimated_basis"] == "incomplete"


def test_decision_registry_publication_count_discrepancy_is_documented():
    assertion = next(
        a for a in dataset.assertions() if a["assertion_id"] == "A-DEC-001"
    )
    assert assertion["value"] == 1001
    assert "registry currently lists 982" in assertion["notes"].lower()
    assert assertion["source_id"] == "SRC-PMID-42108270"


def test_direct_comparison_and_class_views_never_rank_clinical_performance():
    report = _check("Valsartan", "Hypertension")
    text = json.dumps(
        {
            "class": report["class_comparison"],
            "direct": report["direct_comparisons"],
        }
    ).lower()
    for banned in ("best medicine", "more effective medicine", "prescribe valsartan"):
        assert banned not in text
