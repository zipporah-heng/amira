"""Deterministic generator for the AMIRA clickable-mockup demo data.

Single source of truth. Produces:
  1. ui/src/data/amira_demo_evidence.json   (central fixture the UI reads)
  2. amira-open-evidence-v1-demo/            (downloadable sample package)
  3. ui/public/downloads/amira-open-evidence-v1-demo.zip
  4. ui/public/downloads/*                   (individual sample files)

ALL VALUES ARE DEMO DATA FOR A HACKATHON PROTOTYPE. NOT VALIDATED CLINICAL EVIDENCE.
Numbers are illustrative and deterministic; they are not real research findings.
"""

from __future__ import annotations

import csv
import io
import json
import random
import shutil
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
UI_DATA = REPO / "ui" / "src" / "data"
PUBLIC_DL = REPO / "ui" / "public" / "downloads"
PACKAGE_DIR = REPO / "amira-open-evidence-v1-demo"

DISCLAIMER = "DEMO DATA FOR HACKATHON PROTOTYPE. NOT VALIDATED CLINICAL EVIDENCE."

# ---- Exact aggregate targets from the mission spec ------------------------ #
N_STUDIES = 24
TARGET_FEMALE = 18452
TARGET_TOTAL = 45005            # 18452 / 45005 = 41.0% female overall
SEX_EFFICACY_YES = 6            # 6 / 24 reported sex-specific outcomes
SEX_SAFETY_YES = 5             # 5 / 24 reported sex-specific safety
MENOPAUSE_YES = 1             # 1 / 24 reported menopause status
HORMONE_THERAPY_YES = 0
PREGNANCY_YES = 0

STUDY_TYPES = (
    ["Randomized Controlled Trial"] * 12
    + ["Observational Study"] * 7
    + ["Post-hoc Analysis"] * 3
    + ["Other"] * 2
)

# Indices chosen deterministically so counts are exact and spread across types.
SEX_EFFICACY_IDX = [0, 1, 2, 12, 19, 22]     # 6
SEX_SAFETY_IDX = [0, 1, 2, 12, 19]          # 5 (subset of efficacy)
MENOPAUSE_IDX = [2]                          # 1 (also postmenopause)

DIMENSIONS = [
    "female_enrollment",
    "female_percentage",
    "sex_specific_efficacy_reported",
    "sex_specific_safety_reported",
    "sex_by_treatment_interaction",
    "menopause_reported",
    "perimenopause_reported",
    "postmenopause_reported",
    "hormone_therapy_reported",
    "pregnancy_reported",
]  # 10 hormonal/sex evidence dimensions


