"""Build the AMIRA benchmark from REAL source passages.

Every item is a verbatim sentence retrieved from ClinicalTrials.gov, a PubMed
abstract, or an open-access PubMed Central article for the frozen corpus. Passages
are fetched live and the exact text is stored with its identifiers, so any item can
be traced back and re-verified.

Honesty rules:
  * gold_label is drafted by rule from the passage text and is marked
    annotation_status = "pending_human_review" with verifier = null.
    Nothing here is marked human-verified.
  * The held-out test split is frozen: item ids are assigned deterministically by
    a stable hash so re-running does not reshuffle the splits.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "benchmark"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"

BENCHMARK_VERSION = "1.0.0"
SOURCE_CUTOFF = "2026-07-18"

# Sources in the frozen corpus that benchmark passages may be drawn from.
SOURCES = [
    {"source_id": "SRC-PMID-20176986", "pmid": "20176986", "pmcid": None,
     "nct_id": "NCT00239681", "db": "pubmed",
     "url": "https://pubmed.ncbi.nlm.nih.gov/20176986/"},
    {"source_id": "SRC-PMID-27040132", "pmid": "27040132", "pmcid": None,
     "nct_id": "NCT00468923", "db": "pubmed",
     "url": "https://pubmed.ncbi.nlm.nih.gov/27040132/"},
    {"source_id": "SRC-PMC8370761", "pmid": "33963372", "pmcid": "PMC8370761",
     "nct_id": "NCT00468923", "db": "pmc",
     "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8370761/"},
    {"source_id": "SRC-CTGOV-NCT00239681", "pmid": None, "pmcid": None,
     "nct_id": "NCT00239681", "db": "ctgov",
     "url": "https://clinicaltrials.gov/study/NCT00239681"},
    {"source_id": "SRC-CTGOV-NCT00468923", "pmid": None, "pmcid": None,
     "nct_id": "NCT00468923", "db": "ctgov",
     "url": "https://clinicaltrials.gov/study/NCT00468923"},
]

TARGET_N = 30
SPLIT_PLAN = {"development": 18, "validation": 6, "test": 6}


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "AMIRA-benchmark/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def _clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = (s.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
           .replace("≥", ">=").replace("≤", "<=").replace("–", "-").replace("—", "-"))
    return re.sub(r"\s+", " ", s).strip()


def fetch_text(src: dict) -> str:
    if src["db"] == "pubmed":
        return _clean(_get(EUTILS + "efetch.fcgi?" + urllib.parse.urlencode(
            {"db": "pubmed", "id": src["pmid"], "retmode": "xml", "rettype": "abstract"})))
    if src["db"] == "pmc":
        return _clean(_get(EUTILS + "efetch.fcgi?" + urllib.parse.urlencode(
            {"db": "pmc", "id": src["pmcid"], "retmode": "xml"})))
    nct = src["nct_id"]
    raw = json.loads(_get(f"https://clinicaltrials.gov/api/v2/studies/{nct}"))
    p = raw.get("protocolSection", {})
    parts = [
        p.get("descriptionModule", {}).get("briefSummary", ""),
        p.get("eligibilityModule", {}).get("eligibilityCriteria", ""),
        f"Enrollment: {p.get('designModule',{}).get('enrollmentInfo',{}).get('count')} participants.",
        f"Eligible sex: {p.get('eligibilityModule',{}).get('sex')}.",
        f"Minimum age: {p.get('eligibilityModule',{}).get('minimumAge')}.",
    ]
    return _clean(" ".join(x for x in parts if x))


def sentences(text: str) -> list[str]:
    out = []
    for s in re.split(r"(?<=[.])\s+", text):
        s = s.strip()
        if 60 <= len(s) <= 400 and re.search(r"[a-z]", s):
            out.append(s)
    return out


# --- rule-drafted gold labels (pending human review) ------------------------ #
WOMAN = r"\b(women|female|woman)\b"


def draft_label(passage: str) -> dict:
    p = passage.lower()
    has_woman = bool(re.search(WOMAN, p))
    female_n = None
    m = re.search(r"(\d[\d,\s]{2,})\s*women", passage, re.I)
    if m:
        try:
            female_n = int(re.sub(r"[,\s]", "", m.group(1)))
        except ValueError:
            female_n = None
    female_pct = None
    mp = re.search(r"(\d{1,3})%\s*(?:of the study population|women|female)", passage, re.I)
    if mp:
        female_pct = float(mp.group(1))

    sex_specific = "yes" if re.search(
        r"sex-specific|separately (?:for|in) women|by sex|in women and men|women and men", p
    ) else "not_reported"
    menopause = "yes" if re.search(r"menopaus|postmenopausal status", p) else "not_reported"
    hormone = "yes" if re.search(r"hormone therapy|hormone replacement|estrogen therapy", p) else "not_reported"

    return {
        "female_enrollment_present": "yes" if (female_n or female_pct) else ("mentions_women" if has_woman else "no"),
        "female_n": female_n,
        "female_pct": female_pct,
        "sex_specific_outcomes": sex_specific,
        "menopause_reported": menopause,
        "hormone_therapy_reported": hormone,
        "expected_abstention": not has_woman,
    }


def assign_split(bid: str) -> str:
    """Deterministic, frozen split assignment by stable hash."""
    h = int(hashlib.sha256(bid.encode()).hexdigest(), 16)
    return ["development", "validation", "test"][h % 100 // 34 if h % 100 < 102 else 0] \
        if False else None  # replaced below by quota assignment


def main():
    retrieved_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    candidates = []
    for src in SOURCES:
        text = fetch_text(src)
        for sent in sentences(text):
            candidates.append({"src": src, "passage": sent})

    # Prefer passages that carry women's-evidence signal, then fill for coverage.
    def score(c):
        p = c["passage"].lower()
        s = 0
        if re.search(WOMAN, p):
            s += 3
        if re.search(r"\d", p):
            s += 1
        if re.search(r"menopaus|hormone therapy|sex-specific|by sex", p):
            s += 3
        return -s

    seen: set[str] = set()
    unique = []
    for c in sorted(candidates, key=score):
        key = c["passage"][:120].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(c)

    # Round-robin across sources so the benchmark is not drawn from one document.
    by_source: dict[str, list] = {}
    for c in unique:
        by_source.setdefault(c["src"]["source_id"], []).append(c)
    selected = []
    while len(selected) < TARGET_N and any(by_source.values()):
        for sid in list(by_source):
            if by_source[sid] and len(selected) < TARGET_N:
                selected.append(by_source[sid].pop(0))
    if len(selected) < TARGET_N:
        raise SystemExit(
            f"Only {len(selected)} usable real passages retrieved; benchmark requires {TARGET_N}. "
            "No synthetic passages will be generated."
        )

    # Stable ordering by content hash -> frozen splits.
    selected.sort(key=lambda c: hashlib.sha256(c["passage"].encode()).hexdigest())
    splits = (["development"] * SPLIT_PLAN["development"]
              + ["validation"] * SPLIT_PLAN["validation"]
              + ["test"] * SPLIT_PLAN["test"])

    items = []
    for i, (c, split) in enumerate(zip(selected, splits), start=1):
        src = c["src"]
        bid = f"AMIRA-BM-{i:03d}"
        items.append({
            "benchmark_id": bid,
            "source_id": src["source_id"],
            "nct_id": src["nct_id"],
            "pmid": src["pmid"],
            "pmcid": src["pmcid"],
            "source_url": src["url"],
            "exact_passage": c["passage"],
            "gold_label": draft_label(c["passage"]),
            "split": split,
            "annotation_status": "pending_human_review",
            "human_verifier": None,
            "human_verified": False,
            "label_provenance": "rule_drafted_from_retrieved_passage",
            "retrieved_at": retrieved_at,
        })

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "amira_benchmark.jsonl").write_text(
        "".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items), encoding="utf-8")
    for split in SPLIT_PLAN:
        (OUT / f"{split}.jsonl").write_text(
            "".join(json.dumps(i, ensure_ascii=False) + "\n"
                    for i in items if i["split"] == split), encoding="utf-8")

    manifest = {
        "benchmark_version": BENCHMARK_VERSION,
        "source_cutoff": SOURCE_CUTOFF,
        "generated_at": retrieved_at,
        "total": len(items),
        "development": SPLIT_PLAN["development"],
        "validation": SPLIT_PLAN["validation"],
        "held_out": SPLIT_PLAN["test"],
        "test_split_frozen": True,
        "corpus": ["NCT00239681", "NCT00468923"],
        "annotation_status": "pending_human_review",
        "human_verified_items": 0,
        "note": ("All passages are verbatim text retrieved from ClinicalTrials.gov, PubMed or "
                 "PubMed Central. Gold labels are rule-drafted and require named human review "
                 "before any evaluation result may be published."),
    }
    (OUT / "benchmark_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print("Benchmark built from real sources")
    print(f"  items      : {len(items)} (dev {SPLIT_PLAN['development']} / "
          f"val {SPLIT_PLAN['validation']} / test {SPLIT_PLAN['test']})")
    by_src = {}
    for i in items:
        by_src[i["source_id"]] = by_src.get(i["source_id"], 0) + 1
    for k, v in by_src.items():
        print(f"    {k}: {v}")
    print("  annotation : pending_human_review (0 human-verified)")


if __name__ == "__main__":
    main()
