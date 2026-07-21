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

from amira import dataset, engine, exports, extract, flags, nhanes, readiness

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


class ExtractRequest(BaseModel):
    # Either reference an approved corpus passage by id, or supply a passage +
    # metadata directly (still validated against the stored source).
    passage_id: str | None = None
    passage: str | None = None
    medicine: str | None = None
    condition: str | None = None
    study_identifier: str | None = None
    source_identifier: str | None = None
    source_url: str | None = None


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


@app.get("/api/catalog")
def get_catalog():
    """Condition -> drug class -> verified medicines, for the upfront selectors.

    Only medicines with completed, integrity-checked evidence ingestion appear here.
    """
    # condition -> class -> set(medicines)
    tree: dict = {}
    flat: dict = {}
    for t in dataset.trials():
        cond = t.get("condition") or "Unspecified"
        cls = t.get("drug_class") or "Unclassified"
        tree.setdefault(cond, {}).setdefault(cls, set()).add(t["medicine"])
        flat.setdefault(cls, set()).add(t["medicine"])
    return {
        **_envelope(),
        "conditions": [
            {"condition": cond,
             "drug_classes": [
                 {"drug_class": cls, "medicines": sorted(meds)}
                 for cls, meds in sorted(classes.items())
             ]}
            for cond, classes in sorted(tree.items())
        ],
        # Flat class list kept for backward compatibility.
        "drug_classes": [
            {"drug_class": c, "medicines": sorted(meds)} for c, meds in sorted(flat.items())
        ],
    }


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


@app.get("/api/findings")
def get_findings():
    return {**_envelope(), "findings": exports.finding_rows()}


@app.get("/api/class-comparison")
def get_class_comparison(drug_class: str = "Statin"):
    from amira import clinical
    return {**_envelope(), **clinical.class_comparison(drug_class)}


@app.get("/api/screening-log")
def get_screening_log():
    return {**_envelope(), "screening_log": dataset.load()["screening_log"]}


# --- Feature flags ---------------------------------------------------------- #
@app.get("/api/flags")
def get_flags():
    return {**_envelope(), "flags": flags.snapshot()}


# --- Pilot readiness score (deterministic, feature-flagged) ----------------- #
@app.get("/api/readiness")
def get_readiness(medicine: str = "Rosuvastatin"):
    if not flags.enable_pilot_score():
        return {**_envelope(), "enabled": False,
                "note": "The pilot readiness score is disabled (AMIRA_ENABLE_PILOT_SCORE=0)."}
    return {**_envelope(), "enabled": True, **readiness.evaluate(medicine)}


# --- AI evidence extraction (AMIRA-Extract) --------------------------------- #
@app.get("/api/ai/pipeline")
def get_ai_pipeline():
    """The transparent AI pipeline: stages, provider config, and honest status."""
    cfg = extract.provider_config()
    return {
        **_envelope(),
        "enabled": flags.enable_ai_extraction(),
        "provider": cfg,
        "stages": [
            {"key": "sources", "label": "ClinicalTrials.gov + PubMed + PubMed Central",
             "detail": "Public trial registries and peer-reviewed publications are the only inputs."},
            {"key": "extract", "label": "AI evidence extraction (AMIRA-Extract)",
             "detail": f"Provider: {cfg['provider']}. Prompt {cfg['prompt_version']}. "
                       "The model extracts structured evidence; it never scores or decides."},
            {"key": "schema", "label": "Women's Evidence Schema (v0.2)",
             "detail": "Every extraction must conform to a strict, versioned JSON Schema."},
            {"key": "validate", "label": "Passage validation",
             "detail": "The exact quote must be found verbatim in the stored source, or the "
                       "extraction is quarantined."},
            {"key": "human", "label": "Human review",
             "detail": "Nothing is marked human-verified until a named reviewer signs off."},
            {"key": "readiness", "label": "Deterministic readiness engine",
             "detail": "A pure, testable function computes the maturity level and pilot score. "
                       "No model opinion enters the score."},
            {"key": "dashboard", "label": "AMIRA dashboard + Research Map + open assets",
             "detail": "Only source-linked, validated evidence is displayed or exported."},
        ],
        "safety": [
            "Every extracted claim carries an exact source passage.",
            "Unsupported quotes are rejected or quarantined; a source passage is never invented.",
            "Menopause is never inferred from age.",
            "A sex comparison is never inferred when none was reported.",
            "'No difference' is never inferred from silence.",
            "API keys are read from the environment only — never exposed in the browser, repo, or logs.",
        ],
    }


@app.get("/api/ai/passages")
def get_ai_passages():
    """Approved, source-linked corpus passages the demo may extract from."""
    return {**_envelope(), "enabled": flags.enable_ai_extraction(),
            "passages": extract.approved_passages()}


