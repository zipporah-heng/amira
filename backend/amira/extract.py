"""AMIRA-Extract — the AI evidence-extraction component.

AMIRA-Extract converts a clinical-research passage into the structured Women's
Evidence Schema (v0.2). It is deliberately narrow:

  * The LLM (or the offline recorded provider) EXTRACTS structured evidence.
  * It NEVER calculates the readiness score or decides a clinical outcome — that
    is the deterministic ``readiness``/``maturity``/``clinical`` engines' job.

Providers are pluggable via environment variables so the reusable contribution
is the schema + prompt + validator + evaluation, not one proprietary model:

    AMIRA_LLM_PROVIDER   recorded (default) | openai | anthropic
    AMIRA_LLM_MODEL      model id for the chosen provider
    AMIRA_LLM_API_KEY    provider API key (read from the environment ONLY; never
                         written to logs, the repository, or the browser)

The default ``recorded`` provider replays already-source-verified extractions
from the committed corpus. It requires no network and no key, so the demo and
the pipeline are fully deterministic and safe offline. A live provider produces
the same schema; every output is re-validated here before it is trusted.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from . import dataset

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "womens_evidence_schema_v0.2.json"
SCHEMA_VERSION = "0.2"
PROMPT_VERSION = "evidence-extraction-v0.1"

# Extraction timestamps are pinned to the dataset build time so the recorded
# provider is fully deterministic (no wall-clock in outputs).
_RECORDED_TIMESTAMP = "2026-07-20T18:42:00Z"


class ProviderUnavailable(RuntimeError):
    """Raised when a live LLM provider is selected but not configured."""


@lru_cache(maxsize=1)
def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# Stored-source text: the corpus of passages the model is allowed to quote from.
# --------------------------------------------------------------------------- #
def _stored_passages(source_id: str) -> List[str]:
    """Every exact passage AMIRA has stored for a source (assertions + findings +
    direct comparisons). The quote validator matches against these."""
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


def approved_passages() -> List[dict]:
    """Approved corpus passages the interactive demo may extract from.

    These are real, source-linked passages already in AMIRA. Each entry is a safe,
    controlled input for the 'Analyze an evidence passage' demonstration.
    """
    seen = set()
    out = []
    # Findings carry the richest sex-specific passages; surface them first.
    for f in dataset.findings():
        if f["scope"].startswith("class:"):
            continue
        key = (f["source_id"], f["exact_passage"][:40])
        if key in seen:
            continue
        seen.add(key)
        s = dataset.source_by_id(f["source_id"])
        med_trial = _medicine_and_trial(f["medicine"])
        out.append({
            "passage_id": f["finding_id"],
            "label": f"{f['medicine']} — {f['endpoint']}",
            "medicine": f["medicine"],
            "condition": _condition_for(f["medicine"]),
            "study_identifier": f["scope"].split(":", 1)[1] if ":" in f["scope"] else (med_trial or ""),
            "source_identifier": s["source_id"],
            "source_url": s["url"],
            "passage": f["exact_passage"],
        })
    return out


def _medicine_and_trial(medicine: str) -> Optional[str]:
    for t in dataset.trials():
        if t["medicine"].lower() == medicine.lower():
            return t["trial_id"]
    return None


def _condition_for(medicine: str) -> Optional[str]:
    for t in dataset.trials():
        if t["medicine"].lower() == medicine.lower():
            return t.get("condition")
    return None


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #
def _dim_state(medicine: str, dimension: str) -> str:
    """Map the committed assertions for a medicine to a schema enum value."""
    bases = set()
    affirmative = False
    for t in dataset.trials():
        if t["medicine"].lower() != medicine.lower():
            continue
        value, basis, a = dataset.assertion_value(t["trial_id"], dimension)
        if a is None:
            continue
        bases.add(basis)
        if value == dataset.AFFIRMATIVE:
            affirmative = True
    if affirmative:
        return "reported"
    if "not_located" in bases and "not_reported" not in bases:
        return "not_located"
    if bases:
        return "not_reported"
    return "not_located"


def _recorded_extraction(passage: str, meta: dict) -> dict:
    """Assemble a schema-conforming extraction from the committed corpus for the
    given (source, passage). This replays verified evidence — the 'AI-extracted
    answer' is exactly what AMIRA already extracted and source-verified."""
    source_id = meta.get("source_identifier") or ""
    medicine = meta.get("medicine") or ""
    # Women count / percentage, only where a source reports them for this medicine.
    women_count = None
    women_pct = None
    women_state = _dim_state(medicine, "female_enrollment_count")
    for t in dataset.trials():
        if t["medicine"].lower() != medicine.lower():
            continue
        c_val, c_basis, _ = dataset.assertion_value(t["trial_id"], "female_enrollment_count")
        p_val, p_basis, _ = dataset.assertion_value(t["trial_id"], "female_enrollment_pct")
        if c_basis == "reported" and isinstance(c_val, (int, float)):
            women_count = int(c_val)
        if p_basis in ("reported", "derived") and isinstance(p_val, (int, float)):
            women_pct = float(p_val)

    eff_findings = [f for f in dataset.findings_for(medicine, "efficacy") if f["scope"].startswith("trial:")]
    interaction = next((f.get("comparison_p") for f in eff_findings if f.get("comparison_p") is not None), None)
    interaction_stat = None
    if interaction is not None:
        test = next((f.get("comparison_test") for f in eff_findings if f.get("comparison_p") is not None), "")
        interaction_stat = f"{test}: P = {interaction}".strip(": ")
    has_formal = any(
        f.get("comparison_p") is not None and f.get("significance") in ("significant", "no_significant_difference")
        for f in eff_findings
    )
    women_only = _is_women_only(medicine)

    return {
        "medicine": medicine,
        "condition": meta.get("condition"),
        "study_identifier": meta.get("study_identifier") or "",
        "source_identifier": source_id,
        "women_represented": "yes" if (women_count or women_pct or women_state == "reported") else women_state,
        "women_count": women_count,
        "women_percentage": women_pct,
        "sex_specific_effectiveness": _dim_state(medicine, "sex_specific_efficacy_reported"),
        "formal_sex_comparison": (
            # Only ever 'reported' when a formal drug-specific test actually exists.
            "not_applicable" if women_only else ("reported" if has_formal else "not_reported")
        ),
        "interaction_statistic": interaction_stat,
        "sex_specific_safety": _dim_state(medicine, "sex_specific_safety_reported"),
        "menopause": _dim_state(medicine, "menopause_status_reported"),
        "pregnancy": _dim_state(medicine, "pregnancy_evidence_reported"),
        "hormone_therapy": _dim_state(medicine, "hormone_therapy_reported"),
        "hormonal_variability": "not_reported",
        "race_and_ethnicity": "not_located",
        "age": _age_for(medicine),
        "evidence_state": _evidence_state_for(passage, medicine),
        "exact_evidence_passage": passage,
        "source_url": meta.get("source_url") or (dataset.source_by_id(source_id)["url"] if source_id else ""),
        "extraction_model": f"recorded-corpus-v{dataset.manifest()['dataset_version']}",
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "extraction_timestamp": _RECORDED_TIMESTAMP,
        "validation_state": "pending",
        "validation_notes": None,
        "human_review_state": "not_reviewed",
        "human_reviewer": None,
    }


