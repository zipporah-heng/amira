import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { WhatToNotice } from "./WhatToNotice";

const report = {
  banner: { medicine: "Digoxin", drug_class: "Cardiac glycoside" },
  maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5" },
  effectiveness: { findings: [{
    scope: "trial:DIG", significance: "significant", endpoint: "Death from any cause",
    female_rate: "33.1% digoxin vs 28.9% placebo",
    female_estimate: "Adjusted HR 1.23", female_ci: "95% CI 1.02-1.47", comparison_p: "0.014",
    interpretation: "A post hoc DIG analysis found a statistically significant interaction.",
    source: { url: "https://pubmed.ncbi.nlm.nih.gov/12409542/" },
  }] },
  safety: { significant_findings: [] },
} as unknown as EvidenceResponse;

describe("WhatToNotice", () => {
  it("shows the concise historical finding derived from the record", () => {
    render(<WhatToNotice report={report} />);
    expect(screen.getByText("What should I notice?")).toBeInTheDocument();
    expect(screen.getByText("33.1% of women assigned digoxin died during follow-up")).toBeInTheDocument();
    expect(screen.getByText(/28.9% placebo · adjusted HR 1.23 · 95% CI 1.02-1.47/)).toBeInTheDocument();
    expect(screen.getByText(/Not menopause-specific/)).toBeInTheDocument();
  });

  it("renders the verified 2/5 maturity meter and completeness note", () => {
    const { container } = render(<WhatToNotice report={report} />);
    expect(screen.getByText("Evidence Maturity")).toBeInTheDocument();
    expect(container.querySelector(".maturity-meter")).not.toBeNull();
    expect(screen.getByLabelText(/Evidence maturity 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/This measures evidence completeness/)).toBeInTheDocument();
  });

  it("does not render a molecule or an experimental 0–100 pilot score", () => {
    const { container } = render(<WhatToNotice report={report} />);
    expect(container.querySelector(".mol-canvas")).toBeNull();
    expect(container.querySelector(".score-gauge")).toBeNull(); // pilot gauge absent
  });
});
