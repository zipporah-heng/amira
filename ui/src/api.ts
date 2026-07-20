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
  nct_id: string | null;
  year: number | null;
  study_type: string;
  total_enrollment: number;
  female_n: number | null;
  female_n_basis: string;
  female_pct: number | null;
  female_pct_basis: string;
  registry_url: string;
  source_label?: string;
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
  trials_without_female_count_or_percentage?: string[];
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
  scorable?: boolean;
  status?: string;
  display?: string;
  unscored_reason?: string | null;
  label: string;
  description: string;
  max_level: number;
  derived: boolean;
  derivation_note: string;
  rule_trace: {
    level: number; label: string; satisfied: boolean; awarded: boolean; requirement: string;
    evidence?: { trial_id: string; dimension: string; value: unknown; value_basis: string; passage: string; source_url: string; pmid?: string | null; nct_id?: string | null }[];
  }[];
}

export interface ContextBlock {
  selected: string;
  status: string;
  supported: boolean;
  message: string;
  inference_policy?: string;
  trials_reporting_menopausal_status?: string[];
  trials_reporting_hormone_therapy?: string[];
  age_eligibility_facts?: { trial_id: string; minimum_age: string | null; sex_eligibility: string | null; registry_url: string }[];
}

export interface Finding {
  finding_id: string;
  scope: string;
  finding_type: "efficacy" | "safety";
  population_scope?: "women_and_men" | "women_only_life_stage";
  reporting_scope?: "women_and_men_separate" | "women_only_narrative";
  endpoint: string;
  female_estimate: string | null;
  male_estimate: string | null;
  effect_measure: string | null;
  female_ci: string | null;
  male_ci: string | null;
  female_rate: string | null;
  male_rate: string | null;
  comparison_test: string | null;
  comparison_p: string | null;
  significance: "significant" | "no_significant_difference" | "trend_only" | "not_tested";
  interpretation: string;
  exact_passage: string;
  source_locator: string | null;
  source_verified: boolean;
  human_verified: boolean;
  source: SourceLink;
}

export interface EffectivenessState {
  dimension: string;
  state: string;
  evidence_level?: string;
  headline: string;
  n_reporting: number;
  n_trials: number;
  caveat: string;
  findings: Finding[];
  class_level_findings?: Finding[];
  class_level_note?: string | null;
  derived: boolean;
}

export interface SafetyState {
  dimension: string;
  state: string;
  headline: string;
  n_reporting: number;
  n_trials: number;
  caveat: string;
  significant_findings: Finding[];
  trend_findings: Finding[];
  other_findings: Finding[];
  derived: boolean;
}

export interface ClassRow {
  medicine: string;
  drug_class: string;
  maturity_level: number;
  maturity_scorable: boolean;
  maturity_display: string;
  maturity_label: string;
  effectiveness_state: string;
  safety_state: string;
  key_gap: string;
  n_trials: number;
}

export interface ClassComparison {
  drug_class: string;
  verified_count: number;
  scored_count: number;
  verified_medicines: string[];
  ranking: { rankable: boolean; summary: string; basis: string };
  sort: string;
  rows: ClassRow[];
  note: string;
  class_level_findings: Finding[];
}

export interface WhoRow {
  trial_id: string;
  display_name: string;
  nct_id: string | null;
  medicine: string;
  study_phase: string | null;
  total_participants: number;
  female_n: number | null;
  female_n_basis: string;
  female_pct: number | null;
  female_pct_basis: string;
  minimum_age: string | null;
  sex_eligibility: string | null;
  primary_endpoint: string | null;
  indication: string | null;
  registry_url: string;
  source_label?: string;
  age_note: string;
}

export interface Banner {
  medicine: string;
  drug_class: string;
  indication: string | null;
  maturity: { level: number; max_level: number; label: string; display?: string; scorable?: boolean };
  effectiveness: { state: string; headline: string; evidence_level?: string };
  safety: { state: string; headline: string };
  class_comparison: { drug_class: string; verified_count: number; scored_count?: number; this_rank: string; summary: string; basis?: string; rankable?: boolean };
  why_this_result: string;
}

export interface EvidenceGap {
  dimension: string;
  label: string;
  n_reporting: number;
  n_trials: number;
  statement: string;
}

export interface DirectComparisonOutcome {
  outcome_type: "effectiveness" | "safety";
  endpoint: string;
  medicine_value: string;
  comparator_value: string;
  comparison_test: string;
  comparison_p: string;
  interpretation: string;
}

export interface DirectComparison {
  comparison_id: string;
  trial_id: string;
  medicine: string;
  comparator: string;
  medicine_regimen: string;
  comparator_regimen: string;
  population: string;
  duration: string;
  headline: string;
  clinical_boundary: string;
  regimen_note: string;
  limitations: string[];
  outcomes: DirectComparisonOutcome[];
  exact_passage: string;
  source_locator: string;
  source_verified: boolean;
  human_verified: boolean;
  source: SourceLink;
}

export interface StudySelection {
  candidate_records_screened: number;
  evidence_sources_included: number;
  records_excluded: number;
  records_deferred: number;
  unique_phase3_rcts_identified: number;
  trial_registry_records_included: number;
  randomized_studies_in_corpus: number;
  randomized_studies_for_selected_medicine: number;
  publications_included: number;
  rcts_for_selected_medicine: number;
  publications_for_selected_medicine: number;
  medicine: string;
  reconciliation: string;
}

export interface EvidenceResponse {
  banner?: Banner;
  study_selection?: StudySelection;
  effectiveness?: EffectivenessState;
  safety?: SafetyState;
  class_comparison?: ClassComparison;
  direct_comparisons?: DirectComparison[];
  who_was_studied?: WhoRow[];
  evidence_gaps?: EvidenceGap[];
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
