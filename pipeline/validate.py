"""Offline validation of the committed AMIRA dataset.

Runs with NO network access. Verifies the committed corpus is internally consistent,
fully source-linked, free of synthetic markers, and that every displayed number is
reproducible from the normalized records.

Run:  python pipeline/validate.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "dataset"
BENCH = REPO / "benchmark"

ALLOWED_HOSTS = (
    "clinicaltrials.gov",
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "nejm.org",
    "nature.com",
)
VALID_BASES = {"reported", "derived", "not_reported", "not_located"}
SYNTHETIC_MARKERS = ("example.org", "DEMO DATA", "amira_demo_evidence", "AMIRA-DEMO-")

errors: list[str] = []
notes: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def load(name: str):
    path = DATA / name
    if not path.exists():
        err(f"missing dataset file: {name}")
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    manifest = load("manifest.json")
    trials = load("trials.json")
    sources = load("source_documents.json")
    assertions = load("evidence_assertions.json")
    findings = load("findings.json")
    comparisons = load("direct_comparisons.json")
    screening = load("screening_log.json")
    if errors:
        print("\n".join(errors))
        return 1

    source_ids = {s["source_id"] for s in sources}
    trial_ids = {t["trial_id"] for t in trials}

    # --- referential integrity ------------------------------------------------ #
    ncts = [t["nct_id"] for t in trials if t.get("nct_id")]
    if len(ncts) != len(set(ncts)):
        err(f"duplicate NCT ids: {ncts}")
    for n in ncts:
        if not re.fullmatch(r"NCT\d{8}", n):
            err(f"malformed NCT id: {n}")

    pmids = [s["pmid"] for s in sources if s.get("pmid")]
    if len(pmids) != len(set(pmids)):
        err(f"duplicate publications ingested: {pmids}")

    for a in assertions:
        if a["trial_id"] not in trial_ids:
            err(f"{a['assertion_id']} references unknown trial {a['trial_id']}")
        if a["source_id"] not in source_ids:
            err(f"{a['assertion_id']} references unknown source {a['source_id']}")
        if a["value_basis"] not in VALID_BASES:
            err(f"{a['assertion_id']} has invalid value_basis {a['value_basis']}")
        if not (a.get("exact_passage") or "").strip():
            err(f"{a['assertion_id']} has no exact_passage")
        if a.get("human_verified") and not a.get("verifier"):
            err(f"{a['assertion_id']} is human_verified with no named verifier")

    for f in findings:
        if f["source_id"] not in source_ids:
            err(f"{f['finding_id']} references unknown source")
        if not (f.get("exact_passage") or "").strip():
            err(f"{f['finding_id']} has no exact_passage")
        # A significance claim requires a reported statistical comparison.
        if f.get("significance") in ("significant", "no_significant_difference"):
            if f.get("comparison_p") is None and not f.get("comparison_test"):
                err(f"{f['finding_id']} claims '{f['significance']}' with no reported test")
        if f.get("human_verified") and not f.get("verifier"):
            err(f"{f['finding_id']} is human_verified with no named verifier")

    for c in comparisons:
        if c["trial_id"] not in trial_ids:
            err(f"{c['comparison_id']} references unknown trial {c['trial_id']}")
        if c["source_id"] not in source_ids:
            err(f"{c['comparison_id']} references unknown source {c['source_id']}")
        if not (c.get("exact_passage") or "").strip():
            err(f"{c['comparison_id']} has no exact_passage")
        if not c.get("outcomes"):
            err(f"{c['comparison_id']} has no outcomes")
        for index, outcome in enumerate(c.get("outcomes", []), start=1):
            if not (outcome.get("exact_passage") or "").strip():
                err(f"{c['comparison_id']} outcome {index} has no exact_passage")
        if c.get("human_verified") and not c.get("verifier"):
            err(f"{c['comparison_id']} is human_verified with no named verifier")

    # --- source links --------------------------------------------------------- #
    for s in sources:
        if not s["url"].startswith("https://"):
            err(f"{s['source_id']} url is not https")
        if not any(h in s["url"] for h in ALLOWED_HOSTS):
            err(f"{s['source_id']} url is not an authoritative host: {s['url']}")

    # --- no stored maturity level --------------------------------------------- #
    blob = json.dumps({
        "t": trials, "a": assertions, "f": findings,
        "c": comparisons, "m": manifest,
    })
    for banned in ('"maturity_level"', '"evidence_level"'):
        if banned in blob:
            err(f"dataset stores a derived maturity level ({banned})")

    # --- no synthetic markers -------------------------------------------------- #
    for marker in SYNTHETIC_MARKERS:
        if marker.lower() in blob.lower():
            err(f"synthetic marker found in dataset: {marker}")

    # --- count reconciliation -------------------------------------------------- #
    counts = manifest.get("counts", {})
    actual = {"trials": len(trials), "sources": len(sources),
              "assertions": len(assertions), "findings": len(findings),
              "direct_comparisons": len(comparisons),
              "screening_records": len(screening)}
    for k, v in actual.items():
        if k in counts and counts[k] != v:
            err(f"manifest count mismatch for {k}: manifest={counts[k]} actual={v}")

    # --- participant totals reproducible --------------------------------------- #
    for t in trials:
        tot = next((a for a in assertions
                    if a["trial_id"] == t["trial_id"] and a["dimension"] == "total_enrollment"), None)
        if tot and tot["value"] != t["enrollment_actual"]:
            err(f"{t['trial_id']} enrollment mismatch: trial={t['enrollment_actual']} "
                f"assertion={tot['value']}")

    # --- benchmark ------------------------------------------------------------- #
    bpath = BENCH / "amira_benchmark.jsonl"
    if bpath.exists():
        items = [json.loads(l) for l in bpath.read_text(encoding="utf-8").splitlines() if l.strip()]
        for i in items:
            if i.get("human_verified"):
                err(f"benchmark item {i['benchmark_id']} claims human_verified")
            if not i.get("exact_passage", "").strip():
                err(f"benchmark item {i['benchmark_id']} has no passage")
        notes.append(f"benchmark items: {len(items)} (all pending_human_review)")
    else:
        notes.append("benchmark not built (run pipeline/build_benchmark.py)")

    # --- human verification honesty -------------------------------------------- #
    hv = sum(1 for a in assertions if a.get("human_verified")) + \
         sum(1 for f in findings if f.get("human_verified")) + \
         sum(1 for c in comparisons if c.get("human_verified"))
    notes.append(f"human-verified records: {hv} (expected 0 until named sign-off)")

    # --- report ---------------------------------------------------------------- #
    print("AMIRA offline dataset validation")
    print(f"  dataset_version : {manifest.get('dataset_version')}")
    print(f"  source_cutoff   : {manifest.get('source_cutoff')}")
    print(f"  commit_hash     : {manifest.get('commit_hash', '')[:12]}")
    print(f"  corpus          : {', '.join(manifest.get('corpus', []))}")
    print("  counts          : " + ", ".join(f"{k}={v}" for k, v in actual.items()))
    meds = sorted({t["medicine"] for t in trials})
    print(f"  medicines       : {', '.join(meds)}")
    for n in notes:
        print(f"  note            : {n}")

    if errors:
        print(f"\nFAILED with {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nPASSED — dataset is internally consistent, fully source-linked, "
          "and free of synthetic markers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
