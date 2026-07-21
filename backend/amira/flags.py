"""Feature flags for AMIRA's provisional / AI / population-context modules.

Every flag is read from an environment variable at request time. The default
for each flag is chosen so that the platform stays *scientifically safe* even
when every flag is left unset and no external service is configured:

  * The pilot readiness score is a deterministic calculation over the committed
    dataset (no network, no model), so it is safe to show by default.
  * AI extraction defaults to the offline ``recorded`` provider, which replays
    already-source-verified extractions from the committed corpus. No API key is
    ever required or read in the browser.
  * NHANES context is served from a committed, versioned cache file; if the file
    is absent the module reports that honestly instead of inventing a result.

Set a flag to ``0``/``false``/``off`` to hide the corresponding module.
"""

from __future__ import annotations

import os

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def _flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    v = raw.strip().lower()
    if v in _TRUE:
        return True
    if v in _FALSE:
        return False
    return default


def enable_pilot_score() -> bool:
    # OFF by default: the verified 1-5 Evidence Maturity level is the primary score.
    # The experimental 0-100 pilot score is shown only when explicitly enabled.
    return _flag("AMIRA_ENABLE_PILOT_SCORE", False)


def enable_ai_extraction() -> bool:
    return _flag("AMIRA_ENABLE_AI_EXTRACTION", True)


def enable_nhanes() -> bool:
    return _flag("AMIRA_ENABLE_NHANES", True)


def snapshot() -> dict:
    """Current flag state, surfaced to the UI so it can render honestly."""
    return {
        "pilot_score": enable_pilot_score(),
        "ai_extraction": enable_ai_extraction(),
        "nhanes": enable_nhanes(),
    }
