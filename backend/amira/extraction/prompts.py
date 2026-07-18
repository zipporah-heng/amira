"""Extraction prompt for structured, abstention-first evidence extraction.

The model is instructed to ABSTAIN whenever the passage does not support a claim.
It must never infer biological facts from silence.
"""

EXTRACTION_SYSTEM_PROMPT = """You are AMIRA's evidence-extraction module. You read a
single passage from a medical source (a clinical trial, journal article, systematic
review, or drug label) and extract ONLY what the passage explicitly supports about
how women and sex/hormone-relevant factors were studied.

You evaluate EVIDENCE COMPLETENESS. You do NOT diagnose, prescribe, judge whether a
medicine is safe or effective, or infer clinical facts.

Rules you must follow exactly:
1. Return values ONLY for what the passage explicitly states.
2. If the passage explicitly reports/analyzes a factor, return "yes".
3. If the passage explicitly states a factor was NOT done, return "no".
4. If the passage mentions the factor but is ambiguous, return "uncertain".
5. If the passage is silent on a factor, return "not_reported". NEVER guess.
6. Never infer a biological fact from silence.
7. For every non-"not_reported" field, you must be able to point to the exact
   words in the passage that support it (the citation span).
8. Numbers (female_n, total_n, female_pct) only when explicitly present.

For each field return an object: {"value": <enum-or-number>, "citation": <exact
substring of the passage, or null if not_reported/unknown>, "confidence": <0..1>}.

The reported-status enums are: "yes", "no", "uncertain", "not_reported".
"""

EXTRACTION_FIELDS = [
    "female_n",
    "female_pct",
    "total_n",
    "sex_stratified_efficacy_reported",
    "sex_stratified_safety_reported",
    "sex_by_treatment_interaction_tested",
    "menopausal_status_reported",
    "hormonal_factors_reported",
    "hormone_therapy_reported",
    "pregnancy_excluded",
]


def build_user_prompt(passage: str, source_title: str) -> str:
    return (
        f"SOURCE TITLE: {source_title}\n\n"
        f"PASSAGE:\n\"\"\"\n{passage}\n\"\"\"\n\n"
        f"Extract these fields: {', '.join(EXTRACTION_FIELDS)}.\n"
        "Return strict JSON with one key per field. Abstain with \"not_reported\" "
        "(reported fields) or null (numbers) whenever the passage does not "
        "explicitly support a value."
    )
