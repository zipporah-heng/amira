"""AMIRA FastAPI application.

Serves the JSON API and the built React UI from one process so there is a single
staging URL. All evidence returned by /api/check-evidence is schema-validated and
carries honest provenance + verification labels.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from amira.fixtures import build_index, load_all_reports, lookup
from amira.schema import (
    HormoneTherapyContext,
    LifeStage,
    export_json_schema,
)

REPO = Path(__file__).resolve().parents[1]
UI_DIST = REPO / "ui" / "dist"
EVAL_RESULTS = REPO / "eval" / "results" / "latest.json"

app = FastAPI(
    title="AMIRA API",
    description="Clearer evidence for women's health. Evaluates evidence completeness; "
    "does not diagnose, prescribe, or recommend treatment.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build the fixture index once at startup (fixtures validate on load).
_INDEX = build_index()


class CheckRequest(BaseModel):
    medicine: str
    condition: str
    life_stage: LifeStage = LifeStage.NOT_SPECIFIED
    hormone_therapy: HormoneTherapyContext = HormoneTherapyContext.NOT_SPECIFIED


@app.get("/api/health")
def health():
    return {"status": "ok", "fixtures_loaded": len(_INDEX)}


@app.get("/api/medicines")
def list_medicines():
    """List the medicine/condition combinations available in the reviewed set."""

    out = []
    for report in load_all_reports():
        out.append({
            "medicine": report.medicine,
            "condition": report.condition,
            "life_stage": report.life_stage.value,
            "hormone_therapy": report.hormonal_context.hormone_therapy.value,
            "classification": report.classification.value,
            "evidence_state": report.evidence_state.value,
        })
    return {"count": len(out), "items": out}


@app.post("/api/check-evidence")
def check_evidence(req: CheckRequest):
    report = lookup(
        _INDEX,
        medicine=req.medicine,
        condition=req.condition,
        life_stage=req.life_stage.value,
        hormone_therapy=req.hormone_therapy.value,
    )
    if report is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No fixture for this medicine/condition in the reviewed source set. "
                "AMIRA only reports on evidence it has actually reviewed."
            ),
        )
    # Reflect the user's selected context onto the returned report so the UI can
    # echo exactly what was asked, without altering the underlying evidence.
    data = report.model_dump(mode="json")
    data["selected_life_stage"] = req.life_stage.value
    data["selected_hormone_therapy"] = req.hormone_therapy.value
    return JSONResponse(data)


@app.get("/api/benchmark")
def benchmark():
    if EVAL_RESULTS.exists():
        return json.loads(EVAL_RESULTS.read_text(encoding="utf-8"))
    return {"error": "benchmark results not generated; run eval/run_eval.py --write"}


@app.get("/api/schema")
def schema():
    """Expose the versioned evidence JSON Schema (open-science package)."""

    return export_json_schema()


# --- Static UI (served last so /api/* wins) -------------------------------- #
if UI_DIST.exists():
    app.mount("/assets", StaticFiles(directory=UI_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = UI_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        index = UI_DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="UI not built")
