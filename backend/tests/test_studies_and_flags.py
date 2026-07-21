"""Studies-behind table correctness + feature-flag defaults."""

import os

from amira import engine, dataset, flags


def _studies(medicine):
    matched = [t for t in dataset.trials() if t["medicine"] == medicine]
    return engine.studies_behind(medicine, matched)


def test_digoxin_shows_three_correct_source_records():
    rows = _studies("Digoxin")
    studies = [r["study"] for r in rows]
    assert studies == ["DIG trial", "Sex-based DIG analysis", "DECISION"]
    kinds = [r["record_kind"] for r in rows]
    assert kinds == ["trial_registry_record", "analysis_publication", "primary_publication"]


def test_2002_analysis_is_labelled_analysis_not_a_trial():
    rows = _studies("Digoxin")
    analysis = next(r for r in rows if r["study"] == "Sex-based DIG analysis")
    assert analysis["study_type"] == "Post hoc analysis"
    assert "RCT" not in analysis["study_type"]
    assert analysis["year"] == 2002


def test_dapagliflozin_not_in_digoxin_studies_table():
    rows = _studies("Digoxin")
    blob = " ".join(r["study"] for r in rows)
    assert "DAPA" not in blob and "apaglifloz" not in blob.lower()


def test_studies_women_are_source_local():
    rows = _studies("Digoxin")
    # Both DIG rows: women not located in the reviewed DIG abstract.
    for r in rows:
        if r["trial_id"] == "DIG":
            assert r["women"] == "Not located"
    # DECISION reports its own 284 (28%).
    decision = next(r for r in rows if r["trial_id"] == "DECISION")
    assert "284" in decision["women"]


def test_each_studies_row_links_to_correct_source():
    for med in ("Digoxin", "Dapagliflozin", "Rosuvastatin"):
        for r in _studies(med):
            assert r["source_url"].startswith("https://")


def test_pilot_score_is_off_by_default(monkeypatch):
    monkeypatch.delenv("AMIRA_ENABLE_PILOT_SCORE", raising=False)
    assert flags.enable_pilot_score() is False
    r = engine.check_evidence(condition="Heart failure", medicine="Digoxin")
    assert r["readiness"] is None


def test_pilot_score_can_be_enabled(monkeypatch):
    monkeypatch.setenv("AMIRA_ENABLE_PILOT_SCORE", "1")
    assert flags.enable_pilot_score() is True
    r = engine.check_evidence(condition="Heart failure", medicine="Digoxin")
    assert r["readiness"] and r["readiness"]["scored"] is True


def test_maturity_is_always_present_regardless_of_pilot_flag(monkeypatch):
    monkeypatch.delenv("AMIRA_ENABLE_PILOT_SCORE", raising=False)
    r = engine.check_evidence(condition="Heart failure", medicine="Digoxin")
    assert r["maturity"]["level"] == 2
    assert r["maturity"]["label"] == "Women Analyzed"


# --- Dapagliflozin evidence-path: decimal truncation regression -------------- #
def test_first_sentence_does_not_truncate_decimals():
    txt = ("A prespecified analysis reported HR 0.79 (95% CI 0.59-1.06) in women. "
           "This is a second sentence.")
    out = engine._first_sentence(txt)
    assert "0.79" in out and "1.06" in out
    assert not out.endswith("HR 0.")
    assert "second sentence" not in out  # only the first sentence


def test_dapagliflozin_path_headline_is_complete_not_truncated():
    r = engine.check_evidence(condition="Heart failure", medicine="Digoxin")
    dapa = next(p for p in r["other_evidence_paths"] if p["medicine"] == "Dapagliflozin")
    assert "0.79" in dapa["headline"] and "0.59-1.06" in dapa["headline"]
    assert "HR 0." not in dapa["headline"].replace("HR 0.79", "").replace("HR 0.73", "")
    # CI crosses 1.0 -> inconclusive, with neutral explanatory note (not a danger claim).
    assert dapa["ci_crosses_one"] is True
    assert "inconclusive" in dapa["interpretation_note"].lower()
    assert "crosses 1.0" in dapa["interpretation_note"]


def test_ci_crossing_helpers():
    assert engine._ci_crosses_one("95% CI 0.59-1.06") is True
    assert engine._ci_crosses_one("95% CI 0.37 to 0.80") is False   # entirely below 1.0
    assert engine._ci_crosses_one(None) is False
