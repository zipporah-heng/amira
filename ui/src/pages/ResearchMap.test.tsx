import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResearchMap } from "./ResearchMap";

// Blocker E: the female cell state must come from its ACTUAL basis — a derived
// percentage renders Derived, not "Reported" merely because a number exists.
function mockTrials(trials: any[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({ trials, dataset_version: "3.0.0", source_cutoff: "2026-07-18" }),
    })) as any,
  );
}

const baseTrial = (extra: Record<string, unknown>) => ({
  trial_id: "TX", display_name: "Test trial", medicine: "TestMed", drug_class: "TestClass",
  condition: "Test condition", nct_id: "NCT1", registry_url: "https://clinicaltrials.gov/x",
  female_n: null, female_n_basis: "absent", female_pct: null, female_pct_basis: "absent",
  sex_specific_efficacy_reported: "not_reported", sex_specific_safety_reported: "not_reported",
  menopause_status_reported: "not_reported", hormone_therapy_reported: "not_reported",
  pregnancy_evidence_reported: "not_reported", ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe("ResearchMap female-cell evidence state", () => {
  it("renders a DERIVED percentage as Derived, not Reported", async () => {
    mockTrials([baseTrial({ female_pct: 60, female_pct_basis: "derived" })]);
    render(<ResearchMap />);
    expect(await screen.findByText(/Derived/)).toBeInTheDocument();
    // no capital-R "Reported" label anywhere (other dims render "Not reported").
    expect(screen.queryByText(/●\s*Reported/)).toBeNull();
  });

  it("still renders a REPORTED percentage as Reported (unchanged behavior)", async () => {
    mockTrials([baseTrial({ female_pct: 46, female_pct_basis: "reported" })]);
    render(<ResearchMap />);
    expect((await screen.findAllByText(/Reported/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Derived/)).toBeNull();
  });

  it("renders a REPORTED count as Reported", async () => {
    mockTrials([baseTrial({ female_n: 1109, female_n_basis: "reported" })]);
    render(<ResearchMap />);
    expect((await screen.findAllByText(/Reported/)).length).toBeGreaterThan(0);
  });
});
