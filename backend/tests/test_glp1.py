"""GLP-1 women's-evidence ingestion: Ozempic (SUSTAIN-6), Wegovy (STEP 1), and
Mounjaro (SURPASS-2 + FDA snapshot) are ingested as DISTINCT brand medicines. Ozempic
and Wegovy share the active ingredient semaglutide but keep separate brand, dose,
indication, trial and evidence records. Counted is not the same as analyzed.
"""

import json

from amira import clinical, dataset, engine, signals


def _find(fid):
    return next(f for f in dataset.findings() if f["finding_id"] == fid)


def _resolves(source_id):
    return dataset.source_is_valid(source_id)[0]


def _trial(med):
    ts = [t for t in dataset.trials() if t["medicine"] == med]
    return ts[0] if ts else None


# --------------------------------------------------------------------------- #
# Distinct medicines
# --------------------------------------------------------------------------- #
def test_ozempic_wegovy_mounjaro_are_distinct_medicines():
    meds = {t["medicine"] for t in dataset.trials()}
    assert {"Ozempic", "Wegovy", "Mounjaro"} <= meds
    for cond, med in [("Type 2 diabetes", "Ozempic"), ("Weight management", "Wegovy"),
                      ("Type 2 diabetes", "Mounjaro")]:
        r = engine.check_evidence(cond, med)
        assert r["supported"] is True
        assert clinical.medicine_ingestion_complete(med) is True


def test_ozempic_and_wegovy_share_semaglutide_but_separate_records():
    oze, weg = _trial("Ozempic"), _trial("Wegovy")
    assert oze["active_ingredient"] == "Semaglutide"
    assert weg["active_ingredient"] == "Semaglutide"
    # Separate brand, trial, indication and condition records.
    assert oze["trial_id"] != weg["trial_id"]
    assert oze["condition"] == "Type 2 diabetes"
    assert weg["condition"] == "Weight management"
    assert oze["nct_id"] != weg["nct_id"]


def test_mounjaro_uses_tirzepatide_and_reviews_the_diabetes_evidence():
    mou = _trial("Mounjaro")
    assert mou["active_ingredient"] == "Tirzepatide"
    assert mou["condition"] == "Type 2 diabetes"
    # The card explains the Zepbound distinction without treating Mounjaro as the
    # weight-management brand.
    assert "Zepbound" in (mou.get("brand_note") or "")
    b = engine.check_evidence("Type 2 diabetes", "Mounjaro")["banner"]
    assert "Zepbound" in (b.get("brand_note") or "")


# --------------------------------------------------------------------------- #
# Women participants
# --------------------------------------------------------------------------- #
def test_ozempic_women_1295_of_3297():
    t = engine.check_evidence("Type 2 diabetes", "Ozempic")["totals"]
    assert t["participants_total"] == 3297
    assert t["women_reported_count"] == 1295
    assert t["women_pct_of_participants"] == 39.3


def test_wegovy_women_1453_of_1961():
    t = engine.check_evidence("Weight management", "Wegovy")["totals"]
    assert t["participants_total"] == 1961
    assert t["women_reported_count"] == 1453
    assert t["women_pct_of_participants"] == 74.1


def test_mounjaro_women_53_percent_in_surpass2():
    t = engine.check_evidence("Type 2 diabetes", "Mounjaro")["totals"]
    assert t["participants_total"] == 1879
    assert t["women_pct_of_participants"] == 53.0


# --------------------------------------------------------------------------- #
# Sex-specific classifications
# --------------------------------------------------------------------------- #
def test_ozempic_interaction_p_0_45_resolves_to_its_source():
    f = _find("F-EFF-OZE-001")
    assert f["comparison_p"] == "0.45"
    assert "0.45" in f["exact_passage"]
    assert _resolves(f["source_id"])
    # A formal drug-specific comparison exists -> "no statistically significant sex difference".
    assert clinical.effectiveness_state("Ozempic")["state"] == clinical.EFF_NO_DIFF


