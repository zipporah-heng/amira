"""The reusable scientific assets served to the Open Benchmark page.

The schema endpoint must serve the repository's own schema file (no second copy), and
benchmark records must resolve their medicine/condition by a canonical join rather than
carrying invented values.
"""

import json
from pathlib import Path

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)
REPO = Path(main.__file__).resolve().parents[1]


def test_schema_endpoint_serves_the_repository_schema_file():
    r = client.get("/api/schema")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["schema_path"] == "schema/womens_evidence_schema_v0.2.json"

    on_disk = json.loads((REPO / body["schema_path"]).read_text(encoding="utf-8"))
    assert body["schema_version"] == on_disk["version"]
    assert body["field_count"] == len(on_disk["properties"])
    assert body["required_count"] == len(on_disk["required"])
    # Field names and descriptions come straight from the file.
    served = {f["field"]: f for f in body["fields"]}
    assert served.keys() == on_disk["properties"].keys()
    for name, spec in on_disk["properties"].items():
        assert served[name]["description"] == (spec.get("description") or "").strip()
        assert served[name]["required"] == (name in on_disk["required"])


def test_schema_exposes_the_womens_evidence_fields_the_ui_documents():
    fields = {f["field"] for f in client.get("/api/schema").json()["fields"]}
    for expected in [
        "women_represented", "sex_specific_effectiveness", "sex_specific_safety",
        "menopause", "pregnancy", "hormone_therapy", "race_and_ethnicity", "age",
        "exact_evidence_passage", "source_identifier", "human_review_state",
    ]:
        assert expected in fields, expected


def test_benchmark_records_resolve_medicine_by_canonical_join_only():
    body = client.get("/api/benchmark").json()
    items = body["items"]
    assert items, "benchmark should not be empty"

    trials = main.dataset.trials()
    by_nct = {t["nct_id"]: t for t in trials if t.get("nct_id")}
    by_src = {t["primary_source_id"]: t for t in trials if t.get("primary_source_id")}

    for it in items:
        if "medicine" not in it:
            continue
        match = by_nct.get(it.get("nct_id")) or by_src.get(it.get("source_id"))
        assert match is not None, f"{it['benchmark_id']} carries a medicine with no owning trial"
        assert it["medicine"] == match["medicine"]
        assert it["condition"] == (match.get("condition") or match.get("indication"))


def test_benchmark_review_status_is_reported_honestly():
    body = client.get("/api/benchmark").json()
    items = body["items"]
    reviewed = [i for i in items if i.get("human_verified")]
    pending = [i for i in items if not i.get("human_verified")]
    # Reviewed and pending partition the set — the page counts them separately.
    assert len(reviewed) + len(pending) == len(items)
    # A record may only claim review when a named verifier is recorded.
    for i in reviewed:
        assert i.get("human_verifier"), f"{i['benchmark_id']} claims review without a named reviewer"
    assert body["annotation_status"] == "pending_human_review"
    assert body["label_field"] == "draft_label"


def test_no_evaluation_score_is_published_before_human_review():
    body = client.get("/api/benchmark").json()
    ev = body["evaluation"]
    if any(i.get("human_verified") for i in body["items"]):
        return  # once reviewed labels exist, scores may legitimately be reported
    assert ev.get("clinical_accuracy") is None
    assert ev.get("macro_f1") is None


def test_assets_manifest_only_reports_files_that_exist():
    for a in client.get("/api/assets").json()["assets"]:
        if a["present"] and not a["path"].startswith(("http", "/api/")):
            assert (REPO / a["path"]).exists(), f"{a['key']} reported present but missing"
