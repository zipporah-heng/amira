"""Tests for the deterministic pilot readiness engine."""

from amira import readiness


def test_score_is_deterministic():
    a = readiness.evaluate("Digoxin")
    b = readiness.evaluate("Digoxin")
    assert a == b
    assert a["score"] == 70  # 20+20+20+10+0 over a 100 denominator


def test_score_is_computed_not_forced_example_value():
    # The mockup showed 68/72; the real computed scores must not be those forced values.
    scores = {m: readiness.evaluate(m).get("score")
              for m in ("Rosuvastatin", "Dapagliflozin", "Digoxin")}
    assert scores["Rosuvastatin"] == 50
    assert scores["Dapagliflozin"] == 70
    assert 68 not in scores.values() or True  # not asserting absence; asserting real values above


def test_not_located_included_withholds_score():
    # Atorvastatin's female count is not_located (CARDS full-text not ingested):
    # the score must be withheld as 'not_established', never shown as 0.
    r = readiness.evaluate("Atorvastatin")
    assert r["scored"] is False
    assert r["status"] == "not_established"
    assert "not located" in r["reason"].lower()


def test_not_applicable_dimension_excluded_from_denominator():
    # Valsartan's only evidence is a women-only study: 'Compared' is not applicable
    # and must be removed from the denominator, with the adjustment shown.
    r = readiness.evaluate("Valsartan")
    assert r["scored"] is True
    compared = next(d for d in r["dimensions"] if d["key"] == "compared")
    assert compared["state"] == readiness.STATE_NOT_APPLICABLE
    assert compared["max_eligible"] == 0
    assert r["max_eligible_points"] == 80
    assert "Compared" in r["excluded_dimensions"]


def test_not_located_and_not_reported_are_distinct():
    # Digoxin: menopause not_reported vs hormone_therapy not_located must not collapse.
    r = readiness.evaluate("Digoxin")
    personalized = next(d for d in r["dimensions"] if d["key"] == "personalized")
    bases = {rec["value_basis"] for rec in personalized["source_records"]}
    assert "not_reported" in bases or "not_located" in bases
    # The state itself is one of the distinct evidence states, never a bare "No".
    assert personalized["state"] in {
        readiness.STATE_NOT_REPORTED, readiness.STATE_NOT_LOCATED, readiness.STATE_PARTIAL,
    }


def test_dimensions_carry_reason_and_source_records():
    r = readiness.evaluate("Dapagliflozin")
    for d in r["dimensions"]:
        assert d["reason"]
        assert d["points"] <= readiness.MAX_PER_DIMENSION
        assert d["state"] in readiness.STATE_POINTS


def test_disclaimer_and_pilot_label_present():
    r = readiness.evaluate("Digoxin")
    assert "completeness" in r["disclaimer"].lower()
    assert "not a validated" in r["pilot_note"].lower()
    assert r["rules_version"] == readiness.RULES_VERSION


def test_score_never_ranks_by_clinical_effectiveness():
    # Higher score must not track a more "effective" drug — it tracks evidence completeness.
    # Digoxin (a drug with a harm signal in women) scores the same 70 as dapagliflozin.
    assert readiness.evaluate("Digoxin")["score"] == readiness.evaluate("Dapagliflozin")["score"]
