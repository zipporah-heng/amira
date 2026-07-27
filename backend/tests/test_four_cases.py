"""Four-cases ingestion: Zolpidem (FDA), Sotalol (PMID 8921798), Pioglitazone
(DailyMed/PROactive), Aspirin (PMID 15753114, Women's Health Study).

Every statistic asserted here is checked against the registered source passage, and
no medicine is treated as verified/featured unless the trust rules support it. Nothing
is human-verified; every new record is source-verified and human-review-pending.
"""

from amira import clinical, dataset, engine, signals


def _find(fid):
    return next(f for f in dataset.findings() if f["finding_id"] == fid)


def _resolves(source_id):
    ok, _ = dataset.source_is_valid(source_id)
    return ok


# --------------------------------------------------------------------------- #
# ZOLPIDEM (FDA)                                                              #
# --------------------------------------------------------------------------- #
def test_zolpidem_no_longer_incomplete_after_ingestion():
    r = engine.check_evidence("Insomnia", "Zolpidem")
    assert r["supported"] is True
    assert r["bounded_response"] is None
    assert clinical.medicine_ingestion_complete("Zolpidem") is True
    assert r["banner"]["evidence_review_complete"] is True


def test_zolpidem_fda_source_resolves():
    f = _find("F-SAF-ZOL-001")
    assert f["source_id"] == "SRC-FDA-ZOLPIDEM-2013"
    assert _resolves(f["source_id"])
    s = dataset.source_by_id(f["source_id"])
    assert s["url"].startswith("https://www.fda.gov/")


def test_zolpidem_product_specific_dosing_preserved():
    f = _find("F-SAF-ZOL-001")
    blob = f["signal_summary"] + " " + f["interpretation"] + " " + f["exact_passage"]
    for token in ("10 mg", "5 mg", "12.5 mg", "6.25 mg"):
        assert token in blob, token
    # Immediate-release and extended-release are distinguished (not one uniform dose).
    assert "immediate-release" in f["interpretation"].lower()
    assert "extended-release" in f["interpretation"].lower()


def test_zolpidem_generates_no_individual_prescribing_advice():
    f = _find("F-SAF-ZOL-001")
    text = (f["interpretation"] + " " + f["signal_headline"]).lower()
    for banned in ("you should", "take ", "prescribe", "start on", "switch to"):
        assert banned not in text
    assert "not individual prescribing advice" in f["interpretation"].lower()


# --------------------------------------------------------------------------- #
# SOTALOL (PMID 8921798)                                                     #
# --------------------------------------------------------------------------- #
def test_sotalol_preserves_women_and_men_rates():
    f = _find("F-SAF-SOT-001")
    assert "4.1%" in f["female_rate"] and "799" in f["female_rate"]
    assert "1.9%" in f["male_rate"] and "2336" in f["male_rate"]


def test_sotalol_threefold_odds_is_source_grounded():
    f = _find("F-SAF-SOT-001")
    assert "threefold greater odds" in f["exact_passage"].lower()
    assert "approximately threefold" in f["interpretation"].lower()


def test_sotalol_exact_passage_resolves():
    f = _find("F-SAF-SOT-001")
    assert f["source_id"] == "SRC-PMID-8921798"
    assert _resolves(f["source_id"])
    assert f["exact_passage"].strip()


def test_sotalol_serious_safety_classification_is_bounded():
    # A genuine between-sex difference (P<0.001) -> significant safety difference.
    saf = clinical.safety_state("Sotalol")
    assert saf["state"] == clinical.SAF_SIGNIFICANT
    lib = {s["medicine"]: s for s in signals.library()}
    assert lib["Sotalol"]["signal_type"] == "Serious Safety"
    assert lib["Sotalol"]["featured"] is False  # not auto-featured
    joined = " ".join(lib["Sotalol"]["cautions"]).lower()
    assert "not an individual treatment recommendation" in joined


# --------------------------------------------------------------------------- #
# PIOGLITAZONE (DailyMed / PROactive)                                        #
# --------------------------------------------------------------------------- #
def test_pioglitazone_preserves_female_fracture_rates():
    f = _find("F-SAF-PIO-001")
    assert "5.1%" in f["female_rate"] and "44/870" in f["female_rate"]
    assert "2.5%" in f["female_rate"] and "23/905" in f["female_rate"]


def test_pioglitazone_male_findings_separately_represented():
    f = _find("F-SAF-PIO-001")
    assert f["male_rate"] and "1.7%" in f["male_rate"] and "2.1%" in f["male_rate"]


