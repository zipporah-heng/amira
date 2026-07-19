"""Stamp the dataset manifest with the commit that actually contains the corpus.

`ingest.py` records the commit that was checked out while it ran, which is the
commit BEFORE the regenerated dataset is committed. That makes the manifest point
at a commit that does not contain the corpus it describes.

Workflow:
    python pipeline/ingest.py
    git add -A && git commit -m "..."      # corpus is now in HEAD
    python pipeline/stamp_manifest.py      # writes that HEAD into the manifest
    git add dataset/manifest.json && git commit -m "Stamp dataset manifest provenance"

Use a FOLLOW-UP COMMIT, not `--amend`: amending rewrites the SHA, which would leave
the manifest pointing at a commit that no longer exists. After the follow-up commit,
manifest.commit_hash is the SHA of the (real) commit containing the corpus, so the
published dataset is reproducible from exactly that commit.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "dataset" / "manifest.json"


def main() -> int:
    if not MANIFEST.exists():
        print("dataset/manifest.json not found; run pipeline/ingest.py first")
        return 1
    try:
        head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
    except Exception as exc:
        print(f"could not resolve git HEAD: {exc}")
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    previous = manifest.get("commit_hash", "")
    manifest["commit_hash"] = head
    manifest["commit_hash_note"] = (
        "SHA of the commit containing this dataset. Stamped after commit by "
        "pipeline/stamp_manifest.py, then amended in."
    )
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"manifest commit_hash: {previous[:12] or '(unset)'} -> {head[:12]}")
    print("Now run: git add dataset/manifest.json && "
          "git commit -m 'Stamp dataset manifest provenance'")
    print("(Use a follow-up commit, not --amend: amending would change the SHA "
          "just stamped.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
