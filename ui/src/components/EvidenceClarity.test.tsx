import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CriticalSignal, EvidenceResponse } from "../api";
import { CriticalSignalPanel, EvidenceScope, WhatRemainsUnknown } from "./EvidenceClarity";

const digoxinSignal = {
  medicine: "Digoxin", signal_type: "Mortality",
  headline: "33.1% of women assigned digoxin died during follow-up",
  summary: "28.9% placebo · Adjusted HR 1.23 · 95% CI 1.02-1.47 · Adjusted sex-by-treatment interaction P = 0.014",
  clinical_significance: "A post hoc DIG analysis reported higher mortality among women.",
  evidence_status: "Human Review Pending", source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/",
  cautions: ["Historical post hoc signal", "Not menopause-specific", "Not a treatment recommendation",
             "Does not establish an individual patient's outcome"],
} as unknown as CriticalSignal;

describe("CriticalSignalPanel (Phase 5/6)", () => {
  it("renders the Digoxin card + Why This Matters Clinically when a signal exists", () => {
    render(<CriticalSignalPanel signal={digoxinSignal} />);
    expect(screen.getByText("33.1% of women assigned digoxin died during follow-up")).toBeInTheDocument();
    expect(screen.getByText(/28.9% placebo/)).toBeInTheDocument();
    expect(screen.getByText(/95% CI 1.02-1.47/)).toBeInTheDocument();
    expect(screen.getByText("Why This Matters Clinically")).toBeInTheDocument();
    expect(screen.getByText(/found higher mortality among women assigned digoxin/i)).toBeInTheDocument();
    expect(screen.getByText(/does not by itself determine treatment for an individual patient/i)).toBeInTheDocument();
    expect(screen.getByText(/full balance of risks and benefits/i)).toBeInTheDocument();
    const link = screen.getByText("View exact passage →") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("12409542");
    // No treatment recommendation wording.
    expect((document.body.textContent || "").toLowerCase()).not.toMatch(/instead of|switch to|recommend .* alternative/);
  });

  it("renders nothing when there is no verified critical signal", () => {
    const { container } = render(<CriticalSignalPanel signal={null} />);
    expect(container.querySelector(".cs-check")).toBeNull();
  });
});

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
    expect(screen.getByText(/2 randomized studies · 1 publication/)).toBeInTheDocument();
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
