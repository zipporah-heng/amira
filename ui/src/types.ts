export type ReportedStatus = "yes" | "no" | "uncertain" | "not_reported";

export interface Study {
  study_id: string;
  title: string;
  medicine: string;
  condition: string;
  study_type: string;
  year: number;
  total_n: number;
  female_n: number;
  female_pct: number;
  sex_specific_efficacy_reported: ReportedStatus;
  sex_specific_safety_reported: ReportedStatus;
  sex_by_treatment_interaction: ReportedStatus;
  menopause_reported: ReportedStatus;
  perimenopause_reported: ReportedStatus;
  postmenopause_reported: ReportedStatus;
  hormone_therapy_reported: ReportedStatus;
  pregnancy_reported: ReportedStatus;
  relevant_evidence_passage: string;
  source: string;
  source_url: string;
  ai_confidence: number;
  human_verified: boolean;
  evidence_status: string;
}

export interface BenchmarkExample {
  benchmark_id: string;
  split: "development" | "validation" | "test";
  passage: string;
  female_enrollment_present: string;
  female_n: number | null;
  female_pct: number | null;
  sex_specific_efficacy: string;
  sex_specific_safety: string;
  menopause_reported: string;
  hormone_therapy_reported: string;
  citation_support: string;
  expected_abstention: boolean;
  human_label: string;
  notes: string;
}

export interface Benchmark {
  total: number;
  development: number;
  validation: number;
  held_out: number;
  fields_evaluated: string[];
  evaluation: {
    field_level_accuracy: string;
    macro_f1: string;
    citation_support_accuracy: string;
    abstention_accuracy: string;
  };
  examples: BenchmarkExample[];
}

export interface AmiraFixture {
  meta: {
    medicine: string;
    drug_class: string;
    condition: string;
    life_stage_demo: string;
    hormone_therapy_demo: string;
    evidence_level: number;
    evidence_level_label: string;
    data_label: string;
    disclaimer: string;
  };
  evidence_maturity_model: { level: number; name: string; description: string }[];
  hormonal_evidence_dimensions: string[];
  dataset_summary: {
    structured_studies: number;
    evidence_passages: number;
    human_labeled_benchmark_examples: number;
    extraction_accuracy: string;
    hormonal_evidence_dimensions: number;
    license: string;
  };
  studies: Study[];
  benchmark: Benchmark;
  research_map: {
    columns: string[];
    rows: { medicine: string; cells: ("present" | "missing" | "unclear")[] }[];
    highest_gaps: string[];
  };
}
