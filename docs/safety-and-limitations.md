# Safety and limitations

## What AMIRA is

A tool that measures **evidence completeness** for women's health: whether women were
represented in research, and whether sex-specific and hormone-relevant factors were
analyzed and reported. Every claim links back to a source. When AMIRA cannot find the
evidence, it says so.

## What AMIRA is not

AMIRA does **not**:

- diagnose;
- prescribe or recommend treatment;
- tell a woman whether a medicine is safe for her;
- tell a woman whether she should take or avoid a medicine;
- rank medicines as better, safer, or more effective;
- produce a 0–100 clinical score.

## The two critical states (never share a code path or message)

| State | Meaning | UI message |
|---|---|---|
| `NO_EVIDENCE_FOUND` | A search ran; nothing relevant in the reviewed set | "We found no relevant evidence in the sources reviewed. This is an evidence gap, not a finding about whether the medicine works." |
| `EVIDENCE_OF_NO_EFFECT` | A study explicitly tested an outcome and reported a null/negative result | "A study tested this outcome and reported no benefit or effect." |

These are separate enum states, take separate branches in
`classification.build_report`, render separate banners, and are locked by tests
(`test_two_safety_states_never_equal`, `test_no_evidence_state_distinct_from_no_effect`).

## Mandatory language

Wherever missing evidence is shown:

> "Not reported in the sources reviewed does not mean the medicine does not work or is
> unsafe. AMIRA measures evidence coverage, not clinical performance."

## Limitations

- **Bounded to the reviewed source set.** "Missing" always means "not in the sources
  AMIRA reviewed," never "does not exist."
- **Pilot benchmark.** 30 human-labeled examples; does not prove broad generalization.
- **Demo scope.** Cardiovascular disease, perimenopause/postmenopause, a small set of
  human-verified hero fixtures. The architecture supports adding medicines by dropping in
  a new validated fixture.
- **Extraction is abstention-first but not infallible.** Affirmative claims must carry a
  verifiable in-passage citation or they are downgraded to abstention; this favors
  under-claiming over over-claiming.

## Fail-closed posture

Malformed extraction output, uncited affirmative claims, and out-of-range values are
rejected or downgraded, not silently accepted. The system prefers to abstain and say "not
reported" over guessing.
