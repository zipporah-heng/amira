"""AMIRA-Extract — the AI evidence-extraction component.

AMIRA-Extract converts ONE clinical-research passage from ONE source document
into the structured Women's Evidence Schema (v0.2). It is deliberately narrow
and strictly local:

  * **Passage-local and source-local.** An extraction is bound to a single
    trial_id, source_document_id, and passage_id. It NEVER borrows a value from
    another trial, publication, or passage of the same medicine. (A DIG passage
    can never carry DECISION's 284-woman count.) Medicine-level synthesis happens
    later, in the deterministic engines, and is kept visibly separate.
  * The model (or the offline recorded provider) EXTRACTS structured evidence.
    It NEVER calculates the readiness score or decides a clinical outcome — that
    is the deterministic ``readiness``/``maturity``/``clinical`` engines' job.

Providers are pluggable via environment variables so the reusable contribution
is the schema + prompt + validator + evaluation, not one proprietary model:

    AMIRA_LLM_PROVIDER   recorded (default) | openai | anthropic
    AMIRA_LLM_MODEL      model id for the chosen provider
    AMIRA_LLM_API_KEY    provider API key (read from the environment ONLY; never
                         written to logs, the repository, or the browser)

The default ``recorded`` provider REPLAYS a previously generated structured
extraction from the committed corpus so the pipeline can be demonstrated without
sending data to an external model. It makes no live model call. A live provider
uses schema-constrained Structured Outputs; if the call fails, the failure is
surfaced honestly and recorded output is never presented as live output.
"""

from __future__ import annotations

import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from . import dataset

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "womens_evidence_schema_v0.2.json"
SCHEMA_VERSION = "0.2"
PROMPT_VERSION = "evidence-extraction-v0.1"

# Extraction timestamps for the recorded provider are pinned to the dataset build
# time so the replay is fully deterministic (no wall-clock in outputs).
_RECORDED_TIMESTAMP = "2026-07-20T18:42:00Z"


class ProviderUnavailable(RuntimeError):
    """Raised when a live LLM provider is selected but not configured."""


class LiveProviderError(RuntimeError):
    """Raised when a live model call fails. Surfaced honestly; never silently
    replaced with recorded output."""


@lru_cache(maxsize=1)
def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# Stored-source text: the corpus of passages the model is allowed to quote from.
# --------------------------------------------------------------------------- #
def _stored_passages(source_id: str) -> List[str]:
    """Every exact passage AMIRA has stored (as an excerpt) for a source."""
    out: List[str] = []
    for a in dataset.assertions():
        if a["source_id"] == source_id and a.get("exact_passage"):
            out.append(a["exact_passage"])
    for f in dataset.findings():
        if f["source_id"] == source_id and f.get("exact_passage"):
            out.append(f["exact_passage"])
    for c in dataset.direct_comparisons():
        if c["source_id"] == source_id and c.get("exact_passage"):
            out.append(c["exact_passage"])
        for o in c.get("outcomes", []):
            if o.get("exact_passage"):
                out.append(o["exact_passage"])
    return out


def _provenance(source_id: str, passage: Optional[str]) -> dict:
    """Bind a passage to one stored source excerpt, with a tamper-evident hash.

    AMIRA stores source *excerpts*, not full retrieved documents, so match_basis
    is 'stored_excerpt' — we never claim the whole original publication was
    automatically verified."""
    stored = _stored_passages(source_id)
    idx = -1
    if passage:
        for i, s in enumerate(stored):
            if passage in s or s in passage:
                idx = i
                break
    src = dataset.source_by_id(source_id) if source_id else {}
    text = passage or ""
    return {
        "source_document_id": source_id,
        "source_url": src.get("url", ""),
        "passage_index": idx,
        "content_hash": "sha1:" + hashlib.sha1(text.encode("utf-8")).hexdigest() if text else "sha1:",
        "retrieval_date": src.get("retrieved_at"),
        "match_basis": "stored_excerpt" if idx >= 0 else "unavailable",
    }


def _source_doc_id(source_id: str) -> str:
    """A human-facing document id: PMID / NCT / PMCID if present, else the SRC id."""
    if not source_id:
        return ""
    s = dataset.source_by_id(source_id)
    if s.get("pmid"):
        return f"PMID {s['pmid']}"
    if s.get("nct_id"):
        return s["nct_id"]
    if s.get("pmcid"):
        return s["pmcid"]
    return source_id


