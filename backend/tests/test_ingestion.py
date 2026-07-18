"""ClinicalTrials.gov v2 normalization (pure, offline)."""

from amira.ingestion import chunk_passage, normalize_study

SAMPLE_STUDY = {
    "protocolSection": {
        "identificationModule": {
            "nctId": "NCT01492361",
            "briefTitle": "A Study of Icosapent Ethyl in Cardiovascular Disease",
        },
        "designModule": {"enrollmentInfo": {"count": 8179}},
        "statusModule": {"startDateStruct": {"date": "2011-11-21"}},
        "descriptionModule": {"briefSummary": "A randomized cardiovascular outcomes trial."},
        "eligibilityModule": {"sex": "ALL"},
    }
}


def test_normalize_extracts_core_fields():
    out = normalize_study(SAMPLE_STUDY)
    assert out["nct_id"] == "NCT01492361"
    assert out["total_n"] == 8179
    assert out["publication_year"] == 2011
    assert out["source_type"] == "clinical_trial"
    assert "Eligible sex: ALL." in out["relevant_passage"]
    assert out["url"].endswith("NCT01492361")


def test_normalize_handles_missing_fields():
    out = normalize_study({"protocolSection": {}})
    assert out["nct_id"] is None
    assert out["relevant_passage"]  # never empty


def test_chunk_passage_short():
    assert chunk_passage("short text") == ["short text"]


def test_chunk_passage_splits_long_text():
    text = ". ".join([f"Sentence number {i} with some length here" for i in range(200)])
    chunks = chunk_passage(text, max_chars=500)
    assert len(chunks) > 1
    assert all(len(c) <= 700 for c in chunks)
