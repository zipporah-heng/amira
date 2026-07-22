"""Product-freeze consistency tests (sponsor feedback closeout, section 9)."""

import pytest
from fastapi.testclient import TestClient

from amira import clinical, dataset, engine, maturity
from main import app

client = TestClient(app)


def _check(**kw):
    body = {"condition": "Cardiovascular disease prevention", "medicine": "Rosuvastatin",
            "life_stage": "not_specified", "hormone_therapy": "any"}
    body.update(kw)
    r = client.post("/api/check-evidence", json=body)
    assert r.status_code == 200
    return r.json()


# 1. Class-level evidence cannot produce a drug-specific significance conclusion.
def test_class_level_evidence_does_not_drive_drug_specific_state():
    eff = clinical.effectiveness_state("Rosuvastatin")
    # A class-level finding with p=0.33 exists...
    assert any(f["scope"].startswith("class:") and f["comparison_p"] is not None
               for f in eff["class_level_findings"])
    # ...but the drug-specific state is NOT "no significant difference".
    assert eff["state"] != clinical.EFF_NO_DIFF
    assert eff["state"] == clinical.EFF_REPORTED_UNCLEAR


# 2. A missing interaction test cannot yield "no statistically significant difference".
def test_missing_interaction_test_does_not_yield_no_difference():
    drug_findings = [f for f in dataset.findings_for("Rosuvastatin", "efficacy")
                     if f["scope"].startswith("trial:")]
    assert drug_findings
    assert all(f["comparison_p"] is None for f in drug_findings)  # no drug-specific p
    assert clinical.effectiveness_state("Rosuvastatin")["state"] != clinical.EFF_NO_DIFF


# 3. "not_located" cannot render as "no women's evidence".
def test_not_located_never_renders_as_no_womens_evidence():
    m = maturity.evaluate(["CARDS"])
    assert m["scorable"] is False
    assert m["label"] == "Not yet established"
    assert "no women's evidence" not in m["label"].lower()
    # And it is not served with a hard 0/5 display.
    assert m["display"] == "Not yet established"


# 4. An unscored medicine cannot be ranked as a valid 0/5.
def test_unscored_medicine_is_not_ranked():
    cc = clinical.class_comparison("Statin")
    assert cc["ranking"]["rankable"] is False  # only 1 scorable statin
    ator = next(r for r in cc["rows"] if r["medicine"] == "Atorvastatin")
    assert ator["maturity_scorable"] is False
    # The rosuvastatin banner must not assert a rank against an unscored peer.
    b = _check()["banner"]["class_comparison"]
    assert b["this_rank"] == ""
    assert "1 statin currently has a verified" in b["summary"]


# 5. Class comparison language cannot imply clinical superiority.
def test_no_superiority_language_anywhere():
    cc = clinical.class_comparison("Statin")
    text = " ".join([cc["note"], cc["ranking"]["summary"], cc["ranking"]["basis"]]
                    + [r["effectiveness_state"] for r in cc["rows"]]).lower()
    for banned in ("more effective", "outperforms", "better than", "superior", "best statin"):
        assert banned not in text


# 6. Study-selection counts reconcile by clearly defined scope.
def test_study_selection_counts_reconcile():
    sel = _check()["study_selection"]
    assert sel["evidence_sources_included"] == (
        sel["unique_phase3_rcts_identified"] + sel["publications_included"]
    )
    assert sel["rcts_for_selected_medicine"] == len(_check()["trials"])
    assert sel["candidate_records_screened"] >= sel["evidence_sources_included"]
    assert str(sel["rcts_for_selected_medicine"]) in sel["reconciliation"]


# 7. Drug Class filters Medicine options correctly.
def test_catalog_groups_medicines_by_class():
    body = client.get("/api/catalog").json()
    cat = body["drug_classes"]
    statin = next(c for c in cat if c["drug_class"] == "Statin")
    # Only completed-ingestion (verified) medicines are selectable (Blocker F):
    # Atorvastatin has not_located female enrollment -> incomplete -> not verified.
    assert set(statin["medicines"]) == {"Rosuvastatin"}
    # Incomplete medicines are discoverable but explicitly not verified.
    inc = {m for c in body["incomplete_medicines"] for m in c["medicines"]}
    assert "Atorvastatin" in inc
    # Every catalog medicine actually has an ingested trial.
    ingested = {t["medicine"] for t in dataset.trials()}
    for c in cat:
        for med in c["medicines"]:
            assert med in ingested