def test_pioglitazone_no_menopause_inferred():
    v, _, _ = dataset.assertion_value("PROACTIVE", "menopause_status_reported")
    assert v == "not_reported"
    m = engine.check_evidence("Type 2 diabetes", "Pioglitazone")["maturity"]
    # Cumulative: never reaches Life Stage Aware without an explicit menopause report.
    assert m["level"] < 3


def test_pioglitazone_dailymed_source_resolves():
    f = _find("F-SAF-PIO-001")
    assert f["source_id"] == "SRC-DAILYMED-PIOGLITAZONE"
    assert _resolves(f["source_id"])
    assert dataset.source_by_id(f["source_id"])["url"].startswith("https://dailymed.nlm.nih.gov/")


# --------------------------------------------------------------------------- #
# ASPIRIN (PMID 15753114, Women's Health Study)                              #
# --------------------------------------------------------------------------- #
def test_aspirin_preserves_all_outcome_results():
    r = engine.check_evidence("Cardiovascular disease prevention", "Aspirin")
    blob = str(r)
    for token in ("0.83", "1.02", "0.95", "1.40", "0.76"):  # stroke, MI, CV death, bleeding, ischemic stroke
        assert token in blob, token


def test_aspirin_is_a_women_only_trial():
    whs = next(t for t in dataset.trials() if t["trial_id"] == "WHS")
    assert whs["sex_eligibility"] == "FEMALE"
    eff = clinical.effectiveness_state("Aspirin")
    assert eff["state"] == clinical.EFF_WOMEN_ONLY


def test_aspirin_no_formal_women_vs_men_conclusion():
    eff = clinical.effectiveness_state("Aspirin")
    # No between-sex significance conclusion is generated for a women-only trial.
    assert eff["state"] not in (clinical.EFF_SIGNIFICANT, clinical.EFF_NO_DIFF)
    for f in dataset.findings_for("Aspirin", "efficacy"):
        assert f["significance"] == "not_tested"
        assert "women-only" in f["interpretation"].lower() or "only women" in f["interpretation"].lower()


def test_aspirin_not_featured_and_not_in_library():
    meds_featured = {s["medicine"] for s in signals.featured()}
    meds_lib = {s["medicine"] for s in signals.library()}
    assert "Aspirin" not in meds_featured
    assert "Aspirin" not in meds_lib


# --------------------------------------------------------------------------- #
# GENERAL                                                                    #
# --------------------------------------------------------------------------- #
FOUR = ["Zolpidem", "Sotalol", "Pioglitazone", "Aspirin"]
NEW_FINDING_IDS = ["F-SAF-ZOL-001", "F-SAF-SOT-001", "F-SAF-PIO-001",
                   "F-EFF-WHS-001", "F-EFF-WHS-002", "F-SAF-WHS-001"]


def test_all_four_source_verified_human_review_pending():
    for fid in NEW_FINDING_IDS:
        f = _find(fid)
        assert f["source_verified"] is True
        assert f["human_verified"] is False
        assert f.get("verifier") in (None, "")
    # Signals for the three critical ones carry Human Review Pending status.
    for s in signals.library():
        if s["medicine"] in ("Zolpidem", "Sotalol", "Pioglitazone"):
            assert s["evidence_status"] == "Human Review Pending"


def test_every_new_finding_has_an_exact_passage_from_its_source():
    for fid in NEW_FINDING_IDS:
        f = _find(fid)
        assert f["exact_passage"].strip()
        assert _resolves(f["source_id"])


def test_frozen_outputs_unchanged():
    r = engine.check_evidence("Cardiovascular disease prevention", "Rosuvastatin")
    d = engine.check_evidence("Heart failure", "Dapagliflozin")
    assert r["banner"]["maturity"]["display"] == "2 / 5"
    assert r["totals"]["participants_total"] == 30507
    assert r["totals"]["women_reported_count"] == 6801
    assert r["totals"]["women_pct_of_participants"] == 41.4
    assert d["totals"]["participants_total"] == 4744
    assert d["totals"]["women_pct_of_participants"] == 23.4


def test_no_fabricated_findings_all_public_findings_are_source_verified():
    for f in dataset.findings():
        assert f["source_verified"] is True
        assert (f.get("exact_passage") or "").strip()


def test_all_four_medicines_verified_in_catalog_status():
    for med in FOUR:
        assert clinical.medicine_ingestion_complete(med) is True
