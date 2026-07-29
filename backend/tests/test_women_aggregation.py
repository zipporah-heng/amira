"""Fail-closed female-enrolment aggregation.

A medicine-level numerator and denominator may only be combined when EVERY included
study contributes a compatible, verified pair. Digoxin was the reported defect:
DECISION's 284 women were divided by 7,801 participants, a denominator that includes
DIG, whose female enrolment was never located. These tests lock the rule for every
medicine in the canonical corpus.
"""
import json

import pytest

from amira import dataset, engine


def _all_medicines():
    """Every medicine the catalog exposes with a completed evidence review."""
    out = []
    for area in dataset.taxonomy()["health_areas"]:
        for cond in area["conditions"]:
            for cls in cond["drug_classes"]:
                for med in cls["medicines"]:
                    # Taxonomy medicines are plain names (registry only, no evidence).
                    name = med if isinstance(med, str) else med["medicine"]
                    out.append((cond["condition"], name))
    return out


def _supported(condition, medicine):
    r = engine.check_evidence(condition, medicine)
    return r if r.get("supported") and r.get("totals") else None


DIGOXIN = engine.check_evidence("Heart failure", "Digoxin")


class TestDigoxin:
    def test_no_combined_figure_or_percentage(self):
        w = DIGOXIN["totals"]["women_included"]
        assert w["state"] == "partially_reported"
        assert w["combined_count"] is None
        assert w["combined_total"] is None
        assert w["combined_percentage"] is None
        assert w["combined_basis"] == "not_combinable_incomplete_coverage"
        assert w["label"] == "Partially reported across reviewed studies"

    def test_study_specific_values_are_canonical(self):
        rows = {s["trial_id"]: s for s in DIGOXIN["totals"]["women_included"]["per_study"]}
        # DIG: total reported, female enrolment never located.
        assert rows["DIG"]["total_enrollment"] == 6800
        assert rows["DIG"]["female_n"] is None
        assert rows["DIG"]["female_basis"] == "not_located"
        assert rows["DIG"]["combinable"] is False
        # DECISION: both sides reported.
        assert rows["DECISION"]["total_enrollment"] == 1001
        assert rows["DECISION"]["female_n"] == 284
        assert rows["DECISION"]["female_basis"] == "reported"
        assert rows["DECISION"]["combinable"] is True

    def test_supporting_detail_names_both_studies(self):
        detail = DIGOXIN["totals"]["women_included"]["detail"]
        assert "DECISION reported 284 of 1,001 women" in detail
        assert "not located for DIG" in detail

    def test_the_incorrect_ratio_is_absent_from_the_whole_response(self):
        blob = json.dumps(DIGOXIN)
        assert "284 of 7,801" not in blob
        assert "284 of 7801" not in blob
        # The individual canonical fields remain available and unchanged …
        assert DIGOXIN["totals"]["women_reported_count"] == 284
        assert DIGOXIN["totals"]["participants_total"] == 7801
        # … but nothing pairs them into a ratio or a percentage.
        assert DIGOXIN["totals"]["women_pct_of_participants"] is None

    def test_maturity_and_mortality_statistics_are_untouched(self):
        # Women Counted stays reached (a verified source reports women), and the
        # mortality finding is unchanged by the aggregation fix.
        assert DIGOXIN["maturity"]["rule_trace"][0]["satisfied"] is True
        rates = [f.get("female_rate") or "" for f in DIGOXIN["effectiveness"]["findings"]]
        assert any("33.1%" in r and "28.9%" in r for r in rates)
        estimates = [f.get("female_estimate") or "" for f in DIGOXIN["effectiveness"]["findings"]]
        assert any("1.23" in e for e in estimates)

    def test_the_reported_decision_percentage_is_shown_as_recorded(self):
        # The DECISION source states "28% were women (n = 284)" of 1,001 participants.
        # AMIRA shows the recorded 28.0%, not a recomputed 28.4%.
        rows = {s["trial_id"]: s for s in DIGOXIN["totals"]["women_included"]["per_study"]}
        assert rows["DECISION"]["female_pct_reported"] == 28.0
        assert "28.0%" in DIGOXIN["totals"]["women_included"]["detail"]


