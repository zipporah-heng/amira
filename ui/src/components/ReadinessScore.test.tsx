import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Readiness } from "../api";
import { ReadinessScore } from "./ReadinessScore";

const scored: Readiness = {
  scored: true,
  status: "scored",
  rules_version: "0.1",
  label: "AMIRA Evidence Readiness — Pilot v0.1",
  score: 88,
  points_earned: 70,
  max_eligible_points: 80,
  denominator_note: "1 dimension(s) excluded from the denominator as not applicable: Compared.",
  excluded_dimensions: ["Compared"],
  disclaimer: "This score measures the completeness of women-specific evidence—not whether this medicine is better.",
  pilot_note: "Pilot methodology under expert review. Not a validated score.",
  dimensions: [
    { key: "compared", title: "Compared", question: "Was a formal sex-by-treatment comparison reported?",
      rule: "", state: "not_applicable", points: 0, max_eligible: 0,
      reason: "Women-only study; comparison not possible.", source_records: [] },
  ],
};

const withheld: Readiness = {
  scored: false,
  status: "not_established",
  rules_version: "0.1",
  label: "AMIRA Evidence Readiness — Pilot v0.1",
  reason: "A pilot readiness score is withheld because female-enrollment evidence was not located in the reviewed accessible sources.",
};

describe("ReadinessScore", () => {
  it("shows the pilot label, disclaimer and N/A denominator adjustment", () => {
    render(<ReadinessScore readiness={scored} maturity={null} onJumpMaturity={vi.fn()} />);
    expect(screen.getByText(/Pilot methodology under expert review/)).toBeInTheDocument();
    expect(screen.getByText(/completeness of women-specific evidence/)).toBeInTheDocument();
    expect(screen.getByText(/excluded from the denominator/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pilot readiness score 88 out of 100/)).toBeInTheDocument();
  });

  it("withholds the score honestly instead of showing 0", () => {
    render(<ReadinessScore readiness={withheld} maturity={null} onJumpMaturity={vi.fn()} />);
    expect(screen.getByText(/not established/i)).toBeInTheDocument();
    expect(screen.getByText(/was not located/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 100/)).not.toBeInTheDocument();
  });
});