def build_studies() -> list[dict]:
    rng = random.Random(42)
    studies = []
    # First assign deterministic per-study totals/female for studies 0..22,
    # then force study 23 to make both sums land exactly on target.
    partial_total = 0
    partial_female = 0
    rows = []
    for i in range(N_STUDIES - 1):
        total_n = rng.randint(300, 3200)
        pct = rng.uniform(0.30, 0.52)
        female_n = int(round(total_n * pct))
        rows.append([total_n, female_n])
        partial_total += total_n
        partial_female += female_n

    last_total = TARGET_TOTAL - partial_total
    last_female = TARGET_FEMALE - partial_female
    # Keep the last study sane; nudge earlier studies if it went out of range.
    while last_total < 400 or last_female < 100 or last_female > last_total:
        # Shrink the largest earlier study a little and recompute.
        j = max(range(len(rows)), key=lambda k: rows[k][0])
        rows[j][0] -= 100
        rows[j][1] = int(round(rows[j][1] * 0.97))
        partial_total = sum(r[0] for r in rows)
        partial_female = sum(r[1] for r in rows)
        last_total = TARGET_TOTAL - partial_total
        last_female = TARGET_FEMALE - partial_female
    rows.append([last_total, last_female])

    for i, (total_n, female_n) in enumerate(rows):
        female_pct = round(female_n / total_n * 100, 1)
        sex_eff = i in SEX_EFFICACY_IDX
        sex_saf = i in SEX_SAFETY_IDX
        meno = i in MENOPAUSE_IDX
        study_type = STUDY_TYPES[i]
        sid = f"AMIRA-DEMO-{i + 1:03d}"

        if meno:
            passage = (
                f"[DEMO] Sample study {sid} enrolled {female_n:,} women "
                f"({female_pct}% of {total_n:,} participants). A postmenopausal "
                "subgroup was described and outcomes were reported separately for "
                "women. Illustrative mock text — not a real research finding."
            )
        elif sex_eff:
            passage = (
                f"[DEMO] Sample study {sid} reported cardiovascular outcomes "
                f"separately for women (n={female_n:,}, {female_pct}% of "
                f"{total_n:,}). Illustrative mock text — not a real research finding."
            )
        else:
            passage = (
                f"[DEMO] Sample study {sid} enrolled {female_n:,} women "
                f"({female_pct}% of {total_n:,} participants); results were not "
                "reported separately by sex. Illustrative mock text — not a real "
                "research finding."
            )

        studies.append(
            {
                "study_id": sid,
                "title": f"Atorvastatin cardiovascular evidence — sample study {i + 1} (DEMO)",
                "medicine": "Atorvastatin",
                "condition": "Heart Disease",
                "study_type": study_type,
                "year": 2005 + (i % 18),
                "total_n": total_n,
                "female_n": female_n,
                "female_pct": female_pct,
                "sex_specific_efficacy_reported": "yes" if sex_eff else "no",
                "sex_specific_safety_reported": "yes" if sex_saf else "no",
                "sex_by_treatment_interaction": "yes" if sex_eff else "no",
                "menopause_reported": "yes" if meno else "no",
                "perimenopause_reported": "no",
                "postmenopause_reported": "yes" if meno else "no",
                "hormone_therapy_reported": "no",
                "pregnancy_reported": "no",
                "relevant_evidence_passage": passage,
                "source": "DEMO DATA",
                "source_url": f"https://example.org/amira-demo/{sid}",
                "ai_confidence": round(0.6 + rng.uniform(0, 0.3), 2),
                "human_verified": False,
                "evidence_status": "DEMO DATA",
            }
        )
    return studies


def build_benchmark() -> dict:
    rng = random.Random(7)
    examples = []
    splits = ["development"] * 18 + ["validation"] * 6 + ["test"] * 6
    for i in range(30):
        split = splits[i]
        has_sex = i % 4 == 0
        has_meno = i % 9 == 0
        female_present = i % 3 != 0
        female_n = rng.randint(80, 4200) if female_present else None
        female_pct = round(rng.uniform(20, 55), 1) if female_present else None
        passage = (
            f"[DEMO] Benchmark passage {i + 1}: sample text describing a study "
            + (f"with {female_n} female participants " if female_present else "with no reported female count ")
            + ("and sex-specific outcomes reported. " if has_sex else "without sex-specific reporting. ")
            + "Illustrative mock text — not a real research finding."
        )
        examples.append(
            {
                "benchmark_id": f"AMIRA-BENCH-{i + 1:02d}",
                "split": split,
                "passage": passage,
                "female_enrollment_present": "yes" if female_present else "no",
                "female_n": female_n,
                "female_pct": female_pct,
                "sex_specific_efficacy": "yes" if has_sex else "not_reported",
                "sex_specific_safety": "yes" if (has_sex and i % 8 == 0) else "not_reported",
                "menopause_reported": "yes" if has_meno else "not_reported",
                "hormone_therapy_reported": "not_reported",
                "citation_support": "yes" if has_sex else "n/a",
                "expected_abstention": not has_sex,
                "human_label": "DEMO — illustrative label, not verified",
                "notes": "DEMO DATA",
            }
        )
    return {
        "total": 30,
        "development": 18,
        "validation": 6,
        "held_out": 6,
        "fields_evaluated": [
            "Female enrollment extraction",
            "Sex-specific efficacy detection",
            "Sex-specific safety detection",
            "Menopause detection",
            "Hormone therapy detection",
            "Citation support",
            "Abstention",
        ],
        "evaluation": {
            "field_level_accuracy": "PENDING",
            "macro_f1": "PENDING",
            "citation_support_accuracy": "NOT YET EVALUATED",
            "abstention_accuracy": "NOT YET EVALUATED",
        },
        "examples": examples,
    }