@app.post("/api/ai/extract")
def post_ai_extract(req: ExtractRequest):
    """Run AMIRA-Extract on an approved passage and return the full evidence trace."""
    if not flags.enable_ai_extraction():
        raise HTTPException(status_code=404, detail="AI extraction is disabled")
    if req.passage_id:
        match = next((p for p in extract.approved_passages() if p["passage_id"] == req.passage_id), None)
        if not match:
            raise HTTPException(status_code=404, detail=f"unknown passage_id {req.passage_id}")
        passage, meta = match["passage"], match
    elif req.passage and req.source_identifier:
        passage = req.passage
        meta = {"medicine": req.medicine, "condition": req.condition,
                "study_identifier": req.study_identifier, "source_identifier": req.source_identifier,
                "source_url": req.source_url}
    else:
        raise HTTPException(status_code=400, detail="provide passage_id, or passage + source_identifier")

    obj = extract.extract_and_validate(passage, meta)
    return {
        **_envelope(),
        "question": "What women's-health evidence does this passage contain, and can every field be traced to it?",
        "extraction": obj,
        "trace": {
            "exact_passage": obj["exact_evidence_passage"],
            "source_url": obj["source_url"],
            "model_version": obj["extraction_model"],
            "prompt_version": obj["prompt_version"],
            "schema_version": obj["schema_version"],
            "passage_validation": obj["validation_state"],
            "human_review": obj["human_review_state"],
            "validation_notes": obj["validation_notes"],
        },
        "score_impact": readiness.evaluate(meta.get("medicine") or "") if flags.enable_pilot_score() else None,
    }


# --- NHANES population context (separate from clinical-trial evidence) ------- #
@app.get("/api/nhanes")
def get_nhanes(drug_class: str = "Statin"):
    if not flags.enable_nhanes():
        return {**_envelope(), "enabled": False,
                "note": "NHANES population context is disabled (AMIRA_ENABLE_NHANES=0)."}
    return {**_envelope(), "enabled": True, **nhanes.context_for_class(drug_class)}


# --- Reusable scientific assets --------------------------------------------- #
@app.get("/api/assets")
def get_assets():
    return {**_envelope(), **_reusable_assets()}


def _reusable_assets() -> dict:
    """Only assets that actually exist in the repository are listed, with their
    honest status. No open license is claimed unless a LICENSE file exists."""
    repo = REPO
    def exists(rel: str) -> bool:
        return (repo / rel).exists()
    license_present = exists("LICENSE")
    assets = [
        {"key": "schema", "title": "Women's Evidence Schema (v0.2)", "path": "schema/womens_evidence_schema_v0.2.json",
         "kind": "schema", "present": exists("schema/womens_evidence_schema_v0.2.json")},
        {"key": "dataset", "title": "Structured evidence dataset", "path": "dataset/",
         "kind": "data", "present": exists("dataset/evidence_assertions.json")},
        {"key": "benchmark", "title": "Benchmark passages", "path": "benchmark/amira_benchmark.jsonl",
         "kind": "data", "present": exists("benchmark/amira_benchmark.jsonl"),
         "status": "pending_human_review"},
        {"key": "prompts", "title": "Prompt library", "path": "prompts/evidence_extraction_v0.1.md",
         "kind": "prompt", "present": exists("prompts/evidence_extraction_v0.1.md")},
        {"key": "pipeline", "title": "Extraction pipeline", "path": "pipeline/extract_with_llm.py",
         "kind": "code", "present": exists("pipeline/extract_with_llm.py")},
        {"key": "validator", "title": "Extraction validator", "path": "pipeline/validate_extractions.py",
         "kind": "code", "present": exists("pipeline/validate_extractions.py")},
        {"key": "evaluation", "title": "Evaluation runner", "path": "evaluation/run_extraction_evaluation.py",
         "kind": "code", "present": exists("evaluation/run_extraction_evaluation.py")},
        {"key": "model_card", "title": "AI model card", "path": "docs/ai-model-card.md",
         "kind": "doc", "present": exists("docs/ai-model-card.md")},
        {"key": "nhanes_card", "title": "NHANES data card", "path": "docs/nhanes-data-card.md",
         "kind": "doc", "present": exists("docs/nhanes-data-card.md")},
        {"key": "readiness_doc", "title": "Readiness pilot methodology", "path": "docs/evidence-readiness-pilot-v0.1.md",
         "kind": "doc", "present": exists("docs/evidence-readiness-pilot-v0.1.md")},
        {"key": "methodology", "title": "Methodology", "path": "docs/methodology.md",
         "kind": "doc", "present": exists("docs/methodology.md")},
        {"key": "downloads", "title": "CSV & JSONL downloads", "path": "/api/download/*",
         "kind": "download", "present": True},
        {"key": "source", "title": "Source code", "path": "https://github.com/zipporah-heng/amira",
         "kind": "code", "present": True},
    ]
    return {
        "assets": [a for a in assets if a["present"]],
        "honest_status": [
            "Benchmark passages are pending human review.",
            "Model evaluation is pending until reviewed labels are available.",
            "No accuracy figure is claimed.",
            "No validated gold benchmark is claimed.",
            ("An open license is present." if license_present
             else "No open license is claimed: reuse terms are pending owner approval."),
        ],
        "license_present": license_present,
    }


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


@app.get("/api/download/findings.csv")
def dl_findings_csv():
    return _attach(exports.findings_csv(), "amira_sex_specific_findings.csv", "text/csv")


@app.get("/api/download/findings.jsonl")
def dl_findings_jsonl():
    return _attach(exports.findings_jsonl(), "amira_sex_specific_findings.jsonl",
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