def test_wegovy_does_not_infer_sex_analysis_from_representation():
    # Women were the majority (74.1%) but NO sex-specific analysis was located.
    assert not dataset.affirmative_verified("STEP-1", "sex_specific_efficacy_reported")
    assert not dataset.affirmative_verified("STEP-1", "sex_specific_safety_reported")
    r = engine.check_evidence("Weight management", "Wegovy")
    assert r["effectiveness"]["state"] == clinical.EFF_NOT_REPORTED
    assert r["safety"]["state"] == clinical.SAF_NOT_REPORTED
    # Women Counted (level 1) but NOT Women Analyzed (not level 2).
    assert r["banner"]["maturity"]["level"] == 1
    assert not any(f["medicine"] == "Wegovy" for f in dataset.findings())


def test_mounjaro_dose_specific_values_remain_separate():
    f = _find("F-EFF-MOU-001")
    for dose in ("-2.01", "-2.24", "-2.30", "-1.86"):
        assert dose in f["exact_passage"], dose
    # No formal between-sex comparison -> reported-but-unclear, not a "no difference" claim.
    st = clinical.effectiveness_state("Mounjaro")["state"]
    assert st == clinical.EFF_REPORTED_UNCLEAR
    assert st != clinical.EFF_NO_DIFF


def test_mounjaro_safety_by_sex_is_bounded():
    f = _find("F-SAF-MOU-001")
    assert "46.8%" in f["female_rate"] and "154/329" in f["female_rate"]
    assert "34.4%" in f["male_rate"] and "134/389" in f["male_rate"]
    saf = clinical.safety_state("Mounjaro")
    assert saf["state"] == clinical.SAF_SEX_SIGNAL
    # Bounded: explicitly declines to assert a statistically greater risk without a
    # formal between-sex comparison.
    interp = f["interpretation"].lower()
    assert "does not state that women had a statistically greater risk" in interp
    assert "between-sex" in interp and "not located" in interp


# --------------------------------------------------------------------------- #
# Guardrails
# --------------------------------------------------------------------------- #
def test_no_glp1_brand_becomes_a_critical_signal():
    lib = {s["medicine"] for s in signals.library()}
    for med in ("Ozempic", "Wegovy", "Mounjaro"):
        assert med not in lib


def test_no_ranking_or_superiority_language_for_the_brands():
    blob = ""
    for cond, med in [("Type 2 diabetes", "Ozempic"), ("Weight management", "Wegovy"),
                      ("Type 2 diabetes", "Mounjaro")]:
        r = engine.check_evidence(cond, med)
        blob += json.dumps({"eff": r["effectiveness"]["state"], "safe": r["safety"]["state"],
                            "eff_h": r["effectiveness"]["headline"], "safe_h": r["safety"]["headline"]}).lower()
    for banned in ("better than", "more effective", "safer than", "superior", "outperform"):
        assert banned not in blob


def test_maturity_is_derived_not_stored():
    blob = json.dumps(dataset.load())
    assert '"maturity_level"' not in blob and '"evidence_level"' not in blob


def test_no_celebrity_record_in_the_corpus():
    blob = json.dumps(dataset.load()).lower()
    assert "schumer" not in blob
    assert "amy schumer" not in blob


def test_exact_passages_resolve_for_the_new_findings():
    for fid in ("F-EFF-OZE-001", "F-SAF-OZE-001", "F-EFF-MOU-001", "F-SAF-MOU-001"):
        f = _find(fid)
        assert (f.get("exact_passage") or "").strip()
        assert _resolves(f["source_id"])


def test_frozen_outputs_unchanged():
    r = engine.check_evidence("Cardiovascular disease prevention", "Rosuvastatin")
    d = engine.check_evidence("Heart failure", "Dapagliflozin")
    dg = engine.check_evidence("Heart failure", "Digoxin")
    v = engine.check_evidence("Hypertension", "Valsartan")
    assert r["banner"]["maturity"]["display"] == "2 / 5"
    assert r["totals"]["participants_total"] == 30507
    assert r["totals"]["women_pct_of_participants"] == 41.4
    assert d["totals"]["participants_total"] == 4744
    assert dg["banner"]["maturity"]["display"] == "2 / 5"
    assert v["banner"]["maturity"]["display"] == "4 / 5"
