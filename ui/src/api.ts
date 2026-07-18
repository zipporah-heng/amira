export type ReportedStatus = "yes" | "no" | "uncertain" | "not_reported" | "unknown";
export type EvidenceStateT = "HAS_EVIDENCE" | "NO_EVIDENCE_FOUND" | "EVIDENCE_OF_NO_EFFECT";

export interface Source {
  source_id: string;
  source_title: string;
  source_type: string;
  url: string | null;
  publication_year: number | null;
  study_design: string | null;
  nct_id: string | null;
  population: string | null;
  total_n: number | null;
  female_n: number | null;
  female_pct: number | null;
  relevant_passage: string;
  source_location: string | null;
  ai_confidence: number | null;
  human_verified: boolean;
  provenance: string;
  classification: string | null;
  classification_rationale: string | null;
}

export interface EvidenceSummary {
  female_n: number | null;
  female_pct: number | null;
  total_n: number | null;
  sex_stratified_efficacy_reported: ReportedStatus;
  sex_stratified_safety_reported: ReportedStatus;
  sex_by_treatment_interaction_tested: ReportedStatus;
  menopausal_status_reported: ReportedStatus;
  hormonal_factors_reported: ReportedStatus;
  hormone_therapy_reported: ReportedStatus;
  pregnancy_excluded: ReportedStatus;
}

export interface EvidenceReport {
  schema_version: string;
  medicine: string;
  condition: string;
  life_stage: string;
  hormonal_context: { hormone_therapy: string };
  evidence_state: EvidenceStateT;
  evidence_summary: EvidenceSummary;
  evidence_tier: string | null;
  classification: string;
  missing_fields: string[];
  sources: Source[];
  extraction_confidence: number | null;
  human_verified: boolean;
  selected_life_stage?: string;
  selected_hormone_therapy?: string;
}

export interface CheckRequest {
  medicine: string;
  condition: string;
  life_stage: string;
  hormone_therapy: string;
}

const BASE = "";

export async function checkEvidence(req: CheckRequest): Promise<EvidenceReport> {
  const res = await fetch(`${BASE}/api/check-evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(body.detail || "Request failed");
  }
  return res.json();
}

export async function getBenchmark(): Promise<any> {
  const res = await fetch(`${BASE}/api/benchmark`);
  return res.json();
}
