import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrialRow } from "../api";
import { SourceDrawer } from "./SourceDrawer";

// Blocker A/E: the Source Drawer must NEVER present an untrusted value as evidence.
function trial(assertions: any[], extra: Partial<TrialRow> = {}): TrialRow {
  return {
    trial_id: "TX", display_name: "Test trial", nct_id: "NCT00000009", year: 2020,
    study_type: "Randomized Controlled Trial", total_enrollment: null,
    female_n: null, female_n_basis: "unverified", female_pct: null, female_pct_basis: "unverified",
    registry_url: "https://clinicaltrials.gov/study/NCT00000009", minimum_age: "18 Years",
    assertions: assertions as any,
    sex_specific_efficacy_reported: "not_reported", sex_specific_safety_reported: "not_reported",
    menopause_status_reported: "not_reported", hormone_therapy_reported: "not_reported",
    pregnancy_evidence_reported: "not_reported", ...extra,
  } as TrialRow;
}

const src = { source_id: "S1", title: "Src", source_type: "trial_registry_record", url: "https://clinicaltrials.gov/x" };

describe("SourceDrawer fail-closed rendering", () => {
  it("does not render an unverified value (777) as evidence", () => {
    const t = trial([{
      assertion_id: "a1", trial_id: "TX", dimension: "female_enrollment_count",
      value: 777, value_basis: "reported", trusted: false, evidence_state: "unverified",
      trusted_value: null, invalid_reason: "source not verified", exact_passage: "p",
      source_verified: false, human_verified: false, source: src,
    }]);
    render(<SourceDrawer trial={t} onClose={() => {}} />);
    // The raw 777 is never shown as the assertion's value; the state label is shown.
    expect(screen.queryByText("777")).toBeNull();
    expect(screen.getAllByText(/Unverified/i).length).toBeGreaterThan(0);
  });

  it("does not render a conflicting first value (500) as evidence", () => {
    const t = trial([
      { assertion_id: "a1", trial_id: "TX", dimension: "female_enrollment_count", value: 500,
        value_basis: "reported", trusted: false, evidence_state: "conflict", trusted_value: null,
        exact_passage: "p", source_verified: true, human_verified: false, source: src },
      { assertion_id: "a2", trial_id: "TX", dimension: "female_enrollment_count", value: 999,
        value_basis: "reported", trusted: false, evidence_state: "conflict", trusted_value: null,
        exact_passage: "p", source_verified: true, human_verified: false, source: src },
    ]);
    render(<SourceDrawer trial={t} onClose={() => {}} />);
    expect(screen.queryByText("500")).toBeNull();
    expect(screen.queryByText("999")).toBeNull();
    expect(screen.getAllByText(/Conflicting/i).length).toBeGreaterThan(0);
  });

  it("still renders a verified value normally", () => {
    const t = trial([{
      assertion_id: "a1", trial_id: "TX", dimension: "female_enrollment_count", value: 6801,
      value_basis: "reported", trusted: true, evidence_state: "reported", trusted_value: 6801,
      exact_passage: "p", source_verified: true, human_verified: false, source: src,
    }], { female_n: 6801, female_n_basis: "reported" });
    render(<SourceDrawer trial={t} onClose={() => {}} />);
    expect(screen.getAllByText(/6801|6,801/).length).toBeGreaterThan(0);
  });
});
