import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { EvidenceScope, WhatRemainsUnknown } from "./EvidenceClarity";

describe("EvidenceScope (Phase 7)", () => {
  const report = {
    study_selection: { rcts_for_selected_medicine: 2, publications_for_selected_medicine: 1 },
    effectiveness: { findings: [{}] },
    safety: { significant_findings: [{}], trend_findings: [], other_findings: [] },
    source_cutoff: "2026-07-18", human_verification_status: "pending",
  } as unknown as EvidenceResponse;

  it("shows bounded scope with no global completeness claim and a pending human-review badge", () => {
    render(<EvidenceScope report={report} />);
    expect(screen.getByText(/Guideline-level coverage review not yet completed/)).toBeInTheDocument();
    expect(screen.getByText(/2 evidence records · 1 publication/)).toBeInTheDocument();
    expect(screen.getByText("2026-07-18")).toBeInTheDocument();
    expect(screen.getByText("Human review pending")).toBeInTheDocument();
    expect((document.body.textContent || "")).not.toMatch(/All relevant studies reviewed/i);
  });
});

describe("WhatRemainsUnknown (Phase 8)", () => {
  const report = {
    evidence_gaps: [
      { dimension: "menopause_status_reported", label: "Menopause status", n_reporting: 0, n_trials: 2, statement: "x" },
      { dimension: "sex_specific_effectiveness", label: "Sex-specific effectiveness", n_reporting: 2, n_trials: 2, statement: "y" },
    ],
  } as unknown as EvidenceResponse;

  it("lists gaps with canonical reported / not-reported chips", () => {
    render(<WhatRemainsUnknown report={report} />);
    expect(screen.getByText("Menopause status")).toBeInTheDocument();
    expect(screen.getByText(/Not reported in 2 reviewed trials/)).toBeInTheDocument();
    expect(screen.getByText(/Reported in 2 of 2/)).toBeInTheDocument();
  });
});
