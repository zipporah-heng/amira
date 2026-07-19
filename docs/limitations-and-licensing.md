# Limitations and licensing

## Limitations

1. **Two-trial frozen corpus.** JUPITER and HOPE-3 only. Nothing here supports a claim
   about rosuvastatin evidence in general, and absence in this corpus never means
   absence in the wider literature.
2. **HOPE-3 publishes no exact female participant count.** Only a rounded 46% is
   available, so any combined female figure is `mixed_reported_and_derived`. AMIRA shows
   the reported subtotal (6,801) as the headline and labels the estimate separately.
3. **No menopausal or hormonal data exists in this corpus.** No life stage can be
   evidenced, and every life-stage or hormone-therapy selection returns a bounded
   response. Age eligibility is never converted into menopausal status.
4. **Human verification pending.** All 16 assertions are source-verified by machine
   against the retrieved primary source; **none** carries named human sign-off.
   `human_verified` is `false` throughout. See `VERIFICATION_WORKSHEET.md`.
5. **No model evaluation.** `EVALUATION PENDING` is displayed; no accuracy is claimed.
6. **Benchmark labels are rule-drafted**, pending human review.
7. **Point-in-time snapshot.** Source cutoff 2026-07-18. Registries change; ingestion
   fails loudly on drift rather than silently updating.

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
