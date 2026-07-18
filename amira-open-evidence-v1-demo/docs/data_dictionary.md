# Data dictionary

**DEMO DATA FOR HACKATHON PROTOTYPE. NOT VALIDATED CLINICAL EVIDENCE.**

| Field | Type | Notes |
|---|---|---|
| study_id | string | stable identifier |
| medicine | string | |
| condition | string | |
| study_type | enum | RCT / Observational / Post-hoc Analysis / Other |
| year | integer | |
| total_n | integer | >= 0 |
| female_n | integer | >= 0 and <= total_n |
| female_pct | number | 0-100 |
| sex_specific_efficacy_reported | enum | yes / no / uncertain / not_reported |
| sex_specific_safety_reported | enum | yes / no / uncertain / not_reported |
| sex_by_treatment_interaction | enum | yes / no / uncertain / not_reported |
| menopause_reported | enum | yes / no / uncertain / not_reported |
| perimenopause_reported | enum | yes / no / uncertain / not_reported |
| postmenopause_reported | enum | yes / no / uncertain / not_reported |
| hormone_therapy_reported | enum | yes / no / uncertain / not_reported |
| pregnancy_reported | enum | yes / no / uncertain / not_reported |
| relevant_evidence_passage | string | supporting text span |
| source | string | |
| source_url | string (uri) | |
| ai_confidence | number | 0-1 |
| human_verified | boolean | false for all demo rows |
