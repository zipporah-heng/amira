"""Multi-health-area taxonomy + cascading catalog: new medicines are DISCOVERED
(evidence review incomplete), never verified/scored, and cardiovascular stays frozen."""

from fastapi.testclient import TestClient

import main
from amira import engine, clinical, dataset

client = TestClient(main.app)

EXPECTED_HEALTH_AREAS = {
    "Cardiovascular", "Metabolic Health", "Bone Health",
    "Hormone-related Cancer", "Neurology", "Neurodevelopmental Health",
}
# Medicines newly registered by the taxonomy that have NO ingested trials yet.
NEW_MEDICINES = [
    "Apixaban", "Semaglutide", "Liraglutide", "Tirzepatide", "Alendronate",
    "Denosumab", "Tamoxifen", "Anastrozole", "Carbidopa/Levodopa", "Lecanemab",
    "Donanemab", "Methylphenidate", "Lisdexamfetamine", "Atomoxetine",
    "Risperidone", "Aripiprazole",
]


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
    # Exactly the four trial-backed CV medicines are verified.
    assert verified == {"Rosuvastatin", "Dapagliflozin", "Digoxin", "Valsartan"}
    # Atorvastatin (not_located enrolment) and every newly registered medicine are incomplete.
    assert "Atorvastatin" in incomplete
    for m in NEW_MEDICINES:
        assert m in incomplete, f"{m} should be incomplete"


def test_new_medicines_have_no_trials_and_are_not_verified():
    for m in NEW_MEDICINES:
        assert not clinical.medicine_ingestion_complete(m)
        assert not any(t["medicine"] == m for t in dataset.trials())


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


def test_new_medicines_never_enter_verified_medicines():
    # A new drug class (e.g. GLP-1) has no verified medicines.
    cc = clinical.class_comparison("GLP-1 receptor agonist")
    assert cc["verified_medicines"] == []


def test_trials_carry_health_area_for_research_map():
    trials = client.get("/api/trials").json()["trials"]
    assert {t["health_area"] for t in trials} == {"Cardiovascular"}


def test_frozen_cardiovascular_outputs_unchanged():
    r = engine.check_evidence("Cardiovascular disease prevention", "Rosuvastatin")
    d = engine.check_evidence("Heart failure", "Dapagliflozin")
    assert r["banner"]["maturity"]["display"] == "2 / 5"
    assert r["totals"]["participants_total"] == 30507
    assert r["totals"]["women_reported_count"] == 6801
    assert r["totals"]["women_pct_of_participants"] == 41.4
    assert d["totals"]["participants_total"] == 4744
    assert d["totals"]["women_pct_of_participants"] == 23.4