# 8. All five agreed Life Stage options exist and are accepted.
def test_all_five_life_stages_supported():
    required = {"childhood_prepubertal", "puberty_adolescence", "reproductive_years",
                "perimenopause", "menopause_postmenopause"}
    assert required <= engine.LIFE_STAGES
    for stage in required:
        r = _check(life_stage=stage)
        assert r["life_stage_context"]["selected"] == stage


# 9. Age is never used to infer Life Stage.
def test_age_never_infers_life_stage():
    r = _check(life_stage="menopause_postmenopause")
    ctx = r["life_stage_context"]
    assert ctx["supported"] is False
    assert ctx["status"] == "not_established_in_corpus"
    assert "age is not used to infer" in ctx["message"].lower()
    for t in dataset.trials():
        value, _basis, assertion = dataset.assertion_value(
            t["trial_id"], "menopause_status_reported"
        )
        if value == "yes":
            assert "postmenopausal" in assertion["exact_passage"].lower()


# 10. Existing suites still pass — covered by running the whole suite; here we assert
#     the headline copy and maturity-not-stored invariant survive this mission.
def test_headline_copy_and_maturity_not_stored_survive():
    import json
    from pathlib import Path
    ce = (Path(__file__).resolve().parents[2] / "ui" / "src" / "pages" / "CheckEvidence.tsx").read_text(encoding="utf-8")
    # video-redesign: the product question is now the readiness framing.
    assert "How ready is the evidence supporting" in ce
    assert "women like me" not in ce
    # AMIRA still never claims to determine whether a medicine is safe for an individual.
    assert "Is this safe for women?" not in ce
    blob = json.dumps(dataset.load())
    assert "\"maturity_level\"" not in blob and "\"evidence_level\"" not in blob


# "Why this result" must never contradict the derived hero states it summarizes.
def test_why_this_result_matches_derived_states():
    for med, cond in [("Dapagliflozin", "Heart Failure"),
                      ("Rosuvastatin", "Cardiovascular disease prevention")]:
        r = _check(medicine=med, condition=cond)
        why = r["banner"]["why_this_result"].lower()
        eff = clinical.effectiveness_state(med)
        saf = clinical.safety_state(med)

        # If effectiveness has a real drug-specific interaction test, the summary must
        # cite it and must NOT claim the test was not reported/located.
        drug_eff = [f for f in eff["findings"]
                    if f["scope"].startswith("trial:") and f.get("comparison_p") is not None]
        if drug_eff:
            assert "interaction test" in why
            assert f"p = {drug_eff[0]['comparison_p']}".lower() in why
            assert "interaction test, " not in why  # not part of a "not reported" list
            assert "interaction test was not" not in why
            assert "interaction test, menopaus" not in why

        # If safety was reported by sex, the summary must not say a sex-stratified
        # side-effect analysis was missing.
        if saf["n_reporting"] > 0:
            assert "reported separately by sex" in why
            assert "sex-stratified side-effect analysis" not in why

        # Menopause / hormone therapy claims must match the derived maturity trace.
        trace = {t["level"]: t["satisfied"] for t in r["maturity"]["rule_trace"]}
        if trace.get(3):
            assert "menopausal status" not in why or "not report" not in why


def test_dapagliflozin_why_reflects_verified_evidence():
    r = _check(medicine="Dapagliflozin", condition="Heart Failure")
    why = r["banner"]["why_this_result"]
    assert "1,109 women were included" in why
    assert "P = 0.67" in why
    assert "reported separately by sex" in why
    assert "Menopausal status and hormone therapy use were not reported" in why
    # The stale contradictory phrasing must be gone.
    assert "was not located" not in why
    assert "no formal dapagliflozin-specific interaction test" not in why.lower()


