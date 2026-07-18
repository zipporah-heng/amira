# Data sources

AMIRA's evidence universe, in priority order.

| Source | Use | Access |
|---|---|---|
| **ClinicalTrials.gov API v2** | Trial records: enrollment, sex eligibility, design | Public, no key. `backend/amira/ingestion/clinicaltrials.py` |
| **PubMed / PMC** | Journal articles, meta-analyses (e.g. CTT 2015) | Public; cited as source pointers |
| **DailyMed** | FDA drug labels (pregnancy, specific populations) | Public |
| **openFDA drug labels** | Structured label fields | Public API |
| openFDA FAERS *(optional)* | Post-market adverse-event signal | Public API |

Out of scope for the critical build path: NHANES, mcPHASES.

## What is stored in this repo

Citations, metadata, source pointers (URLs, NCT IDs, PMIDs), and short necessary
excerpts only. **No copyrighted full-text documents.** The hero and demo fixtures in
`fixtures/` reference real public sources (CTT 2015 meta-analysis, CARDS 2004, WHI 2002,
REDUCE-IT, DailyMed) with links, human-verified during build.

## Live vs demo

Every value carries a provenance label:

- **LIVE_SOURCE** — fetched live from an API at request time.
- **VERIFIED_DEMO_DATA** — seeded, human-verified fixture. Never presented as live.
- **AI_EXTRACTED** — produced by the extraction model, schema + citation validated.
- **HUMAN_VERIFIED** — reviewed by a human against the cited source.

The hero fixture is `VERIFIED_DEMO_DATA` + `HUMAN_VERIFIED`. Live AI output cannot
replace a hero fixture unless it passes schema validation, citation validation, a
confidence threshold, and human verification.