class TestFailClosedRuleAcrossEveryMedicine:
    @pytest.mark.parametrize("condition,medicine", _all_medicines())
    def test_no_unknown_female_count_enters_a_combined_denominator(self, condition, medicine):
        r = _supported(condition, medicine)
        if r is None:
            pytest.skip(f"{medicine} has no completed evidence review")
        w = r["totals"]["women_included"]
        incomplete = [s for s in w["per_study"] if not s["combinable"]]
        if incomplete:
            assert w["combined_count"] is None, medicine
            assert w["combined_total"] is None, medicine
            assert w["combined_percentage"] is None, medicine
            assert w["state"] in ("partially_reported", "not_reported"), medicine
        else:
            # Combined only over studies that each supplied both sides.
            assert w["combined_count"] == sum(s["female_n"] for s in w["per_study"]), medicine
            assert w["combined_total"] == sum(s["total_enrollment"] for s in w["per_study"]), medicine
            assert w["combined_percentage"] == pytest.approx(
                round(w["combined_count"] / w["combined_total"] * 100, 1)), medicine

    @pytest.mark.parametrize("condition,medicine", _all_medicines())
    def test_a_derived_count_only_uses_its_own_study_total(self, condition, medicine):
        r = _supported(condition, medicine)
        if r is None:
            pytest.skip(f"{medicine} has no completed evidence review")
        for s in r["totals"]["women_included"]["per_study"]:
            if s["female_basis"] != "derived":
                continue
            assert s["female_pct_reported"] is not None, medicine
            assert s["total_enrollment"] is not None, medicine
            expected = int(round(s["female_pct_reported"] / 100.0 * s["total_enrollment"]))
            assert s["female_n"] == expected, medicine

    @pytest.mark.parametrize("condition,medicine", _all_medicines())
    def test_a_female_count_never_exceeds_its_own_total(self, condition, medicine):
        r = _supported(condition, medicine)
        if r is None:
            pytest.skip(f"{medicine} has no completed evidence review")
        for s in r["totals"]["women_included"]["per_study"]:
            if s["female_n"] is not None and s["total_enrollment"] is not None:
                assert s["female_n"] <= s["total_enrollment"], f"{medicine}/{s['trial_id']}"

    def test_a_partly_derived_combined_figure_is_labelled_approximate(self):
        r = engine.check_evidence("Cardiovascular disease prevention", "Rosuvastatin")
        w = r["totals"]["women_included"]
        assert w["state"] == "reported"
        assert w["combined_basis"] == "mixed_reported_and_derived"
        assert w["label"].startswith("approximately ")
        # The numerator behind the percentage is the one displayed beside it.
        assert w["combined_percentage"] == pytest.approx(
            round(w["combined_count"] / w["combined_total"] * 100, 1))

    def test_a_medicine_with_nothing_located_reports_no_ratio(self):
        r = engine.check_evidence("Cardiovascular disease prevention", "Atorvastatin")
        if not r.get("totals"):
            pytest.skip("Atorvastatin returns a bounded response")
        w = r["totals"]["women_included"]
        assert w["state"] == "not_reported"
        assert w["combined_count"] is None
        assert "not located" in w["detail"]


class TestSummaryHelperInIsolation:
    def test_one_missing_side_blocks_the_whole_combination(self):
        w = engine.women_included_summary(["DIG", "DECISION"])
        assert w["combined_total"] is None
        assert w["studies_reporting_women"] == 1
        assert w["studies_reviewed"] == 2

    def test_a_single_fully_reported_study_may_combine(self):
        w = engine.women_included_summary(["DECISION"])
        assert w["state"] == "reported"
        assert w["combined_count"] == 284
        assert w["combined_total"] == 1001
        assert w["combined_percentage"] == pytest.approx(28.4, abs=0.05)

    def test_an_empty_study_set_produces_no_figure(self):
        w = engine.women_included_summary([])
        assert w["state"] == "not_reported"
        assert w["combined_count"] is None
        assert w["per_study"] == []
