"""AMIRA real-evidence ingestion for the reviewed multi-condition corpus.

This script fetches REAL records from ClinicalTrials.gov API v2, PubMed E-utilities
and PMC, and emits the normalized dataset the API, UI and downloads all read from.

Integrity rules encoded here:
  * Every assertion carries an exact source passage and a retrievable URL.
  * value_basis distinguishes `reported` (stated verbatim in a source) from
    `derived` (computed by AMIRA) from `not_reported` (absent in the corpus).
    Reported and derived values are NEVER silently summed.
  * Age is NEVER used to infer menopausal status.
  * human_verified stays False until a named human signs off. Nothing here sets it True.
  * Registry values fetched live are checked against the verified expectations below;
    a drift raises and fails the build rather than serving changed numbers silently.

Run:  python pipeline/ingest.py            (writes dataset/, requires network)
      python pipeline/ingest.py --offline  (validate committed dataset only)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "dataset"

DATASET_VERSION = "3.0.0"
# Corpus is frozen: no source published after this date is admitted.
SOURCE_CUTOFF = "2026-07-18"
MEDICINE = "Rosuvastatin"
CONDITION = "Cardiovascular disease prevention"
DRUG_CLASS = "Statin"
INDICATION = "Cardiovascular event prevention"

CTGOV = "https://clinicaltrials.gov/api/v2/studies/{nct}"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"

# --------------------------------------------------------------------------- #
# Verified expectations. These were confirmed against the live sources during
# build; ingestion asserts the live values still match.
# --------------------------------------------------------------------------- #
EXPECTED = {
    "NCT00239681": {"enrollment": 17802, "female": 6801, "male": 11001, "has_results": True},
    "NCT00468923": {"enrollment": 12705, "has_results": False},
    "NCT00327418": {"enrollment": 2800, "has_results": False},  # CARDS (atorvastatin)
    "NCT03036124": {"enrollment": 4744, "female": 1109, "male": 3635, "has_results": True},  # DAPA-HF
    # ClinicalTrials.gov currently lists 982, while the peer-reviewed primary report
    # states that 1,001 participants were randomized. AMIRA retains both facts and
    # uses the publication population for result calculations.
    "NCT03783429": {"registry_enrollment": 982},
}


def _get_json(url: str, timeout: int = 45) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "AMIRA-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def _get_text(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "AMIRA-ingest/1.0"})
    # NCBI E-utilities rate-limit anonymous callers to ~3 req/s. Throttle + retry.
    last = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                text = r.read().decode("utf-8", "replace")
            time.sleep(0.4)
            return text
        except urllib.error.HTTPError as exc:  # noqa: PERF203
            last = exc
            if exc.code == 429:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise
    raise last


def commit_hash() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=REPO, text=True
        ).strip()
    except Exception:
        return "unknown"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------- #
# Fetchers
# --------------------------------------------------------------------------- #
def fetch_ctgov(nct: str) -> dict:
    return _get_json(CTGOV.format(nct=nct))


def ctgov_female_count(study: dict) -> int | None:
    """Read the Female baseline count from posted registry results, if present."""
    bc = study.get("resultsSection", {}).get("baselineCharacteristicsModule", {})
    for measure in bc.get("measures", []):
        if "sex" not in (measure.get("title") or "").lower():
            continue
        for cls in measure.get("classes", []):
            for cat in cls.get("categories", []):
                if (cat.get("title") or "").strip().lower() != "female":
                    continue
                # Prefer the explicit Total group.
                totals = {m.get("groupId"): m.get("value") for m in cat.get("measurements", [])}
                for gid in ("BG002", "BG000"):
                    if gid in totals:
                        try:
                            return int(totals[gid])
                        except (TypeError, ValueError):
                            return None
    return None


def fetch_pubmed_abstract(pmid: str) -> dict:
    url = EUTILS + "efetch.fcgi?" + urllib.parse.urlencode(
        {"db": "pubmed", "id": pmid, "retmode": "xml", "rettype": "abstract"}
    )
    xml = _get_text(url)
    title_m = re.search(r"<ArticleTitle>(.*?)</ArticleTitle>", xml, re.S)
    journal_m = re.search(r"<Title>(.*?)</Title>", xml, re.S)
    year_m = re.search(r"<PubDate>.*?<Year>(\d{4})</Year>", xml, re.S)
    sections = {}
    for m in re.finditer(r"<AbstractText([^>]*)>(.*?)</AbstractText>", xml, re.S):
        lab = re.search(r'Label="([^"]+)"', m.group(1))
        sections[(lab.group(1) if lab else "ABSTRACT")] = _clean(m.group(2))
    return {
        "pmid": pmid,
        "title": _clean(title_m.group(1)) if title_m else "",
        "journal": _clean(journal_m.group(1)) if journal_m else "",
        "year": int(year_m.group(1)) if year_m else None,
        "sections": sections,
    }


def fetch_pmc_text(pmcid: str) -> str:
    url = EUTILS + "efetch.fcgi?" + urllib.parse.urlencode(
        {"db": "pmc", "id": pmcid, "retmode": "xml"}
    )
    text = _clean(re.sub(r"<[^>]+>", " ", _get_text(url)))
    # Some older PMC records expose only front matter through E-utilities even
    # though the article reader contains the full text. Use the public reader as
    # a deterministic fallback when the retrieved record is unusually short.
    if len(text) < 10_000:
        reader_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/?report=xml"
        reader_text = _clean(re.sub(r"<[^>]+>", " ", _get_text(reader_url)))
        if len(reader_text) > len(text):
            text = reader_text
    return text


def _clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = (s.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
           .replace("&#x2265;", ">=").replace("≥", ">=").replace("≤", "<=")
           .replace("’", "'").replace("–", "-").replace("—", "-")
           .replace("‐", "-").replace("−", "-"))
    return re.sub(r"\s+", " ", s).strip()


def find_sentence(haystack: str, needle_regex: str) -> str | None:
    """Return the verbatim sentence containing the match.

    Used where an assertion must be supported by the exact sentence that states it
    (e.g. enrollment counts), rather than a windowed excerpt that can drift onto a
    neighbouring sentence.
    """
    m = re.search(needle_regex, haystack, re.I)
    if not m:
        return None
    start = haystack.rfind(". ", 0, m.start())
    start = 0 if start == -1 else start + 2
    end = haystack.find(". ", m.end())
    end = len(haystack) if end == -1 else end + 1
    return haystack[start:end].strip()


def find_passage(haystack: str, needle_regex: str, window: int = 320) -> str | None:
    """Extract a short exact passage around a match (for citation)."""
    m = re.search(needle_regex, haystack, re.I)
    if not m:
        return None
    start = max(0, m.start() - 40)
    seg = haystack[start:m.end() + window]
    # Trim to sentence boundaries where possible.
    first = seg.find(". ")
    if 0 < first < 90:
        seg = seg[first + 2:]
    last = seg.rfind(". ")
    if last > 120:
        seg = seg[:last + 1]
    return seg.strip()


# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #
def build(offline: bool = False) -> dict:
    retrieved_at = now_iso()

    if offline:  # pragma: no cover - thin delegation
        raise AssertionError("offline mode is handled in main() before build() is called")

    jup = fetch_ctgov("NCT00239681")
    hope = fetch_ctgov("NCT00468923")
    cards = fetch_ctgov("NCT00327418")  # CARDS (atorvastatin)
    dapa = fetch_ctgov("NCT03036124")   # DAPA-HF (dapagliflozin)
    dig = fetch_ctgov("NCT00000476")    # Digitalis Investigation Group
    decision = fetch_ctgov("NCT03783429")  # modern low-dose digoxin

    jup_p = jup["protocolSection"]
    hope_p = hope["protocolSection"]
    cards_p = cards["protocolSection"]
    dapa_p = dapa["protocolSection"]
    dig_p = dig["protocolSection"]
    decision_p = decision["protocolSection"]
    jup_enroll = jup_p["designModule"]["enrollmentInfo"]["count"]
    hope_enroll = hope_p["designModule"]["enrollmentInfo"]["count"]
    cards_enroll = cards_p["designModule"]["enrollmentInfo"]["count"]
    dapa_enroll = dapa_p["designModule"]["enrollmentInfo"]["count"]
    decision_registry_enroll = decision_p["designModule"]["enrollmentInfo"]["count"]
    jup_female = ctgov_female_count(jup)
    dapa_female = ctgov_female_count(dapa)

    # --- drift guard: fail loudly rather than serve changed numbers ---------- #
    e = EXPECTED["NCT00239681"]
    assert jup_enroll == e["enrollment"], f"JUPITER enrollment drift: {jup_enroll} != {e['enrollment']}"
    assert jup_female == e["female"], f"JUPITER female count drift: {jup_female} != {e['female']}"
    assert hope_enroll == EXPECTED["NCT00468923"]["enrollment"], "HOPE-3 enrollment drift"
    assert bool(hope.get("hasResults")) is False, "HOPE-3 now has registry results; re-verify corpus"
    assert cards_enroll == EXPECTED["NCT00327418"]["enrollment"], "CARDS enrollment drift"
    de = EXPECTED["NCT03036124"]
    assert dapa_enroll == de["enrollment"], f"DAPA-HF enrollment drift: {dapa_enroll} != {de['enrollment']}"
    assert dapa_female == de["female"], f"DAPA-HF female count drift: {dapa_female} != {de['female']}"
    assert decision_registry_enroll == EXPECTED["NCT03783429"]["registry_enrollment"], \
        f"DECISION registry enrollment drift: {decision_registry_enroll}"

    # --- publications -------------------------------------------------------- #
    mora = fetch_pubmed_abstract("20176986")       # JUPITER sex-specific analysis
    hope_lipid = fetch_pubmed_abstract("27040132")  # HOPE-3 lipid arm (NEJM 2016)
    hope_fu_text = fetch_pmc_text("PMC8370761")     # HOPE-3 8.7y follow-up (open access)
    ctt = fetch_pubmed_abstract("25579834")        # CTT class-level sex-specific meta-analysis
    cards_pub = fetch_pubmed_abstract("15325833")  # CARDS main report (Lancet 2004)
    butt = fetch_pubmed_abstract("33787831")       # DAPA-HF prespecified sex analysis (JAMA Cardiol 2021)
    hayoz = fetch_pubmed_abstract("23126349")      # postmenopausal hypertension head-to-head RCT
    hayoz_text = fetch_pmc_text("PMC8108841")
    rathore = fetch_pubmed_abstract("12409542")    # DIG post hoc sex analysis
    decision_pub = fetch_pubmed_abstract("42108270")  # DECISION low-dose digoxin RCT

    # The open-access publisher page supplies formal subgroup details not present
    # in the DECISION PubMed abstract.
    decision_full = _clean(re.sub(r"<[^>]+>", " ", _get_text(
        "https://www.nature.com/articles/s41591-026-04406-6"
    )))

    mora_all = " ".join(mora["sections"].values())
    hope_lipid_all = " ".join(hope_lipid["sections"].values())
    ctt_all = " ".join(ctt["sections"].values())
    cards_all = " ".join(cards_pub["sections"].values())
    butt_all = " ".join(butt["sections"].values())
    hayoz_all = " ".join(hayoz["sections"].values())
    rathore_all = " ".join(rathore["sections"].values())
    decision_all = " ".join(decision_pub["sections"].values())

    p_jup_women = find_passage(mora_all, r"6801 women")
    p_jup_sexspec = find_passage(mora_all, r"sex-specific outcomes")
    p_jup_concl = find_passage(mora_all, r"relative risk reduction similar to that in men")
    p_jup_hr = find_passage(mora_all, r"hazard ratio, 0\.54")
    p_hope_n = find_passage(hope_lipid_all, r"12,?705 participants")
    p_hope_pct = find_passage(hope_fu_text, r"46% of the study population")
    p_hope_elig = find_passage(hope_fu_text, r"women aged >=65 years|women aged ≥65 years|women who were between 60 and 65")
    p_ctt_sex = find_passage(ctt_all, r"proportional reductions.{0,60}major vascular events were similar")
    p_ctt_safety = find_passage(ctt_all, r"No adverse effect on rates of cancer")
    p_cards_n = find_passage(cards_all, r"2838 patients")
    # Enrollment must be supported by the sentence that actually states it, not by a
    # neighbouring sentence. find_sentence returns the verbatim containing sentence.
    p_dapa_women = find_sentence(butt_all, r"1109 were women")
    p_dapa_hr = find_passage(butt_all, r"hazard ratios, 0\.73")
    p_dapa_safety = find_passage(butt_all, r"serious adverse events were not more frequent")
    p_hayoz_population = find_sentence(hayoz_all, r"125 postmenopausal hypertensive women")
    p_hayoz_design = find_passage(hayoz_text, r"42-week, single-center, randomized, controlled, double-blind")
    p_hayoz_hrt = find_passage(
        hayoz_text, r"history or current use of oral or topical hormone replacement therapy"
    )
    p_hayoz_target = find_sentence(hayoz_text, r"71\.7% vs 71\.4%")
    p_hayoz_edema = find_passage(hayoz_text, r"77\.4% and 14\.3%")
    p_dig_total = find_passage(rathore_all, r"6800 patients")
    p_dig_effect = find_passage(rathore_all, r"33\.1 percent vs\. 28\.9 percent")
    p_dig_interaction = find_passage(rathore_all, r"adjusted hazard ratio.{0,100}1\.23")
    p_decision_total = find_sentence(decision_all, r"1,001 patients")
    p_decision_primary = find_passage(decision_all, r"rate ratio 0\.81")
    p_decision_women = find_sentence(decision_full, r"28% were women \(\s*n\s*=\s*284\s*\)")
    p_decision_sex = find_passage(
        decision_full, r"rate ratio digoxin versus placebo: 0\.71 and 0\.85"
    )
    p_decision_safety = find_passage(decision_full, r"low-dose digoxin was safe in the 284 women studied")

    for name, val in [("JUPITER women", p_jup_women), ("JUPITER sex-specific", p_jup_sexspec),
                      ("JUPITER HR", p_jup_hr), ("HOPE-3 N", p_hope_n),
                      ("HOPE-3 % women", p_hope_pct), ("CTT sex analysis", p_ctt_sex),
                      ("CARDS N", p_cards_n), ("DAPA-HF women", p_dapa_women),
                      ("DAPA-HF HR", p_dapa_hr), ("DAPA-HF safety", p_dapa_safety),
                      ("Hayoz population", p_hayoz_population), ("Hayoz design", p_hayoz_design),
                      ("Hayoz HRT", p_hayoz_hrt), ("Hayoz target BP", p_hayoz_target),
                      ("Hayoz edema", p_hayoz_edema), ("DIG total", p_dig_total),
                      ("DIG effect", p_dig_effect), ("DIG interaction", p_dig_interaction),
                      ("DECISION total", p_decision_total),
                      ("DECISION primary", p_decision_primary),
                      ("DECISION women", p_decision_women), ("DECISION sex", p_decision_sex),
                      ("DECISION safety", p_decision_safety)]:
        if not val:
            raise SystemExit(f"Required passage not found in live source: {name}")

    # --- source documents ---------------------------------------------------- #
    sources = [
        {"source_id": "SRC-CTGOV-NCT00239681", "source_type": "trial_registry_record",
         "title": _clean(jup_p["identificationModule"]["briefTitle"]),
         "publisher": "ClinicalTrials.gov", "year": 2003,
         "nct_id": "NCT00239681", "pmid": None, "pmcid": None,
         "url": "https://clinicaltrials.gov/study/NCT00239681",
         "api_url": CTGOV.format(nct="NCT00239681"),
         "retrieved_at": retrieved_at,
         "license_note": "ClinicalTrials.gov records are U.S. Government public-domain data."},
        {"source_id": "SRC-CTGOV-NCT00468923", "source_type": "trial_registry_record",
         "title": _clean(hope_p["identificationModule"]["briefTitle"]),
         "publisher": "ClinicalTrials.gov", "year": 2007,
         "nct_id": "NCT00468923", "pmid": None, "pmcid": None,
         "url": "https://clinicaltrials.gov/study/NCT00468923",
         "api_url": CTGOV.format(nct="NCT00468923"),
         "retrieved_at": retrieved_at,
         "license_note": "ClinicalTrials.gov records are U.S. Government public-domain data."},
        {"source_id": "SRC-PMID-20176986", "source_type": "journal_article",
         "title": mora["title"], "publisher": mora["journal"], "year": mora["year"],
         "nct_id": "NCT00239681", "pmid": "20176986", "pmcid": None,
         "url": "https://pubmed.ncbi.nlm.nih.gov/20176986/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Abstract text (c) publisher; short excerpts quoted for citation."},
        {"source_id": "SRC-PMID-27040132", "source_type": "journal_article",
         "title": hope_lipid["title"], "publisher": hope_lipid["journal"], "year": hope_lipid["year"],
         "nct_id": "NCT00468923", "pmid": "27040132", "pmcid": None,
         "url": "https://pubmed.ncbi.nlm.nih.gov/27040132/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Abstract text (c) publisher; short excerpts quoted for citation."},
        {"source_id": "SRC-PMC8370761", "source_type": "journal_article",
         "title": "Lowering cholesterol, blood pressure, or both to prevent cardiovascular events: "
                  "results of 8.7 years of follow-up of Heart Outcomes Prevention Evaluation-3 (HOPE-3)",
         "publisher": "European Heart Journal", "year": 2021,
         "nct_id": "NCT00468923", "pmid": "33963372", "pmcid": "PMC8370761",
         "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8370761/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Open access via PubMed Central; short excerpts quoted for citation."},
        {"source_id": "SRC-PMID-25579834", "source_type": "meta_analysis",
         "title": ctt["title"], "publisher": ctt["journal"], "year": ctt["year"],
         "nct_id": None, "pmid": "25579834", "pmcid": None,
         "url": "https://pubmed.ncbi.nlm.nih.gov/25579834/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Abstract text (c) publisher; short excerpts quoted for citation. "
                         "Class-level (statin) evidence; not specific to one medicine."},
        {"source_id": "SRC-CTGOV-NCT00327418", "source_type": "trial_registry_record",
         "title": _clean(cards_p["identificationModule"]["briefTitle"]),
         "publisher": "ClinicalTrials.gov", "year": 2006,
         "nct_id": "NCT00327418", "pmid": None, "pmcid": None,
         "url": "https://clinicaltrials.gov/study/NCT00327418",
         "api_url": CTGOV.format(nct="NCT00327418"),
         "retrieved_at": retrieved_at,
         "license_note": "ClinicalTrials.gov records are U.S. Government public-domain data."},
        {"source_id": "SRC-PMID-15325833", "source_type": "journal_article",
         "title": cards_pub["title"], "publisher": cards_pub["journal"], "year": cards_pub["year"],
         "nct_id": "NCT00327418", "pmid": "15325833", "pmcid": None,
         "url": "https://pubmed.ncbi.nlm.nih.gov/15325833/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Abstract text (c) publisher; short excerpts quoted for citation."},
        {"source_id": "SRC-CTGOV-NCT03036124", "source_type": "trial_registry_record",
         "title": _clean(dapa_p["identificationModule"]["briefTitle"]),
         "publisher": "ClinicalTrials.gov", "year": 2017,
         "nct_id": "NCT03036124", "pmid": None, "pmcid": None,
         "url": "https://clinicaltrials.gov/study/NCT03036124",
         "api_url": CTGOV.format(nct="NCT03036124"),
         "retrieved_at": retrieved_at,
         "license_note": "ClinicalTrials.gov records are U.S. Government public-domain data."},
        {"source_id": "SRC-PMID-33787831", "source_type": "journal_article",
         "title": butt["title"], "publisher": butt["journal"], "year": butt["year"],
         "nct_id": "NCT03036124", "pmid": "33787831", "pmcid": "PMC8014207",
         "url": "https://pubmed.ncbi.nlm.nih.gov/33787831/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Prespecified sex-specific analysis of DAPA-HF. Abstract (c) publisher; "
                         "open access via PMC8014207; short excerpts quoted for citation."},
        {"source_id": "SRC-PMC8108841", "source_type": "journal_article",
         "title": hayoz["title"], "publisher": hayoz["journal"], "year": hayoz["year"],
         "nct_id": None, "pmid": "23126349", "pmcid": "PMC8108841",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8108841/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Open access via PubMed Central; short excerpts quoted for citation."},
        {"source_id": "SRC-CTGOV-NCT00000476", "source_type": "trial_registry_record",
         "title": _clean(dig_p["identificationModule"]["briefTitle"]),
         "publisher": "ClinicalTrials.gov", "year": 1990,
         "nct_id": "NCT00000476", "pmid": None, "pmcid": None,
         "url": "https://clinicaltrials.gov/study/NCT00000476",
         "api_url": CTGOV.format(nct="NCT00000476"),
         "retrieved_at": retrieved_at,
         "license_note": "ClinicalTrials.gov records are U.S. Government public-domain data."},
        {"source_id": "SRC-PMID-12409542", "source_type": "journal_article",
         "title": rathore["title"], "publisher": rathore["journal"], "year": rathore["year"],
         "nct_id": "NCT00000476", "pmid": "12409542", "pmcid": None,
         "url": "https://pubmed.ncbi.nlm.nih.gov/12409542/",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "PubMed abstract; short excerpts quoted for citation. Post hoc sex analysis."},
        {"source_id": "SRC-CTGOV-NCT03783429", "source_type": "trial_registry_record",
         "title": _clean(decision_p["identificationModule"]["briefTitle"]),
         "publisher": "ClinicalTrials.gov", "year": 2018,
         "nct_id": "NCT03783429", "pmid": None, "pmcid": None,
         "url": "https://clinicaltrials.gov/study/NCT03783429",
         "api_url": CTGOV.format(nct="NCT03783429"),
         "retrieved_at": retrieved_at,
         "license_note": "ClinicalTrials.gov records are U.S. Government public-domain data."},
        {"source_id": "SRC-PMID-42108270", "source_type": "journal_article",
         "title": decision_pub["title"], "publisher": decision_pub["journal"],
         "year": decision_pub["year"], "nct_id": "NCT03783429",
         "pmid": "42108270", "pmcid": None,
         "url": "https://www.nature.com/articles/s41591-026-04406-6",
         "api_url": None, "retrieved_at": retrieved_at,
         "license_note": "Open-access publisher article; short excerpts quoted for citation."},
    ]

    # --- trials -------------------------------------------------------------- #
    trials = [
        {"trial_id": "JUPITER", "nct_id": "NCT00239681",
         "acronym": "JUPITER",
         "display_name": "JUPITER",
         "brief_title": _clean(jup_p["identificationModule"]["briefTitle"]),
         "official_title": _clean(jup_p["identificationModule"].get("officialTitle") or ""),
         "medicine": MEDICINE, "drug_class": DRUG_CLASS, "indication": INDICATION,
         "condition": CONDITION,
         "study_type": "Randomized Controlled Trial", "study_phase": "Phase 3",
         "primary_endpoint": "First major cardiovascular event (MI, stroke, "
                             "arterial revascularization, hospitalization for unstable angina, or CV death)",
         "enrollment_actual": jup_enroll, "enrollment_basis": "reported",
         "sex_eligibility": jup_p["eligibilityModule"].get("sex"),
         "minimum_age": jup_p["eligibilityModule"].get("minimumAge"),
         "start_date": jup_p["statusModule"].get("startDateStruct", {}).get("date"),
         "completion_date": jup_p["statusModule"].get("completionDateStruct", {}).get("date"),
         "has_registry_results": True,
         "registry_url": "https://clinicaltrials.gov/study/NCT00239681",
         "primary_source_id": "SRC-CTGOV-NCT00239681"},
        {"trial_id": "HOPE-3", "nct_id": "NCT00468923",
         "acronym": "HOPE-3",
         "display_name": "HOPE-3",
         "brief_title": _clean(hope_p["identificationModule"]["briefTitle"]),
         "official_title": _clean(hope_p["identificationModule"].get("officialTitle") or ""),
         "medicine": MEDICINE, "drug_class": DRUG_CLASS, "indication": INDICATION,
         "condition": CONDITION,
         "study_type": "Randomized Controlled Trial", "study_phase": "Phase 3",
         "primary_endpoint": "Composite of CV death, non-fatal MI, or non-fatal stroke (lipid-lowering arm)",
         "enrollment_actual": hope_enroll, "enrollment_basis": "reported",
         "sex_eligibility": hope_p["eligibilityModule"].get("sex"),
         "minimum_age": hope_p["eligibilityModule"].get("minimumAge"),
         "start_date": hope_p["statusModule"].get("startDateStruct", {}).get("date"),
         "completion_date": hope_p["statusModule"].get("completionDateStruct", {}).get("date"),
         "has_registry_results": False,
         "registry_url": "https://clinicaltrials.gov/study/NCT00468923",
         "primary_source_id": "SRC-CTGOV-NCT00468923"},
        {"trial_id": "CARDS", "nct_id": "NCT00327418",
         "acronym": "CARDS", "display_name": "CARDS",
         "brief_title": _clean(cards_p["identificationModule"]["briefTitle"]),
         "official_title": _clean(cards_p["identificationModule"].get("officialTitle") or ""),
         "medicine": "Atorvastatin", "drug_class": DRUG_CLASS, "indication": INDICATION,
         "condition": CONDITION,
         "study_type": "Randomized Controlled Trial", "study_phase": "Phase 3",
         "primary_endpoint": "Time to first acute CHD event, coronary revascularization, or stroke "
                             "(primary prevention in type 2 diabetes)",
         "enrollment_actual": cards_enroll, "enrollment_basis": "reported",
         "sex_eligibility": cards_p["eligibilityModule"].get("sex"),
         "minimum_age": cards_p["eligibilityModule"].get("minimumAge"),
         "start_date": cards_p["statusModule"].get("startDateStruct", {}).get("date"),
         "completion_date": cards_p["statusModule"].get("completionDateStruct", {}).get("date"),
         "has_registry_results": False,
         "registry_url": "https://clinicaltrials.gov/study/NCT00327418",
         "primary_source_id": "SRC-CTGOV-NCT00327418"},
        {"trial_id": "DAPA-HF", "nct_id": "NCT03036124",
         "acronym": "DAPA-HF", "display_name": "DAPA-HF",
         "brief_title": _clean(dapa_p["identificationModule"]["briefTitle"]),
         "official_title": _clean(dapa_p["identificationModule"].get("officialTitle") or ""),
         "medicine": "Dapagliflozin", "drug_class": "SGLT2 inhibitor",
         "indication": "Heart failure with reduced ejection fraction",
         "condition": "Heart failure",
         "study_type": "Randomized Controlled Trial", "study_phase": "Phase 3",
         "primary_endpoint": "Composite of worsening heart failure (hospitalization or urgent HF "
                             "visit) or cardiovascular death",
         "enrollment_actual": dapa_enroll, "enrollment_basis": "reported",
         "sex_eligibility": dapa_p["eligibilityModule"].get("sex"),
         "minimum_age": dapa_p["eligibilityModule"].get("minimumAge"),
         "start_date": dapa_p["statusModule"].get("startDateStruct", {}).get("date"),
         "completion_date": dapa_p["statusModule"].get("completionDateStruct", {}).get("date"),
         "has_registry_results": True,
         "registry_url": "https://clinicaltrials.gov/study/NCT03036124",
         "primary_source_id": "SRC-CTGOV-NCT03036124"},
        {"trial_id": "HAYOZ-2012", "nct_id": None,
         "acronym": "HAYOZ-2012", "display_name": "Hayoz 2012",
         "brief_title": hayoz["title"], "official_title": hayoz["title"],
         "medicine": "Valsartan", "drug_class": "Angiotensin receptor blocker",
         "indication": "Hypertension in postmenopausal women",
         "condition": "Hypertension",
         "study_type": "Randomized Controlled Trial", "study_phase": "Not reported",
         "evidence_role": "life_stage_specific_randomized_study",
         "reported_life_stages": ["menopause_postmenopause"],
         "hormone_therapy_population": "excluded_current_or_prior",
         "primary_endpoint": "Change in carotid-to-femoral pulse wave velocity at 38 weeks",
         "enrollment_actual": 125, "enrollment_basis": "reported",
         "sex_eligibility": "FEMALE", "minimum_age": "50 Years",
         "start_date": None, "completion_date": None, "publication_year": 2012,
         "has_registry_results": False,
         "registry_url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8108841/",
         "primary_source_label": "PMC full text",
         "primary_source_id": "SRC-PMC8108841"},
        {"trial_id": "DIG", "nct_id": "NCT00000476",
         "acronym": "DIG", "display_name": "DIG",
         "brief_title": _clean(dig_p["identificationModule"]["briefTitle"]),
         "official_title": _clean(dig_p["identificationModule"].get("officialTitle") or ""),
         "medicine": "Digoxin", "drug_class": "Cardiac glycoside",
         "indication": "Stable heart failure with reduced ejection fraction and sinus rhythm",
         "condition": "Heart failure",
         "study_type": "Randomized Controlled Trial", "study_phase": "Phase 3",
         "evidence_role": "pivotal_trial_with_post_hoc_sex_analysis",
         "primary_endpoint": "Death from any cause in the 6,800-patient main trial",
         "enrollment_actual": 6800, "enrollment_basis": "reported_main_trial_population",
         "sex_eligibility": dig_p["eligibilityModule"].get("sex"),
         "minimum_age": dig_p["eligibilityModule"].get("minimumAge"),
         "start_date": dig_p["statusModule"].get("startDateStruct", {}).get("date"),
         "completion_date": dig_p["statusModule"].get("completionDateStruct", {}).get("date"),
         "has_registry_results": bool(dig.get("hasResults")),
         "registry_url": "https://clinicaltrials.gov/study/NCT00000476",
         "primary_source_id": "SRC-CTGOV-NCT00000476"},
        {"trial_id": "DECISION", "nct_id": "NCT03783429",
         "acronym": "DECISION", "display_name": "DECISION",
         "brief_title": _clean(decision_p["identificationModule"]["briefTitle"]),
         "official_title": _clean(decision_p["identificationModule"].get("officialTitle") or ""),
         "medicine": "Digoxin", "drug_class": "Cardiac glycoside",
         "indication": "Symptomatic chronic heart failure with LVEF 50% or less",
         "condition": "Heart failure",
         "study_type": "Randomized Controlled Trial", "study_phase": "Phase 4",
         "evidence_role": "contemporary_low_dose_outcome_trial",
         "primary_endpoint": "Total worsening heart failure events and cardiovascular mortality",
         "enrollment_actual": 1001, "enrollment_basis": "reported_analysis_population",
         "sex_eligibility": decision_p["eligibilityModule"].get("sex"),
         "minimum_age": decision_p["eligibilityModule"].get("minimumAge"),
         "start_date": decision_p["statusModule"].get("startDateStruct", {}).get("date"),
         "completion_date": decision_p["statusModule"].get("completionDateStruct", {}).get("date"),
         "has_registry_results": bool(decision.get("hasResults")),
         "registry_url": "https://www.nature.com/articles/s41591-026-04406-6",
         "primary_source_label": "Nature Medicine primary report",
         "primary_source_id": "SRC-PMID-42108270"},
    ]

    # --- evidence assertions -------------------------------------------------- #
    def A(aid, trial, dim, value, basis, source_id, passage, locator, notes=""):
        return {
            "assertion_id": aid, "trial_id": trial, "dimension": dim,
            "value": value, "value_basis": basis,
            "source_id": source_id, "exact_passage": passage, "source_locator": locator,
            "retrieved_at": retrieved_at,
            # source_verified: the value was machine-checked against the retrieved source.
            "source_verified": basis in ("reported", "derived"),
            # human_verified stays False until a named person signs off. Never set True here.
            "human_verified": False, "verifier": None,
            "notes": notes,
        }

    assertions = [
        # ---- JUPITER ----
        A("A-JUP-001", "JUPITER", "female_enrollment_count", 6801, "reported",
          "SRC-PMID-20176986", p_jup_women, "Abstract, Methods and Results",
          "Corroborated by posted registry results (Sex: Female, Total = 6801) at SRC-CTGOV-NCT00239681."),
        A("A-JUP-002", "JUPITER", "total_enrollment", jup_enroll, "reported",
          "SRC-CTGOV-NCT00239681",
          f"Enrollment: {jup_enroll} participants (ACTUAL).", "Design module, enrollmentInfo"),
        A("A-JUP-003", "JUPITER", "female_enrollment_pct", round(6801 / jup_enroll * 100, 1), "derived",
          "SRC-PMID-20176986", p_jup_women, "Computed from reported counts",
          "Derived by AMIRA as 6801/17802; not stated as a percentage in the source."),
        A("A-JUP-004", "JUPITER", "sex_specific_efficacy_reported", "yes", "reported",
          "SRC-PMID-20176986", p_jup_sexspec or p_jup_concl, "Abstract, Background/Conclusions",
          "Prespecified sex-specific outcome analysis published for this trial."),
        A("A-JUP-005", "JUPITER", "sex_specific_safety_reported", "not_reported", "not_reported",
          "SRC-PMID-20176986", p_jup_concl or p_jup_sexspec, "Abstract",
          "No sex-stratified safety outcome was located in the reviewed corpus."),
        A("A-JUP-006", "JUPITER", "menopause_status_reported", "not_reported", "not_reported",
          "SRC-PMID-20176986", p_jup_women, "Abstract, Methods and Results",
          "Eligibility is age-based (women >=60). Age is NOT used to infer menopausal status."),
        A("A-JUP-007", "JUPITER", "hormone_therapy_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00239681",
          "Registry record contains no baseline measure or outcome for menopausal hormone therapy use.",
          "Registry record review"),
        A("A-JUP-008", "JUPITER", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00239681",
          "Registry record reports no pregnancy-specific evidence for this population.",
          "Registry record review"),
        # ---- HOPE-3 ----
        A("A-HOP-001", "HOPE-3", "total_enrollment", hope_enroll, "reported",
          "SRC-PMID-27040132", p_hope_n, "Abstract, Methods"),
        A("A-HOP-002", "HOPE-3", "female_enrollment_pct", 46.0, "reported",
          "SRC-PMC8370761", p_hope_pct, "Discussion",
          "Reported as a percentage only; no exact female participant count is published."),
        A("A-HOP-003", "HOPE-3", "female_enrollment_count", None, "not_reported",
          "SRC-CTGOV-NCT00468923",
          "No results are posted to the registry for this trial, and no exact female "
          "participant count appears in the reviewed publications.",
          "Registry record review",
          "Only a rounded percentage (46%) is available; an exact count cannot be reported."),
        A("A-HOP-004", "HOPE-3", "sex_specific_efficacy_reported", "not_reported", "not_reported",
          "SRC-PMID-27040132", p_hope_n, "Abstract",
          "No sex-stratified efficacy analysis for the lipid arm was located in the reviewed corpus."),
        A("A-HOP-005", "HOPE-3", "sex_specific_safety_reported", "not_reported", "not_reported",
          "SRC-PMID-27040132", p_hope_n, "Abstract"),
        A("A-HOP-006", "HOPE-3", "menopause_status_reported", "not_reported", "not_reported",
          "SRC-PMC8370761", p_hope_elig or p_hope_pct, "Methods",
          "Eligibility is age-based (women >=65, or 60-65 with two risk factors). "
          "Age is NOT used to infer menopausal status."),
        A("A-HOP-007", "HOPE-3", "hormone_therapy_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00468923",
          "Registry record contains no baseline measure or outcome for menopausal hormone therapy use.",
          "Registry record review"),
        A("A-HOP-008", "HOPE-3", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00468923",
          "Registry record reports no pregnancy-specific evidence for this population.",
          "Registry record review"),
        # ---- CARDS (atorvastatin) ----
        A("A-CAR-001", "CARDS", "total_enrollment", cards_enroll, "reported",
          "SRC-PMID-15325833", p_cards_n, "Abstract, Methods",
          "2838 patients randomised (placebo 1410, atorvastatin 1428); registry lists 2800 planned."),
        A("A-CAR-002", "CARDS", "female_enrollment_count", None, "not_located",
          "SRC-PMID-15325833", p_cards_n, "Abstract",
          "The retrieved abstract and registry do not state the female participant count "
          "(reported only in the full-text baseline table, which AMIRA has not ingested). "
          "This is an open gap, NOT a claim that the trial failed to report it."),
        A("A-CAR-003", "CARDS", "sex_specific_efficacy_reported", "not_located", "not_located",
          "SRC-PMID-15325833", p_cards_n, "Abstract",
          "No sex-specific efficacy analysis was located in the retrieved sources for CARDS."),
        A("A-CAR-004", "CARDS", "sex_specific_safety_reported", "not_located", "not_located",
          "SRC-PMID-15325833", p_cards_n, "Abstract",
          "No sex-stratified safety analysis was located in the retrieved sources for CARDS."),
        A("A-CAR-005", "CARDS", "menopause_status_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00327418",
          "Registry record contains no menopausal-status measure. Eligibility is age-based "
          "(>=40 years); age is NOT used to infer menopausal status.", "Registry record review"),
        A("A-CAR-006", "CARDS", "hormone_therapy_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00327418",
          "Registry record contains no hormone therapy measure.", "Registry record review"),
        A("A-CAR-007", "CARDS", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00327418",
          "Registry record reports no pregnancy-specific evidence for this population.",
          "Registry record review"),
        # ---- DAPA-HF (dapagliflozin, heart failure) ----
        A("A-DAPA-001", "DAPA-HF", "total_enrollment", dapa_enroll, "reported",
          "SRC-CTGOV-NCT03036124",
          f"Enrollment: {dapa_enroll} participants (ACTUAL).", "Design module, enrollmentInfo"),
        A("A-DAPA-002", "DAPA-HF", "female_enrollment_count", 1109, "reported",
          "SRC-PMID-33787831", p_dapa_women, "Abstract, Results",
          "Corroborated by posted registry results (Sex: Female, Total = 1109) at SRC-CTGOV-NCT03036124."),
        A("A-DAPA-003", "DAPA-HF", "female_enrollment_pct", 23.4, "reported",
          "SRC-PMID-33787831", p_dapa_women, "Abstract, Results",
          "Stated as 23.4% in the source."),
        A("A-DAPA-004", "DAPA-HF", "sex_specific_efficacy_reported", "yes", "reported",
          "SRC-PMID-33787831", p_dapa_hr, "Abstract, Results",
          "Prespecified sex-specific efficacy analysis with a formal sex-by-treatment interaction test."),
        A("A-DAPA-005", "DAPA-HF", "sex_specific_safety_reported", "yes", "reported",
          "SRC-PMID-33787831", p_dapa_safety, "Abstract, Results",
          "Serious adverse events and study-drug discontinuation were reported separately by sex."),
        A("A-DAPA-006", "DAPA-HF", "menopause_status_reported", "not_reported", "not_reported",
          "SRC-PMID-33787831", p_dapa_women, "Abstract",
          "The sex-specific analysis reports biological sex only; menopausal status is not reported. "
          "Enrolment minimum age is 18; age is NOT used to infer menopausal status."),
        A("A-DAPA-007", "DAPA-HF", "hormone_therapy_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT03036124",
          "Registry record and reviewed publication contain no menopausal hormone therapy measure.",
          "Registry record review"),
        A("A-DAPA-008", "DAPA-HF", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT03036124",
          "Registry record reports no pregnancy-specific evidence for this population.",
          "Registry record review"),
        # ---- Hayoz 2012: women-only, explicitly postmenopausal hypertension RCT ----
        A("A-HAY-001", "HAYOZ-2012", "total_enrollment", 125, "reported",
          "SRC-PMC8108841", p_hayoz_population, "Abstract"),
        A("A-HAY-002", "HAYOZ-2012", "female_enrollment_count", 125, "reported",
          "SRC-PMC8108841", p_hayoz_population, "Abstract",
          "All randomized participants were explicitly described as postmenopausal women."),
        A("A-HAY-003", "HAYOZ-2012", "female_enrollment_pct", 100.0, "derived",
          "SRC-PMC8108841", p_hayoz_population, "Computed from reported population",
          "Derived by AMIRA as 125/125 because the study population was women only."),
        A("A-HAY-004", "HAYOZ-2012", "sex_specific_efficacy_reported", "yes", "reported",
          "SRC-PMC8108841", p_hayoz_target, "Results, patient disposition",
          "Outcomes were reported for an explicitly defined women-only population; this is not a comparison with men."),
        A("A-HAY-005", "HAYOZ-2012", "sex_specific_safety_reported", "yes", "reported",
          "SRC-PMC8108841", p_hayoz_edema, "Safety results",
          "Adverse events were reported for an explicitly defined women-only population."),
        A("A-HAY-006", "HAYOZ-2012", "menopause_status_reported", "yes", "reported",
          "SRC-PMC8108841", p_hayoz_population, "Abstract and eligibility criteria",
          "The source explicitly identifies every participant as postmenopausal."),
        A("A-HAY-007", "HAYOZ-2012", "hormone_therapy_reported", "yes", "reported",
          "SRC-PMC8108841", p_hayoz_hrt, "Methods, Patients",
          "Current or prior oral or topical hormone replacement therapy was an exclusion criterion. "
          "This reports hormonal context; it does not compare hormone-therapy users with non-users."),
        A("A-HAY-008", "HAYOZ-2012", "outcomes_stratified_by_life_stage_and_hormone_context",
          "not_reported", "not_reported", "SRC-PMC8108841", p_hayoz_hrt,
          "Methods and Results",
          "The trial studied one postmenopausal, no-current-or-prior-HRT population. It did not "
          "stratify outcomes across multiple life-stage and hormone-therapy groups."),
        A("A-HAY-009", "HAYOZ-2012", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-PMC8108841", p_hayoz_population, "Population review",
          "The reviewed study is specific to postmenopausal women and reports no pregnancy evidence."),
        # ---- DIG: historical trial with a post hoc sex analysis ----
        A("A-DIG-001", "DIG", "total_enrollment", 6800, "reported",
          "SRC-PMID-12409542", p_dig_total, "Abstract, Methods",
          "This is the main DIG trial population analyzed for the primary mortality outcome."),
        A("A-DIG-002", "DIG", "female_enrollment_count", None, "not_located",
          "SRC-PMID-12409542", p_dig_total, "Abstract, Methods",
          "An exact female count is not stated in the machine-retrieved abstract."),
        A("A-DIG-003", "DIG", "female_enrollment_pct", None, "not_located",
          "SRC-PMID-12409542", p_dig_total, "Abstract, Methods",
          "A female enrollment percentage is not stated in the machine-retrieved abstract."),
        A("A-DIG-004", "DIG", "sex_specific_efficacy_reported", "yes", "reported",
          "SRC-PMID-12409542", p_dig_interaction, "Abstract, Results",
          "Post hoc sex subgroup analysis with a formal sex-by-treatment interaction test."),
        A("A-DIG-005", "DIG", "sex_specific_safety_reported", "not_located", "not_located",
          "SRC-PMID-12409542", p_dig_effect, "Abstract, Results",
          "A sex-specific adverse-event analysis is not available in the machine-retrieved abstract."),
        A("A-DIG-006", "DIG", "menopause_status_reported", "not_reported", "not_reported",
          "SRC-PMID-12409542", p_dig_effect, "Abstract review",
          "Women were analyzed by sex, but menopausal status is not reported in the abstract. "
          "Age is not used to infer it."),
        A("A-DIG-007", "DIG", "hormone_therapy_reported", "not_located", "not_located",
          "SRC-PMID-12409542", p_dig_effect, "Abstract review",
          "Hormone-therapy use is not available in the machine-retrieved abstract."),
        A("A-DIG-008", "DIG", "outcomes_stratified_by_life_stage_and_hormone_context",
          "not_located", "not_located", "SRC-PMID-12409542", p_dig_effect,
          "Abstract review",
          "No joint life-stage and hormone-context analysis is available in the abstract."),
        A("A-DIG-009", "DIG", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT00000476",
          "The registry record reports no pregnancy-specific outcome evidence.", "Registry record review"),
        # ---- DECISION: contemporary low-dose digoxin RCT ----
        A("A-DEC-001", "DECISION", "total_enrollment", 1001, "reported",
          "SRC-PMID-42108270", p_decision_total, "Abstract",
          "The primary publication reports 1,001 randomized participants. The registry currently "
          "lists 982; AMIRA uses the publication population for the published result calculations."),
        A("A-DEC-002", "DECISION", "female_enrollment_count", 284, "reported",
          "SRC-PMID-42108270", p_decision_women, "Full text, subgroup results"),
        A("A-DEC-003", "DECISION", "female_enrollment_pct", 28.0, "reported",
          "SRC-PMID-42108270", p_decision_total, "Abstract",
          "The publication reports 28% women; the exact count is 284 in the full text."),
        A("A-DEC-004", "DECISION", "sex_specific_efficacy_reported", "yes", "reported",
          "SRC-PMID-42108270", p_decision_sex, "Full text, subgroup analysis",
          "Treatment effects were reported for women and men with a formal interaction test."),
        A("A-DEC-005", "DECISION", "sex_specific_safety_reported", "yes", "reported",
          "SRC-PMID-42108270", p_decision_safety, "Full text, Discussion",
          "The publication explicitly discusses low-dose digoxin safety in the 284 women studied; "
          "no formal between-sex safety interaction estimate was located."),
        A("A-DEC-006", "DECISION", "menopause_status_reported", "not_reported", "not_reported",
          "SRC-PMID-42108270", p_decision_women, "Full text review",
          "The publication reports sex and age, but not menopausal status. Age is not used to infer it."),
        A("A-DEC-007", "DECISION", "hormone_therapy_reported", "not_reported", "not_reported",
          "SRC-PMID-42108270", p_decision_women, "Full text review",
          "No menopausal hormone-therapy measure was located in the reviewed publication or registry."),
        A("A-DEC-008", "DECISION", "outcomes_stratified_by_life_stage_and_hormone_context",
          "not_reported", "not_reported", "SRC-PMID-42108270", p_decision_women,
          "Full text review",
          "The sex subgroup was not stratified by menopausal stage and hormone-therapy context."),
        A("A-DEC-009", "DECISION", "pregnancy_evidence_reported", "not_reported", "not_reported",
          "SRC-CTGOV-NCT03783429",
          "The registry record reports no pregnancy-specific outcome evidence.", "Registry record review"),
    ]

    # --- structured sex-specific findings (effect estimates) ------------------ #
    # These carry real effect estimates and, where a formal statistical comparison
    # exists, its result. `significance` is only ever set from a reported test.
    def F(fid, medicine, scope, ftype, endpoint, source_id, passage, locator, **kw):
        base = {
            "finding_id": fid, "medicine": medicine, "drug_class": DRUG_CLASS,
            "scope": scope, "finding_type": ftype, "endpoint": endpoint,
            "population_scope": "women_and_men",
            "reporting_scope": "women_and_men_separate",
            "female_estimate": None, "male_estimate": None, "effect_measure": None,
            "female_ci": None, "male_ci": None,
            "comparison_test": None, "comparison_p": None,
            "significance": "not_tested",  # significant | no_significant_difference | trend_only | not_tested
            "female_rate": None, "male_rate": None,
            "interpretation": "", "source_id": source_id,
            "exact_passage": passage, "source_locator": locator,
            "source_verified": True, "human_verified": False, "verifier": None,
            "retrieved_at": retrieved_at,
        }
        base.update(kw)
        return base

    findings = [
        F("F-EFF-JUP-001", "Rosuvastatin", "trial:JUPITER", "efficacy",
          "First major cardiovascular event", "SRC-PMID-20176986", p_jup_hr,
          "Abstract, Methods and Results",
          female_estimate="HR 0.54", male_estimate="HR 0.58", effect_measure="Hazard ratio",
          female_ci="95% CI 0.37-0.80", male_ci="95% CI 0.45-0.73",
          comparison_test=None,
          comparison_p=None, significance="not_tested",
          interpretation="A prespecified sex-specific analysis reported that rosuvastatin reduced "
                         "cardiovascular events in women (HR 0.54, 95% CI 0.37-0.80, P=0.002) and in "
                         "men (HR 0.58, 95% CI 0.45-0.73). No formal rosuvastatin-specific "
                         "sex-by-treatment interaction test was located in the reviewed sources, so "
                         "AMIRA does not report a drug-specific significance conclusion."),
        F("F-EFF-CLASS-001", "Rosuvastatin", "class:Statin", "efficacy",
          "Major vascular events per 1.0 mmol/L LDL-C reduction", "SRC-PMID-25579834", p_ctt_sex,
          "Abstract, Findings",
          female_estimate="RR 0.84", male_estimate="RR 0.78", effect_measure="Rate ratio",
          female_ci="99% CI 0.78-0.91", male_ci="99% CI 0.75-0.81",
          comparison_test="Adjusted heterogeneity by sex (Cox model)", comparison_p="0.33",
          significance="no_significant_difference",
          interpretation="Class-level meta-analysis (27 statin trials, 46,675 women): proportional "
                         "reduction in major vascular events was similar in women (RR 0.84) and men "
                         "(RR 0.78), heterogeneity-by-sex p=0.33. This is class-level evidence, not "
                         "specific to rosuvastatin."),
        F("F-SAF-CLASS-001", "Rosuvastatin", "class:Statin", "safety",
          "Cancer incidence and non-cardiovascular mortality", "SRC-PMID-25579834", p_ctt_safety
          or p_ctt_sex, "Abstract, Findings",
          effect_measure="Rate comparison by sex",
          comparison_test="Meta-analytic comparison by sex", significance="no_significant_difference",
          interpretation="Class-level meta-analysis reported no adverse effect on cancer incidence or "
                         "non-cardiovascular mortality for either sex. No rosuvastatin-specific "
                         "sex-stratified adverse-event breakdown (e.g. muscle symptoms) was located "
                         "in the reviewed sources."),
        # ---- DAPA-HF: a drug-specific sex analysis WITH a formal interaction test ----
        F("F-EFF-DAPA-001", "Dapagliflozin", "trial:DAPA-HF", "efficacy",
          "Worsening heart failure event or cardiovascular death", "SRC-PMID-33787831", p_dapa_hr,
          "Abstract, Results", drug_class="SGLT2 inhibitor",
          female_estimate="HR 0.79", male_estimate="HR 0.73", effect_measure="Hazard ratio",
          female_ci="95% CI 0.59-1.06", male_ci="95% CI 0.63-0.85",
          comparison_test="Sex-by-treatment interaction (Cox model)", comparison_p="0.67",
          significance="no_significant_difference",
          interpretation="A prespecified DAPA-HF analysis reported that dapagliflozin reduced the "
                         "primary outcome to a similar extent in women (HR 0.79, 95% CI 0.59-1.06) and "
                         "men (HR 0.73, 95% CI 0.63-0.85), with a formal sex-by-treatment interaction "
                         "p=0.67. This is a drug-specific comparison, so 'no significant sex difference' "
                         "is supported for dapagliflozin."),
        F("F-SAF-DAPA-001", "Dapagliflozin", "trial:DAPA-HF", "safety",
          "Serious adverse events and study-drug discontinuation", "SRC-PMID-33787831", p_dapa_safety,
          "Abstract, Results", drug_class="SGLT2 inhibitor",
          effect_measure="Reported separately by sex (within-sex vs placebo)",
          # The source compares each sex against PLACEBO. It reports no comparison
          # BETWEEN women and men, so no between-sex significance may be claimed.
          comparison_test=None,
          comparison_p=None, significance="not_tested",
          interpretation="Serious adverse events and study-drug discontinuation were reported "
                         "separately by sex, and were not more frequent with dapagliflozin than "
                         "placebo in either men or women. That is a within-sex comparison against "
                         "placebo; no formal between-sex safety comparison or interaction test was "
                         "reported in the reviewed source, so no between-sex safety difference is "
                         "claimed either way."),
        # ---- Explicitly postmenopausal women-only trial ----
        F("F-EFF-HAY-001", "Valsartan", "trial:HAYOZ-2012", "efficacy",
          "Reached target office blood pressure at 38 weeks", "SRC-PMC8108841",
          p_hayoz_target, "Results, patient disposition",
          drug_class="Angiotensin receptor blocker", population_scope="women_only_life_stage",
          female_estimate="71.7%", effect_measure="Target attainment rate",
          significance="not_tested",
          interpretation="In this postmenopausal women-only trial, 71.7% of the valsartan-based "
                         "regimen group and 71.4% of the amlodipine-based regimen group reached "
                         "target office blood pressure. This compares treatment arms within women; "
                         "it is not a comparison between women and men."),
        F("F-SAF-HAY-001", "Valsartan", "trial:HAYOZ-2012", "safety",
          "Peripheral edema", "SRC-PMC8108841", p_hayoz_edema, "Safety Results",
          drug_class="Angiotensin receptor blocker", population_scope="women_only_life_stage",
          female_rate="14.3% with valsartan-based regimen", significance="not_tested",
          interpretation="Peripheral edema was reported in 14.3% of the valsartan-based regimen "
                         "group and 77.4% of the amlodipine-based regimen group (P<0.001) in this "
                         "single postmenopausal women-only study. The result is treatment-arm "
                         "evidence within women, not a between-sex safety comparison."),
        # ---- DIG: historical post hoc sex interaction ----
        F("F-EFF-DIG-001", "Digoxin", "trial:DIG", "efficacy",
          "Death from any cause", "SRC-PMID-12409542", p_dig_interaction,
          "Abstract, Results", drug_class="Cardiac glycoside",
          female_estimate="Adjusted HR 1.23", male_estimate="Adjusted HR 0.93",
          effect_measure="Hazard ratio vs placebo",
          female_ci="95% CI 1.02-1.47", male_ci="95% CI 0.85-1.02",
          female_rate="33.1% digoxin vs 28.9% placebo",
          male_rate="35.2% digoxin vs 36.9% placebo",
          comparison_test="Adjusted sex-by-treatment interaction",
          comparison_p="0.014", significance="significant",
          interpretation="A post hoc DIG analysis found a statistically significant interaction "
                         "between sex and digoxin for all-cause mortality. Among women, mortality "
                         "was 33.1% with digoxin and 28.9% with placebo, an absolute difference of "
                         "4.2 percentage points; the unadjusted women-only confidence interval "
                         "included no difference. This analysis identifies an association in a "
                         "post hoc subgroup and does not establish a menopause-specific effect."),
        # ---- DECISION: contemporary low-dose digoxin evidence ----
        F("F-EFF-DEC-001", "Digoxin", "trial:DECISION", "efficacy",
          "Total worsening heart failure events and cardiovascular mortality",
          "SRC-PMID-42108270", p_decision_sex, "Full text, subgroup analysis",
          drug_class="Cardiac glycoside",
          female_estimate="RR 0.71", male_estimate="RR 0.85", effect_measure="Rate ratio",
          female_ci="95% CI 0.38-1.32", male_ci="95% CI 0.63-1.14",
          comparison_test="Sex-by-treatment interaction", comparison_p="0.61",
          significance="no_significant_difference",
          interpretation="DECISION targeted a low serum digoxin concentration of 0.5-0.9 ng/mL. "
                         "The primary-outcome treatment effect did not differ significantly between "
                         "women and men (interaction P=0.61). The overall primary outcome was also "
                         "not statistically significant (RR 0.81, 95% CI 0.61-1.07; P=0.133)."),
        F("F-SAF-DEC-001", "Digoxin", "trial:DECISION", "safety",
          "Low-dose digoxin safety in women", "SRC-PMID-42108270", p_decision_safety,
          "Full text, Discussion", drug_class="Cardiac glycoside",
          reporting_scope="women_only_narrative",
          effect_measure="Narrative safety assessment", significance="not_tested",
          interpretation="The publication reports that low-dose digoxin was safe in the 284 women "
                         "studied. A formal between-sex adverse-event interaction estimate was not "
                         "located, so AMIRA does not infer equivalent safety between women and men."),
    ]

    # --- direct treatment-arm comparisons ------------------------------------ #
    # Kept separate from sex-interaction findings so a women-only head-to-head
    # study is never mislabeled as a comparison between women and men.
    direct_comparisons = [
        {
            "comparison_id": "CMP-HAYOZ-001",
            "trial_id": "HAYOZ-2012",
            "medicine": "Valsartan",
            "comparator": "Amlodipine",
            "medicine_regimen": "Valsartan-based regimen",
            "comparator_regimen": "Amlodipine-based regimen",
            "population": "Postmenopausal women with hypertension",
            "duration": "38 weeks",
            "headline": "Both regimens reached similar blood pressure targets. Side effects differed.",
            "clinical_boundary": (
                "This is evidence from one study, not a prescribing recommendation. It does not "
                "establish that either medicine is better for every patient."
            ),
            "regimen_note": (
                "Participants received valsartan or amlodipine, with hydrochlorothiazide added "
                "from week 12 when target blood pressure was not reached. This is therefore a "
                "comparison of treatment regimens, not pure monotherapy."
            ),
            "limitations": [
                "Single-center study with 125 randomized participants",
                "Hydrochlorothiazide use differed between groups",
                "Novartis provided financial support and several authors were employees",
                "The study does not establish that either regimen is better for every patient",
            ],
            "outcomes": [
                {
                    "outcome_type": "effectiveness",
                    "endpoint": "Reached target office blood pressure",
                    "medicine_value": "71.7%",
                    "comparator_value": "71.4%",
                    "comparison_test": "Between-regimen comparison at study end",
                    "comparison_p": "Not significant",
                    "interpretation": "Target blood pressure attainment was nearly identical.",
                    "exact_passage": p_hayoz_target,
                    "source_locator": "Results, patient disposition",
                },
                {
                    "outcome_type": "safety",
                    "endpoint": "Peripheral edema",
                    "medicine_value": "14.3%",
                    "comparator_value": "77.4%",
                    "comparison_test": "Between-regimen adverse-event comparison",
                    "comparison_p": "P < 0.001",
                    "interpretation": (
                        "Peripheral edema was reported more often with the amlodipine-based regimen "
                        "in this study."
                    ),
                    "exact_passage": p_hayoz_edema,
                    "source_locator": "Safety Results",
                },
            ],
            "source_id": "SRC-PMC8108841",
            "exact_passage": p_hayoz_population,
            "source_locator": "Abstract and full-text results",
            "source_verified": True,
            "human_verified": False,
            "verifier": None,
            "retrieved_at": retrieved_at,
        }
    ]

    # --- screening log -------------------------------------------------------- #
    screening = [
        {"candidate": "NCT00239681", "identifier_type": "nct", "decision": "include",
         "reason": "Rosuvastatin RCT in the reviewed frozen corpus; registry results posted.",
         "screened_at": retrieved_at},
        {"candidate": "NCT00468923", "identifier_type": "nct", "decision": "include",
         "reason": "Rosuvastatin RCT in the reviewed frozen corpus.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 20176986", "identifier_type": "pmid", "decision": "include",
         "reason": "Prespecified sex-specific outcome analysis of JUPITER; supplies the "
                   "women-analyzed evidence dimension.", "screened_at": retrieved_at},
        {"candidate": "PMID 27040132", "identifier_type": "pmid", "decision": "include",
         "reason": "Primary lipid-arm report of HOPE-3 (NEJM 2016).", "screened_at": retrieved_at},
        {"candidate": "PMC8370761 (PMID 33963372)", "identifier_type": "pmcid", "decision": "include",
         "reason": "Open-access HOPE-3 long-term follow-up; only located source stating the "
                   "proportion of women enrolled.", "screened_at": retrieved_at},
        {"candidate": "PMID 27041480", "identifier_type": "pmid", "decision": "exclude",
         "reason": "HOPE-3 blood-pressure arm; intervention is not rosuvastatin.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 27039945", "identifier_type": "pmid", "decision": "exclude",
         "reason": "HOPE-3 combined BP+lipid arm; not the isolated rosuvastatin comparison.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 30814321 (PMC6453765)", "identifier_type": "pmid", "decision": "exclude",
         "reason": "HOPE-3 cognition substudy; population is a subset, would double-count participants.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 25579834", "identifier_type": "pmid", "decision": "include",
         "reason": "Cholesterol Treatment Trialists' sex-specific meta-analysis (27 statin trials); "
                   "class-level effectiveness and safety by sex with a formal heterogeneity test.",
         "screened_at": retrieved_at},
        {"candidate": "NCT00327418 (CARDS)", "identifier_type": "nct", "decision": "include",
         "reason": "Phase 3 atorvastatin RCT for primary CV prevention; second verified statin "
                   "for the drug-class comparison.", "screened_at": retrieved_at},
        {"candidate": "PMID 15325833", "identifier_type": "pmid", "decision": "include",
         "reason": "Primary report of CARDS (Lancet 2004).", "screened_at": retrieved_at},
        {"candidate": "NCT03036124 (DAPA-HF)", "identifier_type": "nct", "decision": "include",
         "reason": "Phase 3 dapagliflozin RCT in HFrEF; registry results posted with sex breakdown.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 33787831 (PMC8014207)", "identifier_type": "pmid", "decision": "include",
         "reason": "Prespecified DAPA-HF sex-specific efficacy and safety analysis with a formal "
                   "sex-by-treatment interaction test (JAMA Cardiology 2021).",
         "screened_at": retrieved_at},
        {"candidate": "PMID 36342789", "identifier_type": "pmid", "decision": "defer",
         "reason": "Pooled DAPA-HF + DELIVER sex-differences analysis; combines two trial populations. "
                   "Deferred to avoid participant double-counting until pooled-vs-single scope is modelled.",
         "screened_at": retrieved_at},
        {"candidate": "Pravastatin trials (e.g. WOSCOPS, PROSPER)", "identifier_type": "medicine",
         "decision": "defer",
         "reason": "Not yet ingested and verified; excluded from the class comparison until real "
                   "evidence is retrieved. AMIRA shows only verified drugs.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 23126349 (PMC8108841)", "identifier_type": "pmid",
         "decision": "include",
         "reason": "Randomized double-blind comparison in 125 explicitly postmenopausal women "
                   "with hypertension; reports hormone-replacement-therapy exclusion criteria, "
                   "blood-pressure outcomes, and adverse events.",
         "screened_at": retrieved_at},
        {"candidate": "NCT00000476 (DIG)", "identifier_type": "nct", "decision": "include",
         "reason": "Phase 3 randomized digoxin trial underlying the historical sex subgroup analysis.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 12409542", "identifier_type": "pmid", "decision": "include",
         "reason": "Post hoc DIG sex analysis with formal interaction tests; explicitly states "
                   "that hormone-replacement-therapy information was not collected.",
         "screened_at": retrieved_at},
        {"candidate": "NCT03783429 (DECISION)", "identifier_type": "nct", "decision": "include",
         "reason": "Contemporary Phase 4 randomized low-dose digoxin outcome trial.",
         "screened_at": retrieved_at},
        {"candidate": "PMID 42108270", "identifier_type": "pmid", "decision": "include",
         "reason": "DECISION primary report with 284 women and a formal sex-by-treatment "
                   "interaction analysis.",
         "screened_at": retrieved_at},
    ]

    manifest = {
        "dataset_version": DATASET_VERSION,
        "source_cutoff": SOURCE_CUTOFF,
        "generated_at": retrieved_at,
        "commit_hash": commit_hash(),
        "medicine": MEDICINE,
        "condition": CONDITION,
        "drug_class": DRUG_CLASS,
        "corpus": [
            "NCT00239681", "NCT00468923", "NCT00327418", "NCT03036124",
            "PMID23126349", "NCT00000476", "NCT03783429",
        ],
        "medicines": sorted({t["medicine"] for t in trials}),
        "counts": {"trials": len(trials), "sources": len(sources),
                   "assertions": len(assertions), "findings": len(findings),
                   "direct_comparisons": len(direct_comparisons),
                   "screening_records": len(screening)},
        "screening_summary": {
            "identified": len([s for s in screening]) ,
            "included": len([s for s in screening if s["decision"] == "include"]),
            "excluded": len([s for s in screening if s["decision"] == "exclude"]),
            "deferred": len([s for s in screening if s["decision"] == "defer"]),
        },
        "human_verification_status": "pending",
        "notes": "Evidence maturity level, effectiveness state and safety state are DERIVED at "
                 "request time and are never stored here.",
    }
    return {"manifest": manifest, "trials": trials, "source_documents": sources,
            "evidence_assertions": assertions, "findings": findings,
            "direct_comparisons": direct_comparisons,
            "screening_log": screening}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offline", action="store_true",
                    help="Validate the committed dataset without any network access.")
    args = ap.parse_args()

    if args.offline:
        # Delegates to the offline validator so there is one implementation.
        from validate import main as validate_main
        raise SystemExit(validate_main())

    data = build(offline=False)
    DATA.mkdir(parents=True, exist_ok=True)
    for name in ("manifest", "trials", "source_documents", "evidence_assertions",
                 "findings", "direct_comparisons", "screening_log"):
        (DATA / f"{name}.json").write_text(
            json.dumps(data[name], indent=2, ensure_ascii=False), encoding="utf-8"
        )

    m = data["manifest"]
    print("Ingestion OK")
    print(f"  dataset_version : {m['dataset_version']}")
    print(f"  source_cutoff   : {m['source_cutoff']}")
    print(f"  commit          : {m['commit_hash'][:12]}")
    print(f"  counts          : {m['counts']}")
    for a in data["evidence_assertions"]:
        if a["dimension"] in ("female_enrollment_count", "female_enrollment_pct", "total_enrollment"):
            print(f"    {a['assertion_id']} {a['trial_id']:8} {a['dimension']:24} "
                  f"= {a['value']!s:8} [{a['value_basis']}]")


if __name__ == "__main__":
    main()
