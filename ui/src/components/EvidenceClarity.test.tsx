import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { WhatRemainsUnknown } from "./EvidenceClarity";

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
