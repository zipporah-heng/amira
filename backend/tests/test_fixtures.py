"""Fixtures must validate against the schema and be internally consistent."""

from amira.classification import classify
from amira.fixtures import build_index, load_all_reports, load_hero, lookup
from amira.schema import Classification, EvidenceState


def test_all_fixtures_validate():
    reports = load_all_reports()
    assert len(reports) >= 3


def test_hero_loads_and_is_verified():
    hero = load_hero()
    assert hero.medicine == "Atorvastatin"
    assert hero.human_verified is True
    assert hero.evidence_state == EvidenceState.HAS_EVIDENCE
    # Every hero source must be human-verified and citation-backed.
    for s in hero.sources:
        assert s.human_verified is True
        assert s.relevant_passage.strip() or (s.source_location or "").strip()


def test_hero_classifier_reproduces_fixture_tier():
    hero = load_hero()
    tier, cls = classify(hero.evidence_summary, hero.sources)
    assert tier == hero.evidence_tier
    assert cls == hero.classification


def test_no_evidence_and_no_effect_fixtures_are_distinct_states():
    index = build_index()
    reports = list(index.values())
    states = {r.medicine: r.evidence_state for r in reports}
    assert EvidenceState.NO_EVIDENCE_FOUND in states.values()
    assert EvidenceState.EVIDENCE_OF_NO_EFFECT in states.values()


def test_lookup_resolves_hero():
    index = build_index()
    r = lookup(
        index,
        medicine="Atorvastatin",
        condition="Cardiovascular disease",
        life_stage="postmenopause",
        hormone_therapy="not_specified",
    )
    assert r is not None
    assert r.classification == Classification.LIMITED


def test_lookup_falls_back_across_context():
    index = build_index()
    # Different life stage / HT still resolves to the same medicine+condition.
    r = lookup(
        index,
        medicine="Atorvastatin",
        condition="Cardiovascular disease",
        life_stage="perimenopause",
        hormone_therapy="yes",
    )
    assert r is not None
    assert r.medicine == "Atorvastatin"
