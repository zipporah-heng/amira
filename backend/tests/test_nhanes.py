"""Tests for the NHANES population-context loader (reads the committed cache;
no network, no heavy dependencies)."""

from amira import nhanes


def test_cache_is_available():
    assert nhanes.available(), "NHANES cache dataset/nhanes/nhanes_context_v1.json must be committed"


def test_small_cells_are_suppressed_not_fabricated():
    # Digoxin (cardiac glycoside) and dapagliflozin (SGLT2) have tiny NHANES samples
    # and MUST be suppressed with an honest message, never a number.
    for cls in ("Cardiac glycoside", "SGLT2 inhibitor"):
        ctx = nhanes.context_for_class(cls)
        row = ctx["result"]
        assert row["suppressed"] is True
        assert row["weighted_use_percent"] is None
        assert "insufficient" in row["suppression_reason"].lower()


def test_large_cells_report_weighted_estimate_with_design():
    ctx = nhanes.context_for_class("Statin")
    row = ctx["result"]
    assert row["suppressed"] is False
    assert row["weighted_use_percent"] is not None
    assert row["standard_error"] is not None
    # Design variables and weight must be recorded (survey-correct).
    assert ctx["weight_variable"].startswith("WTINT2YR")
    assert ctx["design_variables"]["strata"] == "SDMVSTRA"
    assert ctx["design_variables"]["psu"] == "SDMVPSU"


def test_unweighted_sample_size_is_reported():
    ctx = nhanes.context_for_class("Angiotensin receptor blocker")
    assert ctx["result"]["unweighted_users"] >= 0
    assert ctx["unweighted_denominator_women"] > 0


def test_usage_boundary_forbids_prescription_or_effectiveness_claims():
    ctx = nhanes.context_for_class("Statin")
    boundary = ctx["usage_boundary"].lower()
    assert "population context" in boundary
    assert "recommendation" in boundary


def test_cycle_and_source_provenance_present():
    ctx = nhanes.context_for_class("Statin")
    assert ctx["cycle"] == "2017-2018"
    assert any("cdc.gov" in f["data_url"] for f in ctx["files"])
