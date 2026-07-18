"""API contract tests."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_check_evidence_hero():
    r = client.post("/api/check-evidence", json={
        "medicine": "Atorvastatin",
        "condition": "Cardiovascular disease",
        "life_stage": "postmenopause",
        "hormone_therapy": "not_specified",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["classification"] == "LIMITED"
    assert body["evidence_state"] == "HAS_EVIDENCE"
    assert body["human_verified"] is True
    assert len(body["sources"]) == 3
    assert body["selected_life_stage"] == "postmenopause"


def test_no_evidence_state_distinct_from_no_effect():
    no_ev = client.post("/api/check-evidence", json={
        "medicine": "Icosapent ethyl",
        "condition": "Cardiovascular disease",
        "life_stage": "postmenopause",
        "hormone_therapy": "yes",
    }).json()
    no_eff = client.post("/api/check-evidence", json={
        "medicine": "Conjugated equine estrogens + medroxyprogesterone (menopausal hormone therapy)",
        "condition": "Cardiovascular disease",
        "life_stage": "postmenopause",
        "hormone_therapy": "yes",
    }).json()
    assert no_ev["evidence_state"] == "NO_EVIDENCE_FOUND"
    assert no_eff["evidence_state"] == "EVIDENCE_OF_NO_EFFECT"
    assert no_ev["evidence_state"] != no_eff["evidence_state"]


def test_unknown_medicine_404():
    r = client.post("/api/check-evidence", json={
        "medicine": "Nonexistent drug",
        "condition": "Cardiovascular disease",
    })
    assert r.status_code == 404


def test_schema_endpoint():
    r = client.get("/api/schema")
    assert r.status_code == 200
    assert r.json()["title"] == "EvidenceReport"


def test_benchmark_endpoint():
    r = client.get("/api/benchmark")
    assert r.status_code == 200
    body = r.json()
    assert "splits" in body or "error" in body
