"""Build the AMIRA NHANES population-context cache (reproducible, offline-safe app).

This computes reported medication-*use* prevalence among U.S. women from the
official CDC NHANES survey, with correct survey design, and writes a versioned
derived cache that the application serves. NHANES is a POPULATION CONTEXT source;
it is kept entirely separate from AMIRA's clinical-trial evidence.

What it never does
------------------
NHANES here describes *reported medication use in the surveyed population* only.
It is never used to claim a medicine caused an outcome, is effective, is safer,
is "most prescribed", or to imply a clinical-trial result or recommendation.

Method (documented in docs/nhanes-data-card.md)
-----------------------------------------------
* Cycle 2017-2018 (files DEMO_J, RXQ_RX_J).
* Domain: women (RIAGENDR==2) aged >=18 (RIDAGEYR).
* Weighted prevalence of *any reported use* of each drug class, using the
  interview weight WTINT2YR, with Taylor-linearized standard errors that respect
  the masked strata (SDMVSTRA) and PSU (SDMVPSU) design variables.
* Unweighted sample sizes are reported.
* Small/unstable cells are SUPPRESSED per an NCHS-style rule (numerator n < 30
  or relative standard error > 30%). Suppressed cells show an honest message and
  never a fabricated number.

Only ``pandas``/``numpy`` are needed, and ONLY to (re)build the cache offline.
The application (``backend/amira/nhanes.py``) reads the committed JSON with no
heavy dependencies and no network access.

Usage:
    python pipeline/nhanes_context.py            # download + compute + write cache
    python pipeline/nhanes_context.py --raw DIR  # use pre-downloaded .xpt files in DIR
"""

from __future__ import annotations

import argparse
import gzip
import io
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "dataset" / "nhanes" / "nhanes_context_v1.json"

CYCLE = "2017-2018"
CYCLE_YEAR = "2017"
BASE = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public"
FILES = {
    "DEMO_J": f"{BASE}/{CYCLE_YEAR}/DataFiles/DEMO_J.xpt",
    "RXQ_RX_J": f"{BASE}/{CYCLE_YEAR}/DataFiles/RXQ_RX_J.xpt",
}
DOC = {
    "DEMO_J": "https://wwwn.cdc.gov/Nchs/Nhanes/2017-2018/DEMO_J.htm",
    "RXQ_RX_J": "https://wwwn.cdc.gov/Nchs/Nhanes/2017-2018/RXQ_RX_J.htm",
}
RETRIEVED_AT = "2026-07-20T18:42:00Z"

# Drug classes mapped to generic ingredient names as they appear in RXDDRUG.
CLASSES = {
    "Statin": ["ATORVASTATIN", "ROSUVASTATIN", "SIMVASTATIN", "PRAVASTATIN",
               "LOVASTATIN", "FLUVASTATIN", "PITAVASTATIN"],
    "Cardiac glycoside": ["DIGOXIN", "DIGITOXIN"],
    "SGLT2 inhibitor": ["DAPAGLIFLOZIN", "CANAGLIFLOZIN", "EMPAGLIFLOZIN", "ERTUGLIFLOZIN"],
    "Angiotensin receptor blocker": ["VALSARTAN", "LOSARTAN", "OLMESARTAN", "IRBESARTAN",
                                     "CANDESARTAN", "TELMISARTAN", "AZILSARTAN", "EPROSARTAN"],
}

# NCHS-style presentation standard (documented, defensible defaults).
MIN_NUMERATOR_N = 30
MAX_RSE = 0.30


def _read_xpt(source) -> "pd.DataFrame":  # noqa: F821
    import pandas as pd
    if isinstance(source, (str, Path)):
        data = Path(source).read_bytes()
    else:
        data = source
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    return pd.read_sas(io.BytesIO(data), format="xport")


def _load(raw_dir: Path | None):
    import pandas as pd  # noqa: F401
    frames = {}
    if raw_dir:
        for key in FILES:
            frames[key] = _read_xpt(raw_dir / f"{key}.xpt")
    else:
        import requests
        for key, url in FILES.items():
            r = requests.get(url, timeout=300, headers={"User-Agent": "AMIRA-research/0.1"})
            r.raise_for_status()
            frames[key] = _read_xpt(r.content)
    return frames["DEMO_J"], frames["RXQ_RX_J"]


def _linearized_ratio_se(df, indicator_col, y_col, w_col, strata_col, psu_col) -> float:
    """Taylor-linearized SE of a domain weighted proportion p = sum(w*I*y)/sum(w*I),
    respecting stratified multistage design (strata, PSU)."""
    import numpy as np
    I = df[indicator_col].to_numpy(dtype=float)
    y = df[y_col].to_numpy(dtype=float)
    w = df[w_col].to_numpy(dtype=float)
    W = (w * I).sum()
    if W <= 0:
        return float("nan")
    p = (w * I * y).sum() / W
    # Linearized value per unit (0 outside the domain).
    u = I * w * (y - p) / W
    df = df.assign(_u=u)
    var = 0.0
    for _, stratum in df.groupby(strata_col):
        psu_tot = stratum.groupby(psu_col)["_u"].sum().to_numpy()
        n_h = len(psu_tot)
        if n_h < 2:
            continue
        var += (n_h / (n_h - 1.0)) * ((psu_tot - psu_tot.mean()) ** 2).sum()
    return float(np.sqrt(var))


