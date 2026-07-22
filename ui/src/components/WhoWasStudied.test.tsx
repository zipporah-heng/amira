import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WhoRow } from "../api";
import { WhoWasStudied } from "./WhoWasStudied";

function row(extra: Partial<WhoRow>): WhoRow {
  return {
    trial_id: "TX", display_name: "Test trial", nct_id: "NCT1", medicine: "TestMed",
    study_phase: "Phase 3", total_participants: null, female_n: null, female_n_basis: "not_located",
    female_pct: null, female_pct_basis: "not_located", minimum_age: "18 Years",
    sex_eligibility: "ALL", primary_endpoint: "e", indication: "i",
    registry_url: "https://clinicaltrials.gov/x", age_note: "Age eligibility only.", ...extra,
  } as WhoRow;
}

describe("WhoWasStudied evidence-state rendering", () => {
  it("shows distinct states, never collapsing all gaps into 'not reported'", () => {
    render(<WhoWasStudied rows={[row({ female_n: null, female_n_state: "not_located", female_n_basis: "not_located" })]} />);
    // not_located must render as its own label, not "not reported in reviewed sources"
    expect(screen.getAllByText(/Unclear \/ not located/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/not reported in reviewed sources/i)).toBeNull();
  });

  it("renders an unverified count as its own state, not a value", () => {
    render(<WhoWasStudied rows={[row({ female_n: null, female_n_state: "unverified", female_n_basis: "unverified" })]} />);
    expect(screen.getAllByText(/Unverified/i).length).toBeGreaterThan(0);
  });

  it("renders a verified count as a number", () => {
    render(<WhoWasStudied rows={[row({ female_n: 1109, female_n_state: "reported", female_n_basis: "reported" })]} />);
    expect(screen.getByText("1,109")).toBeInTheDocument();
  });
});
