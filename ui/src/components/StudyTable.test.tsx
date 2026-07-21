import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StudyRecord } from "../api";
import { StudyTable } from "./StudyTable";

const digoxinRecords: StudyRecord[] = [
  { trial_id: "DIG", study: "DIG trial", year: "1990–1998", women: "Not located", women_basis: "not_located",
    sex_outcomes: "Reported (post hoc)", menopause: "Not reported", hormone_therapy: "Not located",
    study_type: "Phase 3 RCT", source_label: "ClinicalTrials.gov", source_url: "https://clinicaltrials.gov/study/NCT00000476",
    record_kind: "trial_registry_record" },
  { trial_id: "DIG", study: "Sex-based DIG analysis", year: 2002, women: "Not located", women_basis: "not_located",
    sex_outcomes: "Formal interaction P=0.014", menopause: "Not reported", hormone_therapy: "Not located",
    study_type: "Post hoc analysis", source_label: "The New England journal of medicine",
    source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/", record_kind: "analysis_publication" },
  { trial_id: "DECISION", study: "DECISION", year: 2026, women: "284 (28%)", women_basis: "reported",
    sex_outcomes: "Formal interaction P=0.61", menopause: "Not reported", hormone_therapy: "Not reported",
    study_type: "Phase 4 RCT", source_label: "Nature medicine",
    source_url: "https://www.nature.com/articles/s41591-026-04406-6", record_kind: "primary_publication" },
];

describe("StudyTable", () => {
  it("shows the three correct Digoxin source records", () => {
    render(<StudyTable records={digoxinRecords} />);
    expect(screen.getByText("DIG trial")).toBeInTheDocument();
    expect(screen.getByText("Sex-based DIG analysis")).toBeInTheDocument();
    expect(screen.getByText("DECISION")).toBeInTheDocument();
    expect(screen.getByText("Studies behind this result (3)")).toBeInTheDocument();
  });

  it("labels the 2002 analysis as an analysis, not a trial", () => {
    render(<StudyTable records={digoxinRecords} />);
    expect(screen.getByText("Post hoc analysis")).toBeInTheDocument();
  });

  it("never lists Dapagliflozin in the Digoxin studies table", () => {
    render(<StudyTable records={digoxinRecords} />);
    expect(screen.queryByText(/dapagliflozin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DAPA-HF/)).not.toBeInTheDocument();
  });

  it("keeps women counts source-local (DIG not located, DECISION 284)", () => {
    render(<StudyTable records={digoxinRecords} />);
    expect(screen.getAllByText("Not located").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("284 (28%)")).toBeInTheDocument();
  });
});