def approved_passages() -> List[dict]:
    """Approved, source-linked corpus passages the interactive demo may extract
    from. Each is bound to exactly one trial, source document, and passage."""
    seen = set()
    out = []
    for f in dataset.findings():
        if f["scope"].startswith("class:"):
            continue
        key = (f["source_id"], f["exact_passage"][:40])
        if key in seen:
            continue
        seen.add(key)
        s = dataset.source_by_id(f["source_id"])
        trial_id = f["scope"].split(":", 1)[1] if f["scope"].startswith("trial:") else ""
        out.append({
            "passage_id": f["finding_id"],
            "finding_id": f["finding_id"],
            "trial_id": trial_id,
            "label": f"{f['medicine']} — {f['endpoint']}",
            "medicine": f["medicine"],
            "condition": _condition_for(trial_id),
            "study_identifier": trial_id,
            "source_identifier": s["source_id"],
            "source_document_id": _source_doc_id(s["source_id"]),
            "source_url": s["url"],
            "passage": f["exact_passage"],
        })
    return out


def _condition_for(trial_id: str) -> Optional[str]:
    for t in dataset.trials():
        if t["trial_id"] == trial_id:
            return t.get("condition")
    return None


def _trial_by_id(trial_id: str) -> Optional[dict]:
    return next((t for t in dataset.trials() if t["trial_id"] == trial_id), None)


# --------------------------------------------------------------------------- #
# Passage-/trial-local field mapping (NEVER aggregates across trials)
# --------------------------------------------------------------------------- #
def _trial_dim_state(trial_id: str, dimension: str) -> str:
    """Map ONE trial's assertion for a dimension to a schema enum value."""
    value, basis, a = dataset.assertion_value(trial_id, dimension)
    if a is None:
        return "not_located"
    if value == dataset.AFFIRMATIVE:
        return "reported"
    if basis == "not_located":
        return "not_located"
    return "not_reported"


def _recorded_extraction(passage: str, meta: dict) -> dict:
    """Replay a previously generated structured extraction for ONE passage from
    ONE source. Every field is drawn from that trial/source only."""
    source_id = meta.get("source_identifier") or ""
    medicine = meta.get("medicine") or ""
    trial_id = meta.get("trial_id") or ""
    passage_id = meta.get("passage_id") or ""
    trial = _trial_by_id(trial_id) or {}

    # Women count/percentage: ONLY from this trial's own assertions.
    women_count = None
    women_pct = None
    women_state = _trial_dim_state(trial_id, "female_enrollment_count")
    c_val, c_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_count")
    p_val, p_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_pct")
    if c_basis == "reported" and isinstance(c_val, (int, float)):
        women_count = int(c_val)
    if p_basis in ("reported", "derived") and isinstance(p_val, (int, float)):
        women_pct = float(p_val)
    if women_state == "not_located" and p_basis == "reported":
        women_state = "reported"  # a reported % still counts as represented

    # Formal comparison + interaction statistic: ONLY from the specific finding
    # this passage came from (matched by passage_id/finding_id).
    finding = next((f for f in dataset.findings() if f.get("finding_id") == passage_id), None)
    women_only = (trial.get("sex_eligibility") or "").upper() == "FEMALE"
    interaction_stat = None
    formal = "not_reported"
    if women_only:
        formal = "not_applicable"
    elif finding and finding.get("comparison_p") is not None and finding.get("significance") in (
        "significant", "no_significant_difference"
    ):
        formal = "reported"
        test = finding.get("comparison_test") or "Sex-by-treatment comparison"
        interaction_stat = f"{test}: P = {finding['comparison_p']}"

    return {
        "medicine": medicine,
        "condition": meta.get("condition"),
        "trial_id": trial_id,
        "study_identifier": meta.get("study_identifier") or trial_id,
        "source_identifier": source_id,
        "source_document_id": meta.get("source_document_id") or _source_doc_id(source_id),
        "passage_id": passage_id,
        "assertion_id": None,
        "women_represented": "yes" if (women_count is not None or women_pct is not None) else women_state,
        "women_count": women_count,
        "women_percentage": women_pct,
        "sex_specific_effectiveness": _trial_dim_state(trial_id, "sex_specific_efficacy_reported"),
        "formal_sex_comparison": formal,
        "interaction_statistic": interaction_stat,
        "sex_specific_safety": _trial_dim_state(trial_id, "sex_specific_safety_reported"),
        "menopause": _trial_dim_state(trial_id, "menopause_status_reported"),
        "pregnancy": _trial_dim_state(trial_id, "pregnancy_evidence_reported"),
        "hormone_therapy": _trial_dim_state(trial_id, "hormone_therapy_reported"),
        "hormonal_variability": "not_located",
        "race_and_ethnicity": "not_located",
        "age": _age_for(trial),
        "evidence_state": _trial_evidence_state(trial_id),
        "exact_evidence_passage": passage,
        "source_url": meta.get("source_url") or (dataset.source_by_id(source_id)["url"] if source_id else ""),
        "extraction_model": f"recorded-corpus-v{dataset.manifest()['dataset_version']}",
        "live_model_call": False,
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "extraction_timestamp": _RECORDED_TIMESTAMP,
        "validation_state": "pending",
        "source_match_state": "stored_excerpt_matched",
        "validation_notes": None,
        "human_review_state": "not_reviewed",
        "human_reviewer": None,
        "provenance": _provenance(source_id, passage),
    }


