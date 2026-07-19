"""AMIRA API — every number served here is computed from the normalized
real-evidence dataset in /dataset, which is built by pipeline/ingest.py from
ClinicalTrials.gov, PubMed and PMC.

No synthetic evidence is served. Every response carries the dataset version,
source cutoff, commit hash and resolvable source links.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from amira import dataset, engine, exports

REPO = Path(__file__).resolve().parents[1]
UI_DIST = REPO / "ui" / "dist"
BENCHMARK_DIR = REPO / "benchmark"
EVAL_RESULTS = REPO / "evaluation" / "results.json"

app = FastAPI(
    title="AMIRA API",
    description=(
        "Evidence-completeness auditing for women's health. Serves only real, "
        "source-traceable evidence. Does not diagnose, prescribe, or recommend treatment."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class CheckRequest(BaseModel):
    condition: str = "Cardiovascular disease prevention"
    medicine: str = "Rosuvastatin"
    life_stage: str = "not_specified"
    hormone_therapy: str = "any"


def _envelope() -> dict:
    m = dataset.manifest()
    return {
        "dataset_version": m["dataset_version"],
        "source_cutoff": m["source_cutoff"],
        "commit_hash": m["commit_hash"],
        "generated_at": m["generated_at"],
    }


@app.get("/api/health")
def health():
    m = dataset.manifest()
    return {"status": "ok", **_envelope(), "corpus": m["corpus"], "counts": m["counts"]}


@app.get("/api/manifest")
def get_manifest():
    return dataset.manifest()


@app.post("/api/check-evidence")
def check_evidence(req: CheckRequest):
    return JSONResponse(engine.check_evidence(
        condition=req.condition, medicine=req.medicine,
        life_stage=req.life_stage, hormone_therapy=req.hormone_therapy,
    ))


@app.get("/api/trials")
def get_trials():
    return {**_envelope(), "trials": exports.trial_rows()}


@app.get("/api/evidence-assertions")
def get_assertions():
    return {**_envelope(), "assertions": exports.assertion_rows()}


@app.get("/api/screening-log")
def get_screening_log():
    return {**_envelope(), "screening_log": dataset.load()["screening_log"]}


# --- Downloads: generated from the same records the API serves --------------- #
def _attach(content: str, filename: str, media: str) -> PlainTextResponse:
    return PlainTextResponse(
        content, media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/download/trials.csv")
def dl_trials_csv():
    return _attach(exports.trials_csv(), "amira_trials.csv", "text/csv")


@app.get("/api/download/trials.jsonl")
def dl_trials_jsonl():
    return _attach(exports.trials_jsonl(), "amira_trials.jsonl", "application/x-ndjson")


@app.get("/api/download/evidence_assertions.csv")
def dl_assertions_csv():
    return _attach(exports.assertions_csv(), "amira_evidence_assertions.csv", "text/csv")


@app.get("/api/download/evidence_assertions.jsonl")
def dl_assertions_jsonl():
    return _attach(exports.assertions_jsonl(), "amira_evidence_assertions.jsonl",
                   "application/x-ndjson")


@app.get("/api/download/benchmark.jsonl")
def dl_benchmark():
    path = BENCHMARK_DIR / "amira_benchmark.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail="benchmark not built")
    return _attach(path.read_text(encoding="utf-8"), "amira_benchmark.jsonl",
                   "application/x-ndjson")


@app.get("/api/benchmark")
def get_benchmark():
    path = BENCHMARK_DIR / "amira_benchmark.jsonl"
    meta_path = BENCHMARK_DIR / "benchmark_manifest.json"
    if not path.exists() or not meta_path.exists():
        return {**_envelope(), "status": "BENCHMARK NOT BUILT", "items": []}
    items = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    evaluation = (
        json.loads(EVAL_RESULTS.read_text(encoding="utf-8"))
        if EVAL_RESULTS.exists()
        else {"status": "EVALUATION PENDING",
              "note": "No evaluation has been run against the frozen held-out split yet. "
                      "No scores are claimed."}
    )
    return {**_envelope(), **meta, "items": items, "evaluation": evaluation}


# --- Static UI (mounted last so /api/* wins) -------------------------------- #
if UI_DIST.exists():
    if (UI_DIST / "assets").exists():
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
