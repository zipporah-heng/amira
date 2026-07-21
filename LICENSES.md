# AMIRA licensing

AMIRA is released under two complementary licenses, plus an explicit third-party
material notice. Read this file together with the top-level [`LICENSE`](LICENSE).

## 1. Source code — Apache License 2.0

All **source code** in this repository (the FastAPI backend, the React/TypeScript
frontend, the data and evaluation pipelines, and configuration) is licensed under the
**Apache License, Version 2.0**. The full text is in [`LICENSE`](LICENSE).

## 2. Original scientific work — CC BY 4.0

AMIRA's **original scientific artifacts** are licensed under
**Creative Commons Attribution 4.0 International (CC BY 4.0)**
(https://creativecommons.org/licenses/by/4.0/). This covers:

- the Women's Evidence Schema (`schema/womens_evidence_schema_v0.2.json`);
- AMIRA's documentation (`docs/`, `README.md`, methodology, model card, data card);
- AMIRA's **original annotations** — the structure, states, `draft_label` values,
  and organization AMIRA adds on top of source material.

If you reuse these, please attribute "AMIRA — Evidence Intelligence Platform."

## 3. Third-party material — NOT relicensed by AMIRA

AMIRA quotes and links to third-party material to make its evidence traceable. This
material is **not owned by AMIRA and is not relicensed**; it remains subject to its
original rights and terms. It includes:

- **reproduced publication passages, abstracts, and article text** quoted from
  journals (e.g. NEJM, JAMA Cardiology, Lancet, Circulation, European Heart Journal,
  Nature Medicine) — copyright of the respective publishers, quoted as short excerpts
  for citation and identification only;
- **ClinicalTrials.gov registry records** — U.S. Government public-domain data;
- **NHANES data and documentation** — U.S. CDC/NCHS public-use material, subject to
  CDC's data-use terms.

AMIRA claims **no ownership of any source publication text**. Verbatim passages are
stored as short, source-linked excerpts strictly to support verification. Anyone
reusing AMIRA's dataset must observe the original publishers' rights for any quoted
third-party text.

## Summary

| Layer | License |
| --- | --- |
| Source code | Apache-2.0 |
| Original schema, docs, annotations | CC BY 4.0 |
| Quoted publication passages / abstracts | Publisher copyright (not relicensed) |
| ClinicalTrials.gov records | U.S. Government public domain |
| NHANES data & docs | U.S. CDC/NCHS public-use terms |