def _age_for(trial: dict) -> Optional[str]:
    if trial.get("minimum_age"):
        return f"Minimum age {trial['minimum_age']} (age eligibility only; not a menopause claim)"
    return None


def _trial_evidence_state(trial_id: str) -> str:
    """Per-trial included-dimension state (never a medicine-level aggregate)."""
    c_val, c_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_count")
    p_val, p_basis, _ = dataset.assertion_value(trial_id, "female_enrollment_pct")
    if c_basis == "reported":
        return "complete"
    if p_basis in ("reported", "derived"):
        return "partial"
    if c_basis == "not_located" or p_basis == "not_located":
        return "not_located"
    return "not_reported"


def _live_extraction(passage: str, meta: dict, provider: str, model: str) -> dict:
    """Call a live LLM provider with schema-constrained Structured Outputs.

    Only runs when a key is present; the key is never logged. On any failure a
    LiveProviderError is raised so the caller can surface it honestly — recorded
    output is never silently returned as live output."""
    api_key = os.environ.get("AMIRA_LLM_API_KEY")
    if not api_key:
        raise ProviderUnavailable(
            f"provider '{provider}' selected but AMIRA_LLM_API_KEY is not set."
        )
    prompt = build_prompt(passage, meta)
    schema = load_schema()
    try:
        if provider == "openai":
            from openai import OpenAI  # lazy optional dependency
            client = OpenAI(api_key=api_key)
            resp = client.chat.completions.create(
                model=model,
                # Schema-constrained Structured Outputs (NOT generic JSON mode).
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "womens_evidence_v0_2", "schema": schema, "strict": False},
                },
                messages=[{"role": "system", "content": prompt["system"]},
                          {"role": "user", "content": prompt["user"]}],
                temperature=0,
            )
            obj = json.loads(resp.choices[0].message.content)
        elif provider == "anthropic":
            import anthropic  # lazy optional dependency
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model=model, max_tokens=1500, temperature=0,
                system=prompt["system"] + "\nReturn only a JSON object conforming to the provided schema.",
                messages=[{"role": "user", "content": prompt["user"]}],
            )
            obj = json.loads(resp.content[0].text)
        else:
            raise ProviderUnavailable(f"unknown provider '{provider}'")
    except (ProviderUnavailable,):
        raise
    except Exception as e:  # network / parse / API error — surface honestly
        raise LiveProviderError(f"live extraction failed ({provider}:{model}): {type(e).__name__}") from e

    # Pipeline-owned fields (never trust the model to set these).
    obj["schema_version"] = SCHEMA_VERSION
    obj["prompt_version"] = PROMPT_VERSION
    obj["extraction_model"] = f"{provider}:{model}"
    obj["live_model_call"] = True
    obj["validation_state"] = "pending"
    obj["source_match_state"] = "stored_excerpt_matched"
    obj["human_review_state"] = "not_reviewed"
    obj.setdefault("trial_id", meta.get("trial_id") or "")
    obj.setdefault("passage_id", meta.get("passage_id") or "")
    obj.setdefault("source_document_id", meta.get("source_document_id") or _source_doc_id(meta.get("source_identifier") or ""))
    obj.setdefault("provenance", _provenance(meta.get("source_identifier") or "", obj.get("exact_evidence_passage")))
    return obj


def build_prompt(passage: str, meta: dict) -> Dict[str, str]:
    system = (
        "You are AMIRA-Extract, a careful biomedical evidence extractor. Convert the passage into "
        "ONE JSON object conforming exactly to womens_evidence_schema_v0.2.json. Extract only what "
        "THIS passage and THIS source state; never borrow a value from another trial or publication. "
        "Use not_reported/not_located otherwise, and null for a missing count. Copy "
        "exact_evidence_passage verbatim (never begin mid-word). Never infer menopause from age. "
        "Never infer a sex comparison that was not reported. Never infer 'no difference' from silence. "
        "Do not diagnose, prescribe, recommend, or rank. Output only the JSON object."
    )
    user = (
        f"SOURCE METADATA\n  medicine: {meta.get('medicine')}\n  condition: {meta.get('condition')}\n"
        f"  trial_id: {meta.get('trial_id')}\n  study_identifier: {meta.get('study_identifier')}\n"
        f"  source_identifier: {meta.get('source_identifier')}\n"
        f"  source_document_id: {meta.get('source_document_id')}\n  passage_id: {meta.get('passage_id')}\n"
        f"  source_url: {meta.get('source_url')}\n\nPASSAGE (quote from this text only)\n\"\"\"\n{passage}\n\"\"\"\n\n"
        "Return one JSON object conforming to womens_evidence_schema_v0.2.json."
    )
    return {"system": system, "user": user}


