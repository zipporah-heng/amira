# Inclusion / exclusion protocol

**Scope lock (v1.0.0).** Medicine: **rosuvastatin**. Corpus: **JUPITER (NCT00239681)**
and **HOPE-3 (NCT00468923)**. Source cutoff: **2026-07-18**.

## Inclusion criteria

A trial is included when all hold:

1. The intervention under evaluation is rosuvastatin.
2. The trial is registered with a resolvable NCT identifier.
3. The trial is named in the approved frozen corpus.

A source document is included when all hold:

1. It reports on an included trial.
2. It is retrievable from ClinicalTrials.gov, PubMed, or PubMed Central.
3. It contributes at least one evidence assertion about women's representation or
   sex/hormone-relevant analysis.

## Exclusion criteria

- Interventions other than rosuvastatin (including other arms of a factorial trial).
- Substudies whose population is a subset of an already-included trial, where
  including them would double-count participants.
- Sources published after the cutoff.
- Any source that cannot be retrieved and quoted verbatim.

## Applied decisions

Every screening decision, with its reason, is recorded in
[`dataset/screening_log.json`](../dataset/screening_log.json) and served at
`GET /api/screening-log`. Notable exclusions:

| Candidate | Decision | Reason |
|---|---|---|
| PMID 27041480 | exclude | HOPE-3 blood-pressure arm; intervention is not rosuvastatin |
| PMID 27039945 | exclude | HOPE-3 combined BP + lipid arm; not the isolated rosuvastatin comparison |
| PMID 30814321 | exclude | HOPE-3 cognition substudy; subset population would double-count participants |
| Atorvastatin / pravastatin trials | exclude | Outside the frozen corpus scope lock |

## Double-count prevention

Participants are counted once per trial, from the trial-level record. Substudies and
secondary analyses of an included trial contribute *assertions* (e.g. that a
sex-specific analysis exists) but never additional participants. This is enforced by
`test_participant_double_count_prevention`.
