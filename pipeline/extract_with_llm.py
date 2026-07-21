"""AMIRA-Extract CLI — run structured evidence extraction over approved passages.

The reusable AI component lives in ``backend/amira/extract.py`` (so the API and
this CLI share one implementation). This wrapper runs it over the committed
corpus passages, validates each result, and writes example extraction files.

Usage:
    python pipeline/extract_with_llm.py                 # extract all approved passages
    python pipeline/extract_with_llm.py --out examples/extractions
    AMIRA_LLM_PROVIDER=anthropic AMIRA_LLM_MODEL=claude-... \\
        AMIRA_LLM_API_KEY=... python pipeline/extract_with_llm.py

Provider selection is entirely by environment variable; the default ``recorded``
provider is offline and deterministic. No API key is ever printed or written.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from amira import extract  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Run AMIRA-Extract over approved corpus passages.")
    ap.add_argument("--out", default=str(REPO / "examples" / "extractions"),
                    help="directory to write one JSON file per extraction")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    cfg = extract.provider_config()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    passages = extract.approved_passages()
    written, verified, quarantined = 0, 0, 0
    for p in passages:
        obj = extract.extract_and_validate(p["passage"], p)
        state = obj["validation_state"]
        verified += state == "quote_verified"
        quarantined += state == "quarantined"
        path = out_dir / f"{p['passage_id']}.json"
        path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")
        written += 1
        if not args.quiet:
            print(f"  {p['passage_id']:16s} {p['medicine']:14s} -> {state}")

    if not args.quiet:
        print(f"\nprovider: {cfg['provider']} (model='{cfg['model'] or 'n/a'}', "
              f"prompt={cfg['prompt_version']}, schema={cfg['schema_version']})")
        print(f"extractions: {written} written to {out_dir.relative_to(REPO)} "
              f"({verified} quote-verified, {quarantined} quarantined)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
