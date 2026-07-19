"""AMIRA — clearer evidence for women's health.

AMIRA audits published medical research to show whether women were represented and
whether sex-specific and hormone-relevant factors were actually analyzed or reported.
It measures evidence completeness. It does not diagnose, prescribe, or recommend
treatment.

Every number served by this package is computed from the normalized real-evidence
dataset in /dataset, built by pipeline/ingest.py from ClinicalTrials.gov, PubMed and
PubMed Central. No synthetic evidence is shipped.
"""

__all__ = ["dataset", "engine", "exports", "maturity"]
