# Human verification worksheet

**23 evidence assertions + 3 sex-specific findings are source-verified by machine but have NO named human sign-off.**

To sign off: confirm the value against the linked source, then set `human_verified: true` and
`verifier: "<your name>"` in the relevant dataset file.

## Evidence assertions (dataset/evidence_assertions.json)

| # | ID | Trial | Dimension | Value | Basis | Verify at | Signed off |
|---|---|---|---|---|---|---|---|
| 1 | A-JUP-001 | JUPITER | female_enrollment_count | 6801 | reported | [PMID 20176986](https://pubmed.ncbi.nlm.nih.gov/20176986/) | [ ] |
| 2 | A-JUP-002 | JUPITER | total_enrollment | 17802 | reported | [NCT00239681](https://clinicaltrials.gov/study/NCT00239681) | [ ] |
| 3 | A-JUP-003 | JUPITER | female_enrollment_pct | 38.2 | derived | [PMID 20176986](https://pubmed.ncbi.nlm.nih.gov/20176986/) | [ ] |
| 4 | A-JUP-004 | JUPITER | sex_specific_efficacy_reported | yes | reported | [PMID 20176986](https://pubmed.ncbi.nlm.nih.gov/20176986/) | [ ] |
| 5 | A-JUP-005 | JUPITER | sex_specific_safety_reported | not_reported | not_reported | [PMID 20176986](https://pubmed.ncbi.nlm.nih.gov/20176986/) | [ ] |
| 6 | A-JUP-006 | JUPITER | menopause_status_reported | not_reported | not_reported | [PMID 20176986](https://pubmed.ncbi.nlm.nih.gov/20176986/) | [ ] |
| 7 | A-JUP-007 | JUPITER | hormone_therapy_reported | not_reported | not_reported | [NCT00239681](https://clinicaltrials.gov/study/NCT00239681) | [ ] |
| 8 | A-JUP-008 | JUPITER | pregnancy_evidence_reported | not_reported | not_reported | [NCT00239681](https://clinicaltrials.gov/study/NCT00239681) | [ ] |
| 9 | A-HOP-001 | HOPE-3 | total_enrollment | 12705 | reported | [PMID 27040132](https://pubmed.ncbi.nlm.nih.gov/27040132/) | [ ] |
| 10 | A-HOP-002 | HOPE-3 | female_enrollment_pct | 46.0 | reported | [PMID 33963372](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8370761/) | [ ] |
| 11 | A-HOP-003 | HOPE-3 | female_enrollment_count | None | not_reported | [NCT00468923](https://clinicaltrials.gov/study/NCT00468923) | [ ] |
| 12 | A-HOP-004 | HOPE-3 | sex_specific_efficacy_reported | not_reported | not_reported | [PMID 27040132](https://pubmed.ncbi.nlm.nih.gov/27040132/) | [ ] |
| 13 | A-HOP-005 | HOPE-3 | sex_specific_safety_reported | not_reported | not_reported | [PMID 27040132](https://pubmed.ncbi.nlm.nih.gov/27040132/) | [ ] |
| 14 | A-HOP-006 | HOPE-3 | menopause_status_reported | not_reported | not_reported | [PMID 33963372](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8370761/) | [ ] |
| 15 | A-HOP-007 | HOPE-3 | hormone_therapy_reported | not_reported | not_reported | [NCT00468923](https://clinicaltrials.gov/study/NCT00468923) | [ ] |
| 16 | A-HOP-008 | HOPE-3 | pregnancy_evidence_reported | not_reported | not_reported | [NCT00468923](https://clinicaltrials.gov/study/NCT00468923) | [ ] |
| 17 | A-CAR-001 | CARDS | total_enrollment | 2800 | reported | [PMID 15325833](https://pubmed.ncbi.nlm.nih.gov/15325833/) | [ ] |
| 18 | A-CAR-002 | CARDS | female_enrollment_count | None | not_located | [PMID 15325833](https://pubmed.ncbi.nlm.nih.gov/15325833/) | [ ] |
| 19 | A-CAR-003 | CARDS | sex_specific_efficacy_reported | not_located | not_located | [PMID 15325833](https://pubmed.ncbi.nlm.nih.gov/15325833/) | [ ] |
| 20 | A-CAR-004 | CARDS | sex_specific_safety_reported | not_located | not_located | [PMID 15325833](https://pubmed.ncbi.nlm.nih.gov/15325833/) | [ ] |
| 21 | A-CAR-005 | CARDS | menopause_status_reported | not_reported | not_reported | [NCT00327418](https://clinicaltrials.gov/study/NCT00327418) | [ ] |
| 22 | A-CAR-006 | CARDS | hormone_therapy_reported | not_reported | not_reported | [NCT00327418](https://clinicaltrials.gov/study/NCT00327418) | [ ] |
| 23 | A-CAR-007 | CARDS | pregnancy_evidence_reported | not_reported | not_reported | [NCT00327418](https://clinicaltrials.gov/study/NCT00327418) | [ ] |

## Sex-specific findings (dataset/findings.json)

| # | ID | Medicine | Type | Endpoint | Women | Men | Test p | Significance | Verify at | Signed off |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | F-EFF-JUP-001 | Rosuvastatin | efficacy | First major cardiovascular event | HR 0.54 | HR 0.58 | not reported | no_significant_difference | [PMID 20176986](https://pubmed.ncbi.nlm.nih.gov/20176986/) | [ ] |
| 2 | F-EFF-CLASS-001 | Rosuvastatin | efficacy | Major vascular events per 1.0 mmol/L LDL | RR 0.84 | RR 0.78 | 0.33 | no_significant_difference | [PMID 25579834](https://pubmed.ncbi.nlm.nih.gov/25579834/) | [ ] |
| 3 | F-SAF-CLASS-001 | Rosuvastatin | safety | Cancer incidence and non-cardiovascular  | - | - | not reported | no_significant_difference | [PMID 25579834](https://pubmed.ncbi.nlm.nih.gov/25579834/) | [ ] |
