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
  value_basis: "reported" | "derived" | "not_reported" | "not_located";
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
  trials_with_reported_total_enrollment?: string[];
  trials_without_reported_total_enrollment?: string[];
  participant_total_coverage?: "complete" | "incomplete";
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

export interface FeatureFlags {
  pilot_score: boolean;
  ai_extraction: boolean;
  nhanes: boolean;
}

export interface ReadinessSourceRecord {
  assertion_id?: string;
  finding_id?: string;
  trial_id?: string;
  dimension?: string;
  value?: unknown;
  value_basis?: string;
  exact_passage?: string;
  source_id: string;
  source_url: string;
  pmid?: string | null;
  nct_id?: string | null;
  source_verified?: boolean;
  human_verified?: boolean;
}

export interface ReadinessDimension {
  key: string;
  title: string;
  question: string;
  rule: string;
  state: string;
  points: number;
  max_eligible: number;
  reason: string;
  source_records: ReadinessSourceRecord[];
}

export interface Readiness {
  scored: boolean;
  status: string;
  rules_version: string;
  label?: string;
  score?: number;
  points_earned?: number;
  max_eligible_points?: number;
  denominator_note?: string;
  excluded_dimensions?: string[];
  dimensions?: ReadinessDimension[];
  reason?: string;
  disclaimer?: string;
  pilot_note?: string;
}

export interface Extraction {
  medicine: string;
  condition: string | null;
  trial_id: string;
  study_identifier: string;
  source_identifier: string;
  source_document_id: string;
  passage_id: string;
  assertion_id: string | null;
  women_represented: string;
  women_count: number | null;
  women_percentage: number | null;
  sex_specific_effectiveness: string;
  formal_sex_comparison: string;
  interaction_statistic: string | null;
  sex_specific_safety: string;
  menopause: string;
  pregnancy: string;
  hormone_therapy: string;
  hormonal_variability: string;
  race_and_ethnicity: string;
  age: string | null;
  evidence_state: string;
  exact_evidence_passage: string | null;
  source_url: string;
  extraction_model: string;
  live_model_call: boolean;
  prompt_version: string;
  schema_version: string;
  extraction_timestamp: string;
  validation_state: string;
  source_match_state: string;
  validation_notes: string | null;
  human_review_state: string;
  human_reviewer: string | null;
  provenance: {
    source_document_id: string;
    source_url: string;
    passage_index: number;
    content_hash: string;
    retrieval_date: string | null;
    match_basis: string;
  };
}

export interface ProviderConfig {
  provider: string;
  provider_label: string;
  model: string;
  is_recorded: boolean;
  live_capable: boolean;
  prompt_version: string;
  schema_version: string;
  api_key_present: boolean;
}

export interface ExtractResponse {
  question: string;
  provider: ProviderConfig;
  extraction: Extraction;
  trace: {
    trial_id: string;
    passage_id: string;
    source_document_id: string;
    exact_passage: string | null;
    source_url: string;
    model_version: string;
    live_model_call: boolean;
    prompt_version: string;
    schema_version: string;
    passage_validation: string;
    source_match_state: string;
    human_review: string;
    validation_notes: string | null;
    provenance: Extraction["provenance"];
  };
  score_impact: Readiness | null;
}

export interface AiPassage {
  passage_id: string;
  finding_id: string;
  trial_id: string;
  label: string;
  medicine: string;
  condition: string | null;
  study_identifier: string;
  source_identifier: string;
  source_document_id: string;
  source_url: string;
  passage: string;
}

export interface AiPipeline {
  enabled: boolean;
  provider: ProviderConfig;
  recorded_note: string;
  stages: { key: string; label: string; detail: string }[];
  safety: string[];
}

export interface NhanesResult {
  drug_class: string;
  ingredients_matched: string[];
  unweighted_users: number;
  unweighted_denominator: number;
  older_women_users_unweighted: number;
  suppressed: boolean;
  weighted_use_percent: number | null;
  standard_error: number | null;
  relative_standard_error: number | null;
  suppression_reason?: string;
  older_women_share_note?: string;
}

export interface NhanesContext {
  enabled?: boolean;
  available: boolean;
  status: string;
  cycle?: string;
  domain?: string;
  measure?: string;
  weight_variable?: string;
  design_variables?: { strata: string; psu: string };
  variance_method?: string;
  suppression_rule?: { min_unweighted_numerator: number; max_relative_standard_error: number; basis: string };
  age_range_years?: [number, number];
  unweighted_denominator_women?: number;
  files?: { name: string; data_url: string; documentation_url: string }[];
  retrieved_at?: string;
  usage_boundary?: string;
  result?: NhanesResult | null;
  note?: string;
}

export interface AssetItem {
  key: string;
  title: string;
  path: string;
  kind: string;
  present: boolean;
  status?: string;
}

export interface AssetsResponse {
  assets: AssetItem[];
  honest_status: string[];
  license_present: boolean;
}

export async function getAiPipeline(): Promise<AiPipeline> {
  const r = await fetch("/api/ai/pipeline");
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export async function getAiPassages(): Promise<{ passages: AiPassage[]; enabled: boolean }> {
  const r = await fetch("/api/ai/passages");
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export async function runExtraction(passageId: string): Promise<ExtractResponse> {
  const r = await fetch("/api/ai/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passage_id: passageId }),
  });
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export async function getNhanes(drugClass: string): Promise<NhanesContext> {
  const r = await fetch(`/api/nhanes?drug_class=${encodeURIComponent(drugClass)}`);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export async function getAssets(): Promise<AssetsResponse> {
  const r = await fetch("/api/assets");
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export interface StudyRecord {
  trial_id: string;
  study: string;
  year: number | string | null;
  women: string;
  women_basis: string;
  sex_outcomes: string;
  menopause: string;
  hormone_therapy: string;
  study_type: string;
  source_label: string;
  source_url: string;
  record_kind: "trial_registry_record" | "analysis_publication" | "primary_publication";
}

export interface EvidencePath {
  medicine: string;
  drug_class: string | null;
  headline: string;
  bullets: string[];
  significance: string | null;
  female_estimate?: string | null;
  female_ci?: string | null;
  ci_crosses_one?: boolean;
  interpretation_note?: string | null;
  boundary: string;
  source: { title: string; url: string; pmid: string | null; source_type: string };
}

export interface EvidenceResponse {
  studies_behind?: StudyRecord[];
  other_evidence_paths?: EvidencePath[];
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
  readiness?: Readiness | null;
  feature_flags?: FeatureFlags;
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
