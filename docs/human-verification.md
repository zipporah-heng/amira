# Human verification status

AMIRA's frozen v3 corpus contains 58 assertions, 10 findings, and one direct comparison. No record has independent named human sign-off: `human_verified` is `false` throughout.

## Source-verification scope

- The 26 positive `reported` or `derived` assertions used in trusted public outputs are `source_verified`.
- All 10 findings and the direct comparison are `source_verified`.
- The other 32 assertions preserve explicit `not_reported` or `not_located` evidence states. They are gap or silence observations, not positive verified findings.

Source verification is a machine-enforced provenance check; it is not a substitute for independent scientific review.

## Reproducible review queues

The canonical review records are:

- [`evidence_assertions.json`](../dataset/evidence_assertions.json)
- [`findings.json`](../dataset/findings.json)
- [`direct_comparisons.json`](../dataset/direct_comparisons.json)
- [`source_documents.json`](../dataset/source_documents.json)

Run `python pipeline/validate.py` to reproduce the structural, provenance, and evidence-boundary checks. A future human reviewer should record their identity, date, source examined, and decision before changing any `human_verified` value.

The benchmark remains provisional. Human review and benchmark evaluation are pending; AMIRA makes no accuracy or gold-standard claim.