def schema_json() -> dict:
    return {
        "schema_version": "1.0-demo",
        "title": "AMIRA Open Women's Hormonal Evidence — study record",
        "disclaimer": DISCLAIMER,
        "fields": {
            "study_id": "string — stable identifier",
            "medicine": "string",
            "condition": "string",
            "study_type": "enum — RCT | Observational | Post-hoc Analysis | Other",
            "year": "integer",
            "total_n": "integer >= 0",
            "female_n": "integer >= 0 (<= total_n)",
            "female_pct": "number 0-100",
            "sex_specific_efficacy_reported": "enum yes|no|uncertain|not_reported",
            "sex_specific_safety_reported": "enum yes|no|uncertain|not_reported",
            "sex_by_treatment_interaction": "enum yes|no|uncertain|not_reported",
            "menopause_reported": "enum yes|no|uncertain|not_reported",
            "perimenopause_reported": "enum yes|no|uncertain|not_reported",
            "postmenopause_reported": "enum yes|no|uncertain|not_reported",
            "hormone_therapy_reported": "enum yes|no|uncertain|not_reported",
            "pregnancy_reported": "enum yes|no|uncertain|not_reported",
            "relevant_evidence_passage": "string — supporting text span",
            "source": "string",
            "source_url": "string (uri)",
            "ai_confidence": "number 0-1",
            "human_verified": "boolean",
        },
    }


def build_fixture(studies, benchmark) -> dict:
    return {
        "meta": {
            "medicine": "Atorvastatin",
            "drug_class": "Statin (HMG-CoA reductase inhibitor)",
            "condition": "Heart Disease",
            "life_stage_demo": "Postmenopause",
            "hormone_therapy_demo": "Any",
            "evidence_level": 2,
            "evidence_level_label": "Women Analyzed",
            "data_label": "DEMO DATA",
            "disclaimer": DISCLAIMER,
        },
        "evidence_maturity_model": [
            {"level": 1, "name": "Women Counted", "description": "Studies report how many women were enrolled."},
            {"level": 2, "name": "Women Analyzed", "description": "Some studies report outcomes separately for women."},
            {"level": 3, "name": "Life Stage Aware", "description": "Studies report menopausal status or life stage."},
            {"level": 4, "name": "Hormone Aware", "description": "Studies report hormone therapy and hormonal context."},
            {"level": 5, "name": "Precision Women's Evidence", "description": "Rich, hormone-aware women's evidence across studies. Evidence-maturity only — not a treatment recommendation."},
        ],
        "hormonal_evidence_dimensions": DIMENSIONS,
        "dataset_summary": {
            "structured_studies": len(studies),
            "evidence_passages": 120,
            "human_labeled_benchmark_examples": benchmark["total"],
            "extraction_accuracy": "Pending evaluation",
            "hormonal_evidence_dimensions": len(DIMENSIONS),
            "license": "To be determined",
        },
        "studies": studies,
        "benchmark": benchmark,
        "research_map": {
            "columns": ["Women", "Sex Outcomes", "Menopause", "Hormone Therapy", "Pregnancy"],
            "rows": [
                {"medicine": "Atorvastatin", "cells": ["present", "present", "unclear", "missing", "missing"]},
                {"medicine": "Rosuvastatin", "cells": ["present", "unclear", "missing", "missing", "missing"]},
                {"medicine": "Pravastatin", "cells": ["present", "missing", "missing", "missing", "missing"]},
            ],
            "highest_gaps": ["Menopause", "Hormone Therapy", "Sex-specific Outcomes"],
        },
    }


# --------------------------------------------------------------------------- #
# Package writers
# --------------------------------------------------------------------------- #
def studies_to_csv(studies) -> str:
    buf = io.StringIO()
    fields = list(studies[0].keys())
    w = csv.DictWriter(buf, fieldnames=fields)
    w.writeheader()
    for s in studies:
        w.writerow(s)
    return buf.getvalue()


def to_jsonl(rows) -> str:
    return "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n"