def _is_women_only(medicine: str) -> bool:
    trials = [t for t in dataset.trials() if t["medicine"].lower() == medicine.lower()]
    fem = [t for t in trials if (t.get("sex_eligibility") or "").upper() == "FEMALE"]
    return bool(fem) and len(fem) == len(trials)


def _age_for(medicine: str) -> Optional[str]:
    for t in dataset.trials():
        if t["medicine"].lower() == medicine.lower() and t.get("minimum_age"):
            return f"Minimum age {t['minimum_age']} (age eligibility only; not a menopause claim)"
    return None


def _evidence_state_for(passage: str, medicine: str) -> str:
    from . import readiness
    # Reflect the medicine's overall included-dimension state as the passage's state.
    state, _, _ = readiness._dim_included(medicine)
    return state


def _live_extraction(passage: str, meta: dict, provider: str, model: str) -> dict:
    """Call a live LLM provider. Only runs when a key is present; never logs it."""
    api_key = os.environ.get("AMIRA_LLM_API_KEY")
    if not api_key:
        raise ProviderUnavailable(
            f"provider '{provider}' selected but AMIRA_LLM_API_KEY is not set; "
            "falling back is the caller's responsibility."
        )
    prompt = build_prompt(passage, meta)
    if provider == "openai":
        from openai import OpenAI  # imported lazily; optional dependency at runtime
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model, response_format={"type": "json_object"},
            messages=[{"role": "system", "content": prompt["system"]},
                      {"role": "user", "content": prompt["user"]}],
            temperature=0,
        )
        obj = json.loads(resp.choices[0].message.content)
    elif provider == "anthropic":
        import anthropic  # optional dependency at runtime
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=model, max_tokens=1024, temperature=0,
            system=prompt["system"],
            messages=[{"role": "user", "content": prompt["user"]}],
        )
        obj = json.loads(resp.content[0].text)
    else:
        raise ProviderUnavailable(f"unknown provider '{provider}'")
    # Force pipeline-owned fields (never trust the model to set these).
    obj.setdefault("schema_version", SCHEMA_VERSION)
    obj["prompt_version"] = PROMPT_VERSION
    obj["extraction_model"] = f"{provider}:{model}"
    obj["validation_state"] = "pending"
    obj["human_review_state"] = "not_reviewed"
    return obj


