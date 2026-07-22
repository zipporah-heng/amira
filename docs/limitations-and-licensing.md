# Limitations and licensing

## Limitations

1. **Small frozen corpus (v3.0.0).** Seven trials across five medicines — JUPITER and
   HOPE-3 (rosuvastatin), CARDS (atorvastatin), DAPA-HF (dapagliflozin), HAYOZ-2012
   (valsartan), and DIG + DECISION (digoxin) — drawn from 15 sources with 58 assertions,
   10 findings and 1 direct comparison. Nothing here supports a general claim about any
   medicine, and absence in this corpus never means absence in the wider literature.
2. **HOPE-3 publishes no exact female participant count.** Only a rounded 46% is
   available, so any combined female figure is `mixed_reported_and_derived`. AMIRA shows
   the reported subtotal (6,801) as the headline and labels the estimate separately.
3. **Hormonal and life-stage evidence is sparse and medicine-specific.** Menopausal
   status is not reported in the reviewed sources for the statin/SGLT2/glycoside trials,
   so those life-stage selections return a bounded response. One medicine (valsartan,
   HAYOZ-2012) reports hormone-therapy context, which is why its Evidence Maturity reaches
   4/5. Age eligibility is never converted into menopausal status.
4. **Atorvastatin ingestion is incomplete.** CARDS' female enrollment is `not_located`
   (paywalled full text), so atorvastatin is *not established / unscored*, is **not**
   listed as a verified medicine, and is not offered as a verified selector option. It is
   surfaced separately with an explicit "Incomplete evidence review" status.
5. **Human verification pending.** The 26 positive `reported`/`derived` assertions used
   in trusted public outputs, all 10 findings and the direct comparison require source
   verification. The other 32 assertions preserve explicit `not_reported` or
   `not_located` states and are not positive verified findings. **None** carries named
   human sign-off; `human_verified` is `false` throughout. See
   [Human verification status](human-verification.md).
6. **No model evaluation.** `EVALUATION PENDING` is displayed; no accuracy is claimed.
7. **Benchmark labels are rule-drafted**, pending human review.
8. **Point-in-time snapshot.** Source cutoff 2026-07-18. Registries change; ingestion
   fails loudly on drift rather than silently updating.

## Fail-closed evidence boundary (what is actually enforced)

Every public value, categorical state, finding, and derived conclusion is gated at
**request time** through one canonical projection (`dataset.evidence_projection` /
`assertion_validity`), not merely checked by an offline validator:

- A numeric or categorical value is shown only when its assertion is conflict-free,
  carries a supported basis, resolves to an authoritative `https` source, and — for a
  positive (`reported`/`derived`) claim — is `source_verified`. Otherwise the surface
  shows an explicit, never-collapsed state (`not_reported`, `not_located`, `absent`,
  `conflict`, `unverified`, or `invalid`) and withholds the value.
- The five distinct evidence states are never collapsed into one another; in
  particular `absent` and `not_located` are never rewritten as `not_reported`.
- Derived values are validated recursively against their declared dependencies; a
  dangling or unverified dependency withholds the derived value and never crashes a
  public endpoint.
- Findings and direct comparisons must be `source_verified` to influence any state,
  appear as context, or enter public downloads. The deployment validator
  (`pipeline/validate.py`) fails the build if the committed corpus contains an
  unverified public finding/comparison or an invalid source.
- Only medicines with completed, integrity-checked ingestion
  (`medicine_ingestion_complete`) are ranked or labelled verified.

This boundary is enforced across the API, the built UI, the CSV/JSONL exports, the
aggregates, maturity, the pilot readiness score, class comparison, evidence gaps, the
Research Map, and the Source Drawer.

## Licensing

| Asset | Terms |
|---|---|
| ClinicalTrials.gov records | U.S. Government public-domain data |
| PubMed abstracts | © respective publishers. AMIRA stores **short excerpts** with full citation for verification; no full texts are redistributed |
| PubMed Central open-access article (PMC8370761) | Open access under its publisher licence; short excerpts quoted with citation |
| AMIRA code (`backend/`, `pipeline/`, `ui/`) | See repository licence |
| AMIRA normalized dataset (`dataset/`) | Derived structure and annotations are AMIRA's; underlying source facts retain their original terms |

**Preserving source licensing.** Each `source_documents` record carries a
`license_note`. AMIRA never redistributes copyrighted full text — it stores citations,
identifiers, source URLs and the minimum excerpt needed to verify each assertion.

## Safety boundaries

AMIRA measures **evidence completeness**, not clinical performance. It does not
diagnose, prescribe, recommend treatment, tell anyone whether a medicine is safe for
them, or rank medicines. "Not reported in the sources reviewed" never means a medicine
does not work or is unsafe.