def write_package(fixture):
    studies = fixture["studies"]
    bench = fixture["benchmark"]
    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    (PACKAGE_DIR / "dataset").mkdir(parents=True)
    (PACKAGE_DIR / "benchmark").mkdir(parents=True)
    (PACKAGE_DIR / "schema").mkdir(parents=True)
    (PACKAGE_DIR / "docs").mkdir(parents=True)

    (PACKAGE_DIR / "dataset" / "amira_evidence_dataset.csv").write_text(
        studies_to_csv(studies), encoding="utf-8"
    )
    (PACKAGE_DIR / "dataset" / "amira_evidence_dataset.jsonl").write_text(
        to_jsonl(studies), encoding="utf-8"
    )

    ex = bench["examples"]
    (PACKAGE_DIR / "benchmark" / "train.jsonl").write_text(
        to_jsonl([e for e in ex if e["split"] == "development"]), encoding="utf-8"
    )
    (PACKAGE_DIR / "benchmark" / "validation.jsonl").write_text(
        to_jsonl([e for e in ex if e["split"] == "validation"]), encoding="utf-8"
    )
    (PACKAGE_DIR / "benchmark" / "test.jsonl").write_text(
        to_jsonl([e for e in ex if e["split"] == "test"]), encoding="utf-8"
    )

    (PACKAGE_DIR / "schema" / "amira_evidence_schema.json").write_text(
        json.dumps(schema_json(), indent=2), encoding="utf-8"
    )

    docs = {
        "README.md": README_MD,
        "docs/data_dictionary.md": DATA_DICTIONARY_MD,
        "docs/dataset_card.md": DATASET_CARD_MD,
        "docs/labeling_guide.md": LABELING_GUIDE_MD,
        "docs/methodology.md": METHODOLOGY_MD,
        "docs/limitations.md": LIMITATIONS_MD,
    }
    for rel, content in docs.items():
        (PACKAGE_DIR / rel).write_text(content, encoding="utf-8")


def write_public_downloads(fixture):
    PUBLIC_DL.mkdir(parents=True, exist_ok=True)
    studies = fixture["studies"]
    bench = fixture["benchmark"]
    (PUBLIC_DL / "amira_evidence_dataset.csv").write_text(studies_to_csv(studies), encoding="utf-8")
    (PUBLIC_DL / "amira_evidence_dataset.jsonl").write_text(to_jsonl(studies), encoding="utf-8")
    (PUBLIC_DL / "amira_benchmark.jsonl").write_text(to_jsonl(bench["examples"]), encoding="utf-8")
    (PUBLIC_DL / "amira_evidence_schema.json").write_text(json.dumps(schema_json(), indent=2), encoding="utf-8")

    # Zip the full package.
    zip_path = PUBLIC_DL / "amira-open-evidence-v1-demo.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in PACKAGE_DIR.rglob("*"):
            if p.is_file():
                zf.write(p, p.relative_to(PACKAGE_DIR.parent))


README_MD = f"""# AMIRA Open Women's Hormonal Evidence Dataset and Benchmark (v1 demo)

**{DISCLAIMER}**

This package standardizes study-level evidence about how clinical research represents
women's biological and hormonal contexts into a common, machine-readable schema.

## Contents
- `dataset/amira_evidence_dataset.csv` / `.jsonl` — {N_STUDIES} structured sample studies
- `benchmark/train.jsonl` (18), `validation.jsonl` (6), `test.jsonl` (6) — human-labeled sample benchmark
- `schema/amira_evidence_schema.json` — the evidence schema
- `docs/` — data dictionary, dataset card, labeling guide, methodology, limitations

## Status
All values are deterministic DEMO data for a hackathon prototype. They are not real
research findings and have not been human-verified. Extraction accuracy is *pending
evaluation*. License: *to be determined*.
"""

DATA_DICTIONARY_MD = f"""# Data dictionary

**{DISCLAIMER}**

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
"""

DATASET_CARD_MD = f"""# Dataset card — AMIRA Open Women's Hormonal Evidence (v1 demo)

**{DISCLAIMER}**

- **Purpose:** make women's hormonal evidence coverage in clinical research
  standardized, machine-readable, and measurable.
- **Scope (demo):** {N_STUDIES} sample studies for one medicine (atorvastatin) and one
  condition (heart disease).
- **Structure:** study-level records across 10 hormonal/sex evidence dimensions.
- **Intended use:** research infrastructure and AI evaluation; NOT clinical decision-making.
- **Not intended for:** diagnosis, prescribing, treatment recommendations, or ranking
  medicines by clinical effectiveness.
- **Provenance:** deterministic demo data. Real evidence will replace it after human
  verification.
- **Ethics:** absence of evidence in the reviewed sample never implies a medicine does
  not work.
"""

