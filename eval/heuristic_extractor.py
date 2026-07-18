"""Deterministic heuristic baseline extractor for offline evaluation.

This is a transparent rule-based baseline so the evaluation runner produces a
real, reproducible score with no API key. It is intentionally simple — the
benchmark exists to measure extraction quality, and a perfect score would mean
the benchmark is not discriminating. When OPENAI_API_KEY is set, run_eval can
instead call the live extractor for comparison.

It emits the same {value, citation, confidence} shape as the OpenAI backend, so
its output flows through the identical validation + citation path in
amira.extraction.extractor.
"""

from __future__ import annotations

import re
from typing import Optional

WOMAN = r"(women|female|woman)"
MEN = r"(men|male)"


def _find(pattern: str, text: str) -> Optional[str]:
    m = re.search(pattern, text, flags=re.IGNORECASE)
    return m.group(0) if m else None


def _sentence_with(term: str, text: str) -> Optional[str]:
    for sent in re.split(r"(?<=[.])\s+", text):
        if re.search(term, sent, flags=re.IGNORECASE):
            return sent.strip()
    return None


def _reported(text: str, *, need_terms, explicit_no_terms=None) -> tuple:
    """Return (value, citation) for a reported-status field via keyword rules."""

    if explicit_no_terms:
        for t in explicit_no_terms:
            if re.search(t, text, flags=re.IGNORECASE):
                return "no", _sentence_with(t, text)
    for t in need_terms:
        if re.search(t, text, flags=re.IGNORECASE):
            return "yes", _sentence_with(t, text)
    return "not_reported", None


def extract(passage: str) -> dict:
    text = passage
    out: dict = {}

    # Numerics
    n_women = re.search(r"(\d[\d,]*)\s*(?:\(\d+%\)\s*)?(?:of them\s+|were\s+)?wom(?:e|a)n", text, re.I)
    pct = re.search(r"(\d+(?:\.\d+)?)%\s*(?:were\s+|of them\s+)?(?:women|female)", text, re.I)
    total = re.search(r"(\d[\d,]*)\s*(?:participants|patients|adults|randomized|-participant)", text, re.I)

    def _num(m):
        return int(m.group(1).replace(",", "")) if m else None

    female_n = _num(n_women)
    total_n = _num(total)
    female_pct = float(pct.group(1)) if pct else None

    out["female_n"] = {"value": female_n,
                       "citation": n_women.group(0) if n_women else None,
                       "confidence": 0.7 if female_n is not None else 0.0}
    out["female_pct"] = {"value": female_pct,
                         "citation": pct.group(0) if pct else None,
                         "confidence": 0.7 if female_pct is not None else 0.0}
    out["total_n"] = {"value": total_n,
                      "citation": total.group(0) if total else None,
                      "confidence": 0.7 if total_n is not None else 0.0}

    # Reported-status fields
    eff_v, eff_c = _reported(
        text,
        need_terms=[r"efficacy.*by sex", r"by sex", r"separately.*(women|sex)",
                    r"sex[- ]specific efficac", r"prespecified sex", r"sex subgroup",
                    r"reported.*by sex"],
        explicit_no_terms=[r"not analyz\w* separately by sex",
                           r"no sex-?based subgroup", r"no sex-?specific analys",
                           r"did not report.*by sex", r"fewer than half.*by sex"],
    )
    out["sex_stratified_efficacy_reported"] = {"value": eff_v, "citation": eff_c,
                                               "confidence": 0.6 if eff_v != "not_reported" else 0.0}

    saf_v, saf_c = _reported(
        text,
        need_terms=[r"safety.*by sex", r"sex-?specific safety", r"safety.*separately",
                    r"sex-?specific safety tables", r"safety events.*(women|sex)"],
        explicit_no_terms=[r"no sex-?based subgroup"],
    )
    if saf_v == "not_reported" and re.search(r"safety.*sparse|sparse.*safety", text, re.I):
        saf_v, saf_c = "uncertain", _sentence_with("sparse", text)
    out["sex_stratified_safety_reported"] = {"value": saf_v, "citation": saf_c,
                                             "confidence": 0.5 if saf_v != "not_reported" else 0.0}

    int_v, int_c = _reported(
        text,
        need_terms=[r"treatment-?by-?sex interaction", r"sex.*interaction",
                    r"interaction.*sex", r"heterogeneity by sex"],
        explicit_no_terms=[r"no sex-?based subgroup"],
    )
    out["sex_by_treatment_interaction_tested"] = {"value": int_v, "citation": int_c,
                                                  "confidence": 0.6 if int_v != "not_reported" else 0.0}

    meno_v, meno_c = _reported(
        text,
        need_terms=[r"menopaus\w* status", r"postmenopausal", r"menopausal status.*(record|confirm|document)"],
        explicit_no_terms=[r"menopausal status was rarely", r"menopause.*not.*document"],
    )
    out["menopausal_status_reported"] = {"value": meno_v, "citation": meno_c,
                                        "confidence": 0.6 if meno_v != "not_reported" else 0.0}

    horm_v, horm_c = _reported(
        text,
        need_terms=[r"estradiol", r"follicle-?stimulating hormone", r"endogenous hormone",
                    r"hormonal covariate", r"hormone levels"],
    )
    out["hormonal_factors_reported"] = {"value": horm_v, "citation": horm_c,
                                       "confidence": 0.6 if horm_v != "not_reported" else 0.0}

    ht_v, ht_c = _reported(
        text,
        need_terms=[r"hormone therapy.*(document|exclud|user|use)", r"menopausal hormone therapy",
                    r"hormone therapy was an exclusion", r"hormone therapy users were excluded"],
    )
    out["hormone_therapy_reported"] = {"value": ht_v, "citation": ht_c,
                                      "confidence": 0.6 if ht_v != "not_reported" else 0.0}

    preg_v, preg_c = _reported(
        text,
        need_terms=[r"contraindicated (in|during) pregnancy", r"not recommended during pregnancy",
                    r"pregnancy.*exclu", r"exclu.*pregnan"],
    )
    out["pregnancy_excluded"] = {"value": preg_v, "citation": preg_c,
                                "confidence": 0.6 if preg_v != "not_reported" else 0.0}

    return out
