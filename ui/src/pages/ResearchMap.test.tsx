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

describe("ResearchMap grouping by Health Area -> Condition -> Trial", () => {
  it("groups trials under a Health Area header and one Heart failure condition sub-header", async () => {
    mockTrials([
      baseTrial({ trial_id: "DAPA-HF", display_name: "DAPA-HF", medicine: "Dapagliflozin", drug_class: "SGLT2 inhibitor", condition: "Heart failure", health_area: "Cardiovascular", nct_id: "NCT03036124" }),
      baseTrial({ trial_id: "DIG", display_name: "DIG", medicine: "Digoxin", drug_class: "Cardiac glycoside", condition: "Heart failure", health_area: "Cardiovascular", nct_id: "NCT00000476" }),
      baseTrial({ trial_id: "DECISION", display_name: "DECISION", medicine: "Digoxin", drug_class: "Cardiac glycoside", condition: "Heart failure", health_area: "Cardiovascular", nct_id: "NCT03783429" }),
      baseTrial({ trial_id: "JUPITER", display_name: "JUPITER", medicine: "Rosuvastatin", drug_class: "Statin", condition: "Cardiovascular disease prevention", health_area: "Cardiovascular", nct_id: "NCT00239681" }),
    ]);
    render(<ResearchMap />);
    // Exactly one Cardiovascular health-area header, and one Heart failure sub-header.
    expect((await screen.findAllByText(/^Cardiovascular$/i)).length).toBe(1);
    expect(screen.getAllByText(/^Heart failure$/i).length).toBe(1);
    // All three heart-failure trials render together.
    expect(screen.getByText(/DAPA-HF — Dapagliflozin/)).toBeInTheDocument();
    expect(screen.getByText(/DIG — Digoxin/)).toBeInTheDocument();
    expect(screen.getByText(/DECISION — Digoxin/)).toBeInTheDocument();
    expect(screen.getAllByText(/Cardiac glycoside ·/).length).toBeGreaterThan(0);
  });
});
