"""Validate AMIRA-Extract outputs against the schema, the exact-quote rule, and
the anti-inference guards.

Every extraction must:
  * conform to ``schema/womens_evidence_schema_v0.2.json``;
  * quote a passage that appears VERBATIM in the stored source;
  * never infer menopause from age;
  * never claim a sex comparison without a reported statistic.

Any extraction that fails is QUARANTINED (never silently accepted).

Usage:
    python pipeline/validate_extractions.py                     # validate examples/extractions/*.json
    python pipeline/validate_extractions.py path/to/dir_or_file
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from amira import extract  # noqa: E402


def _iter_files(target: Path):
    if target.is_file():
        yield target
    elif target.is_dir():
        yield from sorted(target.glob("*.json"))


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "examples" / "extractions"
    if not target.exists():
        print(f"nothing to validate: {target} does not exist")
        return 0

    total, verified, quarantined = 0, 0, 0
    failures = []
    for f in _iter_files(target):
        obj = json.loads(f.read_text(encoding="utf-8"))
        state, notes = extract.validate(obj)
        total += 1
        if state == "quote_verified":
            verified += 1
        else:
            quarantined += 1
            failures.append((f.name, notes))
        print(f"  {f.name:24s} -> {state}")

    print(f"\n{total} extraction(s): {verified} quote-verified, {quarantined} quarantined")
    if failures:
        print("\nQUARANTINED:")
        for name, notes in failures:
            print(f"  - {name}: {notes[0] if notes else ''}")
    # Quarantining is the correct outcome for bad extractions, not a script error.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