LABELING_GUIDE_MD = f"""# Labeling guide

**{DISCLAIMER}**

Each reported-status field is labeled from the study text alone:
- **yes** — the source explicitly reports/analyzes the factor.
- **no** — the source explicitly states the factor was not done.
- **uncertain** — the source mentions the factor but is ambiguous.
- **not_reported** — the source is silent (the correct answer for abstention).

Numbers (female_n, female_pct, total_n) are labeled only when explicitly present.
Never infer a biological fact from silence.
"""

METHODOLOGY_MD = f"""# Methodology

**{DISCLAIMER}**

1. Collect research sources.
2. AI extracts structured evidence into the schema.
3. Schema validation (fail closed).
4. A human-labeled benchmark measures AI accuracy.
5. AMIRA displays evidence and what is missing, bounded to the sources reviewed.
6. Researchers download the open dataset and benchmark.

**Evidence maturity model (1-5):** Women Counted -> Women Analyzed -> Life Stage Aware
-> Hormone Aware -> Precision Women's Evidence. This measures evidence maturity only; it
is not a treatment recommendation.

**No evidence found** (a search returned nothing relevant in the reviewed set) is
distinct from **evidence of no effect** (a study tested an outcome and reported a null or
negative result).
"""

LIMITATIONS_MD = f"""# Limitations

**{DISCLAIMER}**

- Demo data only; deterministic and illustrative, not real findings.
- Coverage is bounded to the reviewed sample; "missing" means "not in the reviewed
  studies," never "does not exist."
- Extraction accuracy is pending evaluation; no scores are claimed.
- Not clinical guidance. AMIRA measures evidence coverage, not clinical performance.
"""


def main():
    studies = build_studies()
    benchmark = build_benchmark()
    fixture = build_fixture(studies, benchmark)

    # Integrity checks — fail loudly if the aggregates drift.
    assert len(studies) == N_STUDIES
    assert sum(s["female_n"] for s in studies) == TARGET_FEMALE, sum(s["female_n"] for s in studies)
    assert sum(s["total_n"] for s in studies) == TARGET_TOTAL, sum(s["total_n"] for s in studies)
    assert sum(s["sex_specific_efficacy_reported"] == "yes" for s in studies) == SEX_EFFICACY_YES
    assert sum(s["sex_specific_safety_reported"] == "yes" for s in studies) == SEX_SAFETY_YES
    assert sum(s["menopause_reported"] == "yes" for s in studies) == MENOPAUSE_YES
    assert sum(s["hormone_therapy_reported"] == "yes" for s in studies) == HORMONE_THERAPY_YES
    assert sum(s["pregnancy_reported"] == "yes" for s in studies) == PREGNANCY_YES
    overall_pct = round(TARGET_FEMALE / TARGET_TOTAL * 100)
    assert overall_pct == 41, overall_pct

    UI_DATA.mkdir(parents=True, exist_ok=True)
    (UI_DATA / "amira_demo_evidence.json").write_text(
        json.dumps(fixture, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    write_package(fixture)
    write_public_downloads(fixture)

    print("OK")
    print(f"  studies: {len(studies)}")
    print(f"  female total: {sum(s['female_n'] for s in studies):,}")
    print(f"  participants total: {sum(s['total_n'] for s in studies):,} ({overall_pct}% female)")
    print(f"  sex-specific outcomes: {SEX_EFFICACY_YES}/{N_STUDIES}")
    print(f"  study types: " + ", ".join(f"{STUDY_TYPES.count(t)} {t}" for t in dict.fromkeys(STUDY_TYPES)))
    print(f"  fixture -> {UI_DATA / 'amira_demo_evidence.json'}")
    print(f"  package -> {PACKAGE_DIR}")


if __name__ == "__main__":
    main()