def compute(raw_dir: Path | None = None) -> dict:
    import numpy as np
    demo, rx = _load(raw_dir)

    rx = rx.copy()
    rx["RXDDRUG"] = rx["RXDDRUG"].astype("string").str.strip().str.upper()

    demo = demo.copy()
    demo["adult_woman"] = ((demo["RIAGENDR"] == 2) & (demo["RIDAGEYR"] >= 18)).astype(int)
    women = demo[demo["adult_woman"] == 1]
    age_min = int(women["RIDAGEYR"].min())
    age_max = int(women["RIDAGEYR"].max())
    denom_unweighted = int(len(women))

    results = []
    for cls, names in CLASSES.items():
        users = set(rx.loc[rx["RXDDRUG"].isin(names), "SEQN"].unique())
        demo["_use"] = demo["SEQN"].isin(users).astype(int)
        num_unweighted = int(((demo["adult_woman"] == 1) & (demo["_use"] == 1)).sum())
        # Weighted prevalence among adult women (domain ratio).
        se = _linearized_ratio_se(demo, "adult_woman", "_use", "WTINT2YR",
                                  "SDMVSTRA", "SDMVPSU")
        w = demo["WTINT2YR"].to_numpy(dtype=float)
        I = demo["adult_woman"].to_numpy(dtype=float)
        y = demo["_use"].to_numpy(dtype=float)
        W = (w * I).sum()
        prev = float((w * I * y).sum() / W) if W else float("nan")
        rse = (se / prev) if prev and prev > 0 else float("inf")

        older = demo[(demo["adult_woman"] == 1) & (demo["RIDAGEYR"] >= 65) & (demo["_use"] == 1)]
        older_n = int(len(older))

        suppress = (num_unweighted < MIN_NUMERATOR_N) or (rse > MAX_RSE)
        row = {
            "drug_class": cls,
            "ingredients_matched": names,
            "unweighted_users": num_unweighted,
            "unweighted_denominator": denom_unweighted,
            "older_women_users_unweighted": older_n,
            "suppressed": suppress,
        }
        if suppress:
            row.update({
                "weighted_use_percent": None,
                "standard_error": None,
                "relative_standard_error": None,
                "suppression_reason": (
                    "Estimate not displayed because the available sample is insufficient for a stable "
                    f"population estimate (unweighted users = {num_unweighted}; NCHS-style rule requires "
                    f">= {MIN_NUMERATOR_N} and relative standard error <= {int(MAX_RSE*100)}%)."
                ),
            })
        else:
            row.update({
                "weighted_use_percent": round(prev * 100, 2),
                "standard_error": round(se * 100, 3),
                "relative_standard_error": round(rse, 3),
                "older_women_share_note": (
                    f"{older_n} of {num_unweighted} unweighted users were aged 65+."
                ),
            })
        results.append(row)

    return {
        "schema": "amira-nhanes-context-v1",
        "cycle": CYCLE,
        "domain": "Women aged 18 and older (RIAGENDR==2 and RIDAGEYR>=18)",
        "measure": "Reported use of the drug class (any prescription in RXQ_RX)",
        "weight_variable": "WTINT2YR (interview weight)",
        "design_variables": {"strata": "SDMVSTRA", "psu": "SDMVPSU"},
        "variance_method": "Taylor series linearization of a domain proportion",
        "suppression_rule": {
            "min_unweighted_numerator": MIN_NUMERATOR_N,
            "max_relative_standard_error": MAX_RSE,
            "basis": "NCHS Data Presentation Standards for Proportions (adapted).",
        },
        "age_range_years": [age_min, age_max],
        "unweighted_denominator_women": denom_unweighted,
        "files": [{"name": k, "data_url": FILES[k], "documentation_url": DOC[k]} for k in FILES],
        "retrieved_at": RETRIEVED_AT,
        "generated_by": "pipeline/nhanes_context.py",
        "cache_version": "v1",
        "results": results,
        "usage_boundary": (
            "Reported medication use in the surveyed population. NHANES is population context, "
            "separate from clinical-trial evidence. It does not indicate that a medicine caused an "
            "outcome, is effective, is safer, or is prescribed most often, and it is not a treatment "
            "recommendation."
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=None, help="directory with pre-downloaded DEMO_J.xpt / RXQ_RX_J.xpt")
    args = ap.parse_args()
    data = compute(Path(args.raw) if args.raw else None)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)} (cycle {data['cycle']}, "
          f"{len(data['results'])} classes, denom={data['unweighted_denominator_women']})")
    for r in data["results"]:
        if r["suppressed"]:
            print(f"  {r['drug_class']:30s} SUPPRESSED (n={r['unweighted_users']})")
        else:
            print(f"  {r['drug_class']:30s} {r['weighted_use_percent']}%  "
                  f"(n={r['unweighted_users']}, RSE={r['relative_standard_error']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
