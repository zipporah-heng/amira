"""Critical Signals intelligence layer: derived from canonical verified evidence,
Digoxin is the only Featured signal, incomplete medicines generate nothing, and the
Featured promotion rule holds."""

from amira import signals, dataset

INCOMPLETE = {"Semaglutide", "Liraglutide", "Tirzepatide", "Apixaban", "Alendronate",
              "Denosumab", "Tamoxifen", "Anastrozole", "Carbidopa/Levodopa", "Lecanemab",
              "Donanemab", "Methylphenidate", "Lisdexamfetamine", "Atomoxetine",
              "Risperidone", "Aripiprazole"}


def test_digoxin_is_the_only_featured_signal_with_canonical_provenance():
    feats = signals.featured()
    assert len(feats) == 1
    s = feats[0]
    assert s["medicine"] == "Digoxin"
    assert s["signal_type"] == "Mortality"
    assert s["headline"] == "33.1% of women assigned digoxin died during follow-up"
    # Preserves the exact canonical stats.
    for token in ["28.9% placebo", "Adjusted HR 1.23", "95% CI 1.02-1.47", "P = 0.014"]:
        assert token in s["summary"], token
    # Resolves back to canonical records (no second truth system).
    assert s["finding_id"] == "F-EFF-DIG-001"
    assert s["trial_id"] == "DIG"
    assert s["source_resolved"] is True
    assert s["exact_passage"] and s["exact_passage"].strip()
    assert s["evidence_status"] == "Human Review Pending"
    # Bounded cautions preserved.
    joined = " ".join(s["cautions"]).lower()
    assert "post hoc" in joined and "not menopause-specific" in joined
    assert "not a treatment recommendation" in joined


def test_featured_is_capped_and_priority_ordered():
    feats = signals.featured()
    assert len(feats) <= signals.MAX_FEATURED
    pri = [s["featured_priority"] for s in feats]
    assert pri == sorted(pri)


def test_incomplete_medicines_generate_no_signals():
    meds = {s["medicine"] for s in signals.library()}
    assert not (meds & INCOMPLETE)


def test_every_signal_resolves_to_a_canonical_verified_finding():
    fids = {f["finding_id"] for f in dataset.findings() if dataset.verified_evidence(f)}
    for s in signals.library():
        assert s["finding_id"] in fids


def test_featured_promotion_rule_rejects_unverified_and_nonsignificant():
    # Unverified even if significant -> not eligible.
    assert signals._featured_eligible(
        {"significance": "significant", "source_verified": False, "source_id": "SRC-PMID-12409542",
         "exact_passage": "x"}) is False
    # Verified + not significant -> not eligible.
    assert signals._featured_eligible(
        {"significance": "no_significant_difference", "source_verified": True,
         "source_id": "SRC-PMID-12409542", "exact_passage": "x"}) is False


def test_library_rows_carry_filterable_fields():
    for s in signals.library():
        for k in ("health_area", "condition", "signal_type", "life_stage", "evidence_status"):
            assert k in s