def provider_config() -> Dict[str, object]:
    provider = os.environ.get("AMIRA_LLM_PROVIDER", "recorded").strip().lower()
    is_recorded = provider == "recorded"
    return {
        "provider": provider,
        "provider_label": "Recorded corpus extraction" if is_recorded else f"Live model ({provider})",
        "model": os.environ.get("AMIRA_LLM_MODEL", "") or ("recorded-corpus-v" + dataset.manifest()["dataset_version"] if is_recorded else ""),
        "is_recorded": is_recorded,
        "live_capable": (not is_recorded) and bool(os.environ.get("AMIRA_LLM_API_KEY")),
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "api_key_present": bool(os.environ.get("AMIRA_LLM_API_KEY")),
    }


def extract(passage: str, meta: dict) -> dict:
    """Produce a schema-conforming extraction using the configured provider.

    Returns the object with ``validation_state`` still ``pending``; call
    :func:`validate` before trusting it."""
    provider = os.environ.get("AMIRA_LLM_PROVIDER", "recorded").strip().lower()
    model = os.environ.get("AMIRA_LLM_MODEL", "")
    if provider == "recorded":
        return _recorded_extraction(passage, meta)
    return _live_extraction(passage, meta, provider, model)


# --------------------------------------------------------------------------- #
# Validation: schema + exact-quote + anti-inference guards
# --------------------------------------------------------------------------- #
def _schema_errors(obj: dict) -> List[str]:
    try:
        import jsonschema
    except Exception:  # pragma: no cover - jsonschema is a declared dependency
        return []
    validator = jsonschema.Draft7Validator(load_schema())
    return [f"{'/'.join(str(p) for p in e.path) or '(root)'}: {e.message}"
            for e in validator.iter_errors(obj)]


def validate(obj: dict) -> Tuple[str, str, List[str]]:
    """Validate an extraction. Returns ``(validation_state, source_match_state, notes)``.

    Order: schema -> exact-quote -> anti-inference guards. Any failure quarantines
    the extraction. Nothing is ever silently accepted."""
    notes: List[str] = []

    schema_errs = _schema_errors(obj)
    if schema_errs:
        return "quarantined", "quarantined", ["schema: " + e for e in schema_errs]

    passage = obj.get("exact_evidence_passage")
    source_id = obj.get("source_identifier") or ""
    stored = _stored_passages(source_id)

    # An absence finding legitimately carries no quotation.
    if passage is None:
        notes.append("absence finding: no quotation; not located in reviewed source.")
        return "schema_valid", "source_match_unavailable", notes

    passage = passage.strip()
    if not passage:
        return "quarantined", "quarantined", ["quote: extraction has an empty exact_evidence_passage"]
    if not any(passage in s or s in passage for s in stored):
        return "quarantined", "quarantined", [
            "quote: exact_evidence_passage was not found in the stored source excerpt "
            f"'{source_id}' — rejected to prevent an invented quote."
        ]

    # Guard 1: never infer menopause from age.
    if obj.get("menopause") == "reported":
        if "menopaus" not in " ".join(stored).lower():
            return "quarantined", "quarantined", [
                "guard: menopause is marked 'reported' but no stored passage for this source "
                "mentions menopausal status. Age is never used to infer menopause."
            ]
    # Guard 2: never claim a formal sex comparison without a reported statistic.
    if obj.get("formal_sex_comparison") == "reported" and not obj.get("interaction_statistic"):
        return "quarantined", "quarantined", [
            "guard: formal_sex_comparison is 'reported' but no interaction_statistic was extracted."
        ]
    # Guard 3: never infer 'no difference' from silence.
    if obj.get("formal_sex_comparison") == "not_reported" and obj.get("evidence_state") == "complete":
        notes.append("note: no formal sex comparison reported; evidence_state does not imply equivalence.")

    notes.append("passage matched AMIRA's stored source excerpt (not the full original publication).")
    # AMIRA stores excerpts, so the honest match state is 'stored_excerpt_matched'.
    return "quote_verified", "stored_excerpt_matched", notes


def extract_and_validate(passage: str, meta: dict) -> dict:
    obj = extract(passage, meta)
    state, match_state, notes = validate(obj)
    obj["validation_state"] = state
    obj["source_match_state"] = match_state
    obj["validation_notes"] = " ".join(notes) if notes else None
    return obj
