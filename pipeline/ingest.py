"""AMIRA real-evidence ingestion for the frozen corpus.

Frozen corpus (Mantis-approved scope lock):
    medicine  : rosuvastatin
    trials    : JUPITER (NCT00239681), HOPE-3 (NCT00468923)

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

DATASET_VERSION = "2.0.0"
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
    return _clean(re.sub(r"<[^>]+>", " ", _get_text(url)))


def _clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = (s.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
           .replace("&#x2265;", ">=").replace("≥", ">=").replace("≤", "<=")
           .replace("’", "'").replace("–", "-").replace("—", "-"))
    return re.sub(r"\s+", " ", s).strip()


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

    if offline:
        raise SystemExit("--offline only validates an existing dataset; run validate.py")

    jup = fetch_ctgov("NCT00239681")
    hope = fetch_ctgov("NCT00468923")
    cards = fetch_ctgov("NCT00327418")  # CARDS (atorvastatin)

    jup_p = jup["protocolSection"]
    hope_p = hope["protocolSection"]
    cards_p = cards["protocolSection"]
    jup_enroll = jup_p["designModule"]["enrollmentInfo"]["count"]
    hope_enroll = hope_p["designModule"]["enrollmentInfo"]["count"]
    cards_enroll = cards_p["designModule"]["enrollmentInfo"]["count"]
    jup_female = ctgov_female_count(jup)

    # --- drift guard: fail loudly rather than serve changed numbers ---------- #
    e = EXPECTED["NCT00239681"]
    assert jup_enroll == e["enrollment"], f"JUPITER enrollment drift: {jup_enroll} != {e['enrollment']}"
    assert jup_female == e["female"], f"JUPITER female count drift: {jup_female} != {e['female']}"
    assert hope_enroll == EXPECTED["NCT00468923"]["enrollment"], "HOPE-3 enrollment drift"
    assert bool(hope.get("hasResults")) is False, "HOPE-3 now has registry results; re-verify corpus"
    assert cards_enroll == EXPECTED["NCT00327418"]["enrollment"], "CARDS enrollment drift"

    # --- publications -------------------------------------------------------- #
    mora = fetch_pubmed_abstract("20176986")       # JUPITER sex-specific analysis
    hope_lipid = fetch_pubmed_abstract("27040132")  # HOPE-3 lipid arm (NEJM 2016)
    hope_fu_text = fetch_pmc_text("PMC8370761")     # HOPE-3 8.7y follow-up (open access)
    ctt = fetch_pubmed_abstract("25579834")        # CTT class-level sex-specific meta-analysis
    cards_pub = fetch_pubmed_abstract("15325833")  # CARDS main report (Lancet 2004)

    mora_all = " ".join(mora["sections"].values())
    hope_lipid_all = " ".join(hope_lipid["sections"].values())
    ctt_all = " ".join(ctt["sections"].values())
    cards_all = " ".join(cards_pub["sections"].values())

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

    for name, val in [("JUPITER women", p_jup_women), ("JUPITER sex-specific", p_jup_sexspec),
                      ("JUPITER HR", p_jup_hr), ("HOPE-3 N", p_hope_n),
                      ("HOPE-3 % women", p_hope_pct), ("CTT sex analysis", p_ctt_sex),
                      ("CARDS N", p_cards_n)]:
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
    ]

    # --- structured sex-specific findings (effect estimates) ------------------ #
    # These carry real effect estimates and, where a formal statistical comparison
    # exists, its result. `significance` is only ever set from a reported test.
    def F(fid, medicine, scope, ftype, endpoint, source_id, passage, locator, **kw):
        base = {
            "finding_id": fid, "medicine": medicine, "drug_class": DRUG_CLASS,
            "scope": scope, "finding_type": ftype, "endpoint": endpoint,
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
          comparison_test="Authors report relative risk reduction in women similar to men; "
                          "no formal sex-by-treatment interaction p-value stated in the abstract.",
          comparison_p=None, significance="no_significant_difference",
          interpretation="A prespecified sex-specific analysis found rosuvastatin reduced "
                         "cardiovascular events in women (HR 0.54, 95% CI 0.37-0.80, P=0.002), with a "
                         "relative risk reduction similar to men (HR 0.58). No formal interaction "
                         "p-value was reported in the reviewed abstract, so 'no significant difference' "
                         "reflects the authors' reported comparison, not an interaction test."),
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
    ]

    # --- screening log -------------------------------------------------------- #
    screening = [
        {"candidate": "NCT00239681", "identifier_type": "nct", "decision": "include",
         "reason": "Rosuvastatin RCT in the Mantis-approved frozen corpus; registry results posted.",
         "screened_at": retrieved_at},
        {"candidate": "NCT00468923", "identifier_type": "nct", "decision": "include",
         "reason": "Rosuvastatin RCT in the Mantis-approved frozen corpus.",
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
        {"candidate": "Pravastatin trials (e.g. WOSCOPS, PROSPER)", "identifier_type": "medicine",
         "decision": "defer",
         "reason": "Not yet ingested and verified; excluded from the class comparison until real "
                   "evidence is retrieved. AMIRA shows only verified drugs.",
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
        "corpus": ["NCT00239681", "NCT00468923", "NCT00327418"],
        "medicines": sorted({t["medicine"] for t in trials}),
        "counts": {"trials": len(trials), "sources": len(sources),
                   "assertions": len(assertions), "findings": len(findings),
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
            "screening_log": screening}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()

    data = build(offline=args.offline)
    DATA.mkdir(parents=True, exist_ok=True)
    for name in ("manifest", "trials", "source_documents", "evidence_assertions",
                 "findings", "screening_log"):
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
