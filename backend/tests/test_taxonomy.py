"""Multi-health-area taxonomy + cascading catalog: new medicines are DISCOVERED
(evidence review incomplete), never verified/scored, and cardiovascular stays frozen."""

from fastapi.testclient import TestClient

import main
from amira import engine, clinical, dataset

client = TestClient(main.app)

EXPECTED_HEALTH_AREAS = {
    "Cardiovascular", "Metabolic Health", "Bone Health",
    "Hormone-related Cancer", "Neurology", "Neurodevelopmental Health", "Sleep Health",
}
# Medicines registered by the taxonomy that have NO ingested trials yet (still
# DISCOVERED / evidence-review-incomplete). Zolpidem, Sotalol, Pioglitazone and
# Aspirin were ingested in the four-cases mission and are now VERIFIED, so they are
# no longer in this list.
NEW_MEDICINES = [
    "Apixaban", "Semaglutide", "Liraglutide", "Tirzepatide", "Alendronate",
    "Denosumab", "Tamoxifen", "Anastrozole", "Carbidopa/Levodopa", "Lecanemab",
    "Donanemab", "Methylphenidate", "Lisdexamfetamine", "Atomoxetine",
    "Risperidone", "Aripiprazole",
]

# Ingested in the four-cases mission (now verified / evidence review complete).
INGESTED_FOUR_CASES = ["Zolpidem", "Sotalol", "Pioglitazone", "Aspirin"]


def _all_meds(cat):
    return {(ha["health_area"], c["condition"], cl["drug_class"], m["medicine"], m["status"])
            for ha in cat["health_areas"] for c in ha["conditions"]
            for cl in c["drug_classes"] for m in cl["medicines"]}


def test_catalog_exposes_six_health_areas():
    cat = client.get("/api/catalog").json()
    assert {h["health_area"] for h in cat["health_areas"]} == EXPECTED_HEALTH_AREAS


def test_cardiovascular_verified_status_unchanged():
    cat = client.get("/api/catalog").json()
    rows = _all_meds(cat)
    verified = {m for (_, _, _, m, s) in rows if s == "verified"}
    incomplete = {m for (_, _, _, m, s) in rows if s == "incomplete"}
    # The four frozen CV/HF medicines PLUS the four ingested four-cases medicines are
    # verified. Frozen CV science (Rosuvastatin/Dapagliflozin/Digoxin/Valsartan) is
    # unchanged; the new verified medicines are the four this mission ingested.
    assert verified == {"Rosuvastatin", "Dapagliflozin", "Digoxin", "Valsartan",
                        "Aspirin", "Sotalol", "Pioglitazone", "Zolpidem",
                        "Ozempic", "Wegovy", "Mounjaro"}
    # Atorvastatin (not_located enrolment) and every still-un-ingested medicine remain
    # incomplete — including the ACTIVE-INGREDIENT entries (Semaglutide/Tirzepatide),
    # which stay DISCOVERED even though their brand records (Ozempic/Wegovy/Mounjaro) are verified.
    assert "Atorvastatin" in incomplete
    assert {"Semaglutide", "Tirzepatide", "Liraglutide"} <= incomplete
    for m in NEW_MEDICINES:
        assert m in incomplete, f"{m} should be incomplete"


def test_new_medicines_have_no_trials_and_are_not_verified():
    for m in NEW_MEDICINES:
        assert not clinical.medicine_ingestion_complete(m)
        assert not any(t["medicine"] == m for t in dataset.trials())


def test_four_cases_medicines_ingested_verified_in_expected_paths():
    """The four-cases mission ingested Zolpidem/Sotalol/Pioglitazone/Aspirin: each now
    sits at its taxonomy path AND is verified (evidence review complete)."""
    cat = client.get("/api/catalog").json()
    rows = _all_meds(cat)
    def path(med):
        return next(((ha, c, cl) for (ha, c, cl, m, _) in rows if m == med), None)
    def status(med):
        return next((s for (_, _, _, m, s) in rows if m == med), None)
    assert path("Zolpidem") == ("Sleep Health", "Insomnia", "Sedative-hypnotic")
    assert path("Sotalol") == ("Cardiovascular", "Heart rhythm disorders", "Antiarrhythmic")
    assert path("Pioglitazone") == ("Metabolic Health", "Type 2 diabetes", "Thiazolidinedione")
    assert path("Aspirin") == ("Cardiovascular", "Cardiovascular disease prevention", "Antiplatelet")
    for med in INGESTED_FOUR_CASES:
        assert status(med) == "verified"
        assert clinical.medicine_ingestion_complete(med)


def test_autism_condition_uses_evidence_accurate_label():
    cat = client.get("/api/catalog").json()
    conds = {c["condition"] for ha in cat["health_areas"] for c in ha["conditions"]}
    assert "Irritability associated with autism" in conds
    # Never labelled as an autism treatment/cure.
    assert not any("autism" == c.lower() or "treat" in c.lower() for c in conds)


def test_check_evidence_for_registered_but_uningested_medicine_is_incomplete():
    r = engine.check_evidence("Type 2 diabetes", "Semaglutide")
    assert r["supported"] is False
    assert r["bounded_response"]["status"] == "evidence_review_incomplete"
    assert r["maturity"] is None and r["totals"] is None
    # No fabricated score anywhere.
    assert "0 / 5" not in str(r)


def test_uningested_ingredient_entries_never_enter_verified_medicines():
    # The GLP-1 class now has verified BRAND records (Ozempic, Wegovy) but the
    # un-ingested ACTIVE-INGREDIENT entries (Semaglutide, Liraglutide) must never be
    # counted as verified.
    cc = clinical.class_comparison("GLP-1 receptor agonist")
    assert set(cc["verified_medicines"]) == {"Ozempic", "Wegovy"}
    assert "Semaglutide" not in cc["verified_medicines"]
    assert "Liraglutide" not in cc["verified_medicines"]
    # A class with only un-ingested medicines still has none verified.
    assert clinical.class_comparison("Bisphosphonate")["verified_medicines"] == []


def test_trials_carry_health_area_for_research_map():
    trials = client.get("/api/trials").json()["trials"]
    # Cardiovascular (statins, HF, hypertension, sotalol, aspirin) plus the two new
    # health areas populated by the four-cases ingestion.
    assert {t["health_area"] for t in trials} == {
        "Cardiovascular", "Metabolic Health", "Sleep Health"}


def test_frozen_cardiovascular_outputs_unchanged():
    r = engine.check_evidence("Cardiovascular disease prevention", "Rosuvastatin")
    d = engine.check_evidence("Heart failure", "Dapagliflozin")
    assert r["banner"]["maturity"]["display"] == "2 / 5"
    assert r["totals"]["participants_total"] == 30507
    assert r["totals"]["women_reported_count"] == 6801
    assert r["totals"]["women_pct_of_participants"] == 41.4
    assert d["totals"]["participants_total"] == 4744
    assert d["totals"]["women_pct_of_participants"] == 23.4