def build_prompt(passage: str, meta: dict) -> Dict[str, str]:
    system = (
        "You are AMIRA-Extract, a careful biomedical evidence extractor. Convert the passage into "
        "ONE JSON object conforming exactly to womens_evidence_schema_v0.2.json. Extract only what "
        "the passage states; use not_reported/not_located otherwise. Copy exact_evidence_passage "
        "verbatim. Never infer menopause from age. Never infer a sex comparison that was not reported. "
        "Never infer 'no difference' from silence. Do not diagnose, prescribe, recommend, or rank. "
        "Output only the JSON object."
    )
    user = (
        f"SOURCE METADATA\n  medicine: {meta.get('medicine')}\n  condition: {meta.get('condition')}\n"
        f"  study_identifier: {meta.get('study_identifier')}\n  source_identifier: {meta.get('source_identifier')}\n"
        f"  source_url: {meta.get('source_url')}\n\nPASSAGE (quote from this text only)\n\"\"\"\n{passage}\n\"\"\"\n\n"
        "Return one JSON object conforming to womens_evidence_schema_v0.2.json."
    )
    return {"system": system, "user": user}


def provider_config() -> Dict[str, str]:
    return {
        "provider": os.environ.get("AMIRA_LLM_PROVIDER", "recorded"),
        "model": os.environ.get("AMIRA_LLM_MODEL", ""),
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "api_key_present": bool(os.environ.get("AMIRA_LLM_API_KEY")),
    }


def extract(passage: str, meta: dict) -> dict:
    """Produce a schema-conforming extraction using the configured provider.

    Returns the extraction object WITH ``validation_state`` still ``pending``;
    call :func:`validate` on the result before trusting it."""
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


def validate(obj: dict) -> Tuple[str, List[str]]:
    """Validate an extraction. Returns ``(validation_state, notes)``.

    Order: schema → exact-quote → anti-inference guards. Any failure quarantines
    the extraction. Nothing is ever silently accepted."""
    notes: List[str] = []

    schema_errs = _schema_errors(obj)
    if schema_errs:
        return "quarantined", ["schema: " + e for e in schema_errs]

    # Exact-quote validation: the passage must appear verbatim in a stored source.
    passage = (obj.get("exact_evidence_passage") or "").strip()
    source_id = obj.get("source_identifier") or ""
    stored = _stored_passages(source_id)
    if not passage:
        return "quarantined", ["quote: extraction has no exact_evidence_passage"]
    if not any(passage in s or s in passage for s in stored):
        return "quarantined", [
            "quote: exact_evidence_passage was not found verbatim in the stored source "
            f"'{source_id}' — the extraction is rejected to prevent an invented quote."
        ]

    # Guard 1: never infer menopause from age. 'reported' is allowed only when some
    # verbatim stored passage for this source actually mentions menopausal status —
    # never because the population is simply old enough.
    if obj.get("menopause") == "reported":
        corpus_text = " ".join(stored).lower()
        if "menopaus" not in corpus_text:
            return "quarantined", [
                "guard: menopause is marked 'reported' but no stored passage for this source "
                "mentions menopausal status. Age is never used to infer menopause."
            ]
    # Guard 2: never claim a formal sex comparison without a reported statistic.
    if obj.get("formal_sex_comparison") == "reported" and not obj.get("interaction_statistic"):
        return "quarantined", [
            "guard: formal_sex_comparison is 'reported' but no interaction_statistic was extracted. "
            "A sex comparison is never inferred without a reported test."
        ]
    # Guard 3: never infer 'no difference' from silence (schema enum + prompt already
    # forbid it; this makes the check explicit and testable).
    if obj.get("formal_sex_comparison") == "not_reported" and obj.get("evidence_state") == "complete":
        notes.append("note: no formal sex comparison reported; evidence_state should not imply equivalence.")

    notes.append("quote verified verbatim against the stored source.")
    return "quote_verified", notes


def extract_and_validate(passage: str, meta: dict) -> dict:
    obj = extract(passage, meta)
    state, notes = validate(obj)
    obj["validation_state"] = state
    obj["validation_notes"] = " ".join(notes) if notes else None
    return obj
