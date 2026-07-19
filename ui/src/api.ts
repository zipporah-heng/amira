export interface SourceLink {
  source_id: string;
  title: string;
  source_type: string;
  publisher?: string | null;
  year?: number | null;
  nct_id?: string | null;
  pmid?: string | null;
  pmcid?: string | null;
  url: string;
  license_note?: string | null;
}

export interface AssertionView {
  assertion_id: string;
  trial_id: string;
  dimension: string;
  value: unknown;
  value_basis: "reported" | "derived" | "not_reported";
  exact_passage: string;
  source_locator?: string | null;
  source_verified: boolean;
  human_verified: boolean;
  verifier?: string | null;
  notes?: string;
  source: SourceLink;
}

export interface TrialRow {
  trial_id: string;
  display_name: string;
  nct_id: string;
  year: number | null;
  study_type: string;
  total_enrollment: number;
  female_n: number | null;
  female_n_basis: string;
  female_pct: number | null;
  female_pct_basis: string;
  registry_url: string;
  minimum_age?: string | null;
  assertions: AssertionView[];
  sex_specific_efficacy_reported: string;
  sex_specific_safety_reported: string;
  menopause_status_reported: string;
  hormone_therapy_reported: string;
  pregnancy_evidence_reported: string;
}

export interface DimensionSummary {
  dimension: string;
  title: string;
  subtitle: string;
  n_reporting: number;
  n_trials: number;
  display: string;
  supporting_assertions: AssertionView[];
  non_reporting_assertions: AssertionView[];
}

export interface Totals {
  trials: number;
  participants_total: number;
  participants_basis: string;
  women_reported_count: number;
  women_reported_basis: string;
  trials_with_reported_female_count: string[];
  trials_with_percentage_only: string[];
  women_estimated_total: number;
  women_estimated_basis: string;
  women_estimate_components: {
    trial_id: string; reported_pct: number; total_enrollment: number;
    derived_count: number; note: string;
  }[];
  women_pct_of_participants: number | null;
  women_pct_basis: string;
  count_basis_warning: string | null;
}

export interface Maturity {
  level: number;
  label: string;
  description: string;
  max_level: number;
  derived: boolean;
  derivation_note: string;
  rule_trace: { level: number; label: string; satisfied: boolean; awarded: boolean; requirement: string }[];
}

export interface ContextBlock {
  selected: string;
  status: string;
  supported: boolean;
  message: string;
  inference_policy?: string;
  age_eligibility_facts?: { trial_id: string; minimum_age: string | null; sex_eligibility: string | null; registry_url: string }[];
}

export interface EvidenceResponse {
  dataset_version: string;
  source_cutoff: string;
  commit_hash: string;
  generated_at: string;
  human_verification_status: string;
  query: { condition: string; medicine: string; life_stage: string; hormone_therapy: string };
  supported: boolean;
  bounded_response: { status: string; message: string; supported_medicines?: string[] } | null;
  maturity: Maturity | null;
  totals: Totals | null;
  dimensions: DimensionSummary[];
  trials: TrialRow[];
  life_stage_context?: ContextBlock;
  hormone_therapy_context?: ContextBlock;
  sources: SourceLink[];
  evaluation_status?: string;
}

export interface CheckRequest {
  condition: string;
  medicine: string;
  life_stage: string;
  hormone_therapy: string;
}

export async function checkEvidence(req: CheckRequest): Promise<EvidenceResponse> {
  const res = await fetch("/api/check-evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function getBenchmark(): Promise<any> {
  const res = await fetch("/api/benchmark");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/** Study-type volumes for the "Evidence at a glance" donut, derived from trials. */
export function studyTypeBuckets(trials: TrialRow[]) {
  const colors: Record<string, string> = {
    "Randomized Controlled Trial": "#2c8a6b",
    "Observational Study": "#3f74c9",
    "Post-hoc Analysis": "#c68a1e",
    "Meta-analysis": "#7c53e0",
  };
  const map = new Map<string, number>();
  for (const t of trials) map.set(t.study_type, (map.get(t.study_type) || 0) + 1);
  return [...map.entries()].map(([type, count]) => ({
    type: type + (count === 1 ? "" : "s"),
    count,
    color: colors[type] || "#7c53e0",
  }));
}
