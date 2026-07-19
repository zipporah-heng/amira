"""PRODUCTION BUILD GUARD.

Fails the build if any synthetic-evidence marker survives into shipped code,
the dataset, the benchmark, or the built UI bundle.
"""

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]

# Directories that ship to production (or define what ships).
SCAN_DIRS = ["backend/amira", "backend/main.py", "pipeline", "dataset", "benchmark", "ui/src"]
BUILT_UI = REPO / "ui" / "dist"

SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__", "dist", ".pytest_cache"}
# This guard file necessarily contains the banned strings as patterns.
SKIP_FILES = {"test_no_synthetic_data.py"}

BANNED = [
    ("example.org placeholder URL", re.compile(r"example\.org", re.I)),
    ("DEMO DATA label", re.compile(r"\bDEMO[ _]DATA\b", re.I)),
    ("demo evidence fixture", re.compile(r"amira_demo_evidence", re.I)),
    ("synthetic study identifier", re.compile(r"AMIRA-DEMO-\d", re.I)),
    ("hard-coded evidence level", re.compile(r"\"evidence_level\"\s*:\s*\d", re.I)),
    ("not-validated-clinical-evidence banner", re.compile(r"NOT VALIDATED CLINICAL EVIDENCE", re.I)),
]

# Known demo-target constants from the retired synthetic dataset.
DEMO_CONSTANTS = [
    (r"\b18,?452\b", "synthetic women-studied constant"),
    (r"\b4,?125\b", "synthetic structured-studies constant"),
    (r"\b98,?742\b", "synthetic evidence-passages constant"),
    (r"\b92\.4\b", "synthetic extraction-accuracy constant"),
]


def _files():
    for rel in SCAN_DIRS:
        p = REPO / rel
        if p.is_file():
            yield p
            continue
        if not p.exists():
            continue
        for f in p.rglob("*"):
            if not f.is_file():
                continue
            if any(part in SKIP_DIRS for part in f.parts):
                continue
            if f.name in SKIP_FILES:
                continue
            if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".zip", ".ico", ".woff", ".woff2"}:
                continue
            yield f


def _read(f: Path) -> str:
    try:
        return f.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


@pytest.mark.parametrize("label,pattern", BANNED, ids=[b[0] for b in BANNED])
def test_no_synthetic_markers_in_production_sources(label, pattern):
    hits = []
    for f in _files():
        for i, line in enumerate(_read(f).splitlines(), 1):
            if pattern.search(line):
                hits.append(f"{f.relative_to(REPO)}:{i}: {line.strip()[:110]}")
    assert not hits, f"{label} found in production sources:\n" + "\n".join(hits[:20])


@pytest.mark.parametrize("pattern,label", DEMO_CONSTANTS, ids=[c[1] for c in DEMO_CONSTANTS])
def test_no_known_demo_constants(pattern, label):
    rx = re.compile(pattern)
    hits = []
    for f in _files():
        for i, line in enumerate(_read(f).splitlines(), 1):
            if rx.search(line):
                hits.append(f"{f.relative_to(REPO)}:{i}: {line.strip()[:110]}")
    assert not hits, f"{label} found in production sources:\n" + "\n".join(hits[:20])


def test_built_ui_bundle_is_clean():
    """The shipped JS/CSS bundle must contain no synthetic markers."""
    if not BUILT_UI.exists():
        pytest.skip("UI not built")
    hits = []
    for f in BUILT_UI.rglob("*"):
        if f.is_file() and f.suffix in {".js", ".css", ".html", ".json"}:
            text = _read(f)
            for label, pattern in BANNED:
                if pattern.search(text):
                    hits.append(f"{f.relative_to(REPO)}: {label}")
    assert not hits, "synthetic markers in built UI bundle:\n" + "\n".join(hits)


def test_retired_synthetic_artifacts_are_absent():
    for gone in [
        "fixtures", "amira-open-evidence-v1-demo", "ui/public/downloads",
        "ui/src/data", "scripts/generate_demo_data.py", "backend/amira/fixtures.py",
    ]:
        assert not (REPO / gone).exists(), f"retired synthetic artifact still present: {gone}"