def test_brand_descriptor_is_consistent():
    """AMIRA's brand descriptor is 'Evidence Intelligence Platform' everywhere the
    product identity is stated. The primary clinician headline is untouched."""
    from pathlib import Path
    ui = (Path(__file__).resolve().parents[2] / "ui" / "src")
    # The brand descriptor now lives in the header lockup (the left sidebar was
    # removed in the visual-correction redesign).
    header = (ui / "components" / "Header.tsx").read_text(encoding="utf-8")
    assert "Evidence Intelligence Platform" in header
    assert "AI-powered evidence" not in header
    assert not (ui / "components" / "Sidebar.tsx").exists(), "the left sidebar must be gone"
    shell = (ui / "components" / "AmiraShell.tsx").read_text(encoding="utf-8")
    assert "Count women. Study women. Care for women." in shell
    # No internal development labels on the user-facing screen.
    ce_src = (ui / "pages" / "CheckEvidence.tsx").read_text(encoding="utf-8")
    assert "Video-ready" not in ce_src and "cached records" not in ce_src
    # Forbidden descriptors must not appear anywhere in shipped UI source.
    for f in ui.rglob("*.tsx"):
        text = f.read_text(encoding="utf-8")
        assert "Scientific Intelligence Platform" not in text
        assert "Women's Health Evidence Intelligence" not in text
    # The product headline is the video-redesign readiness framing.
    ce = (ui / "pages" / "CheckEvidence.tsx").read_text(encoding="utf-8")
    assert "How ready is the evidence supporting" in ce


# --- Final blocker pass: bounded safety claims + provenance + states ---------- #
def test_safety_no_difference_requires_between_sex_comparison():
    """A within-sex vs placebo comparison must never become a between-sex verdict."""
    for med in ("Dapagliflozin", "Rosuvastatin"):
        saf = clinical.safety_state(med)
        if saf["state"] == clinical.SAF_NO_DIFF:
            drug = [f for f in dataset.findings_for(med, "safety")
                    if f["scope"].startswith("trial:")]
            assert any(f.get("comparison_p") is not None or f.get("comparison_test")
                       for f in drug), f"{med} claims no sex difference with no between-sex test"


def test_dapagliflozin_safety_is_bounded():
    saf = clinical.safety_state("Dapagliflozin")
    assert saf["state"] == clinical.SAF_REPORTED_NO_COMPARISON
    assert "no excess versus placebo" in saf["headline"]
    assert "formal between-sex safety comparison was not reported" in saf["headline"]
    why = _check(medicine="Dapagliflozin", condition="Heart failure")["banner"]["why_this_result"]
    assert "A formal between-sex safety comparison was not reported." in why
    assert "no significant sex-specific difference identified" not in why.lower()


def test_dapa_enrollment_provenance_supports_the_numbers():
    """A-DAPA-002/003 must quote the sentence that actually states enrollment."""
    for aid, needle in (("A-DAPA-002", "1109"), ("A-DAPA-003", "23.4")):
        a = next(x for x in dataset.assertions() if x["assertion_id"] == aid)
        assert needle in a["exact_passage"], f"{aid} passage does not support its value"
        assert "hazard ratio" not in a["exact_passage"].lower()
        src = dataset.source_by_id(a["source_id"])
        assert src["pmid"] == "33787831"


def test_manifest_counts_match_actual_corpus():
    m = dataset.manifest()
    assert m["counts"]["trials"] == len(dataset.trials())
    assert m["counts"]["sources"] == len(dataset.sources())
    assert m["counts"]["assertions"] == len(dataset.assertions())
    assert m["counts"]["findings"] == len(dataset.findings())


def test_not_located_and_not_reported_stay_distinct():
    bases = {a["value_basis"] for a in dataset.assertions()}
    assert "not_located" in bases and "not_reported" in bases
    cards = next(a for a in dataset.assertions()
                 if a["assertion_id"] == "A-CAR-002")
    assert cards["value_basis"] == "not_located"


def test_research_map_renders_not_located_as_unclear():
    from pathlib import Path
    ui = Path(__file__).resolve().parents[2] / "ui" / "src"
    rm = (ui / "pages" / "ResearchMap.tsx").read_text(encoding="utf-8")
    state = (ui / "evidenceState.ts").read_text(encoding="utf-8")
    # ResearchMap routes cells through the shared, exhaustive state helper.
    assert "toEvidenceState" in rm and "EVIDENCE_STATE" in rm
    # The five states are distinct in the shared map and never collapsed.
    assert 'Unclear / not located' in state and '"not_located"' in state
    assert 'did not locate sufficient evidence' in state
    assert 'Evidence status unavailable' in state  # absent is its own state
    for tok in ('"reported"', '"derived"', '"not_reported"', '"not_located"', '"absent"'):
        assert tok in state
