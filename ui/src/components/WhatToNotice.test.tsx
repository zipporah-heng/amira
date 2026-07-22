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

  it("colours an adverse mortality signal (Digoxin) as a warning, not calm", () => {
    const { container } = render(<WhatToNotice report={report} />);
    expect(container.querySelector(".notice-finding.warn")).not.toBeNull();
    expect(container.querySelector(".notice-finding.calm")).toBeNull();
  });
});

describe("WhatToNotice — unscored medicine (Atorvastatin)", () => {
  const unscored = {
    banner: { medicine: "Atorvastatin", drug_class: "Statin" },
    // scorable:false -> maturity is not yet established; no numeric score exists.
    maturity: { level: 0, max_level: 5, label: "Not yet established", display: "Not yet established", scorable: false },
    effectiveness: { findings: [] },
    safety: { significant_findings: [] },
  } as unknown as EvidenceResponse;

  it("shows 'Not yet established' and NEVER a fabricated '0 / 5' score", () => {
    const { container } = render(<WhatToNotice report={unscored} />);
    const meter = container.querySelector(".maturity-meter") as SVGElement;
    expect(meter).not.toBeNull();
    // The meter communicates not-established via aria-label + a dash, not a score.
    expect(meter.getAttribute("aria-label")).toMatch(/not yet established/i);
    expect(meter.textContent || "").not.toMatch(/0\s*\/\s*5/);
    expect(container.textContent || "").toMatch(/Not yet established/);
  });
});

const rosuva = {
  banner: { medicine: "Rosuvastatin", drug_class: "Statin" },
  maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5" },
  effectiveness: { findings: [{
    scope: "trial:JUPITER", significance: "not_tested", endpoint: "First major cardiovascular event",
    female_estimate: "HR 0.54", female_ci: "95% CI 0.37-0.80", comparison_p: null, female_rate: null,
    interpretation: "A prespecified sex-specific analysis reported that rosuvastatin reduced cardiovascular events in women.",
    source: { url: "https://pubmed.ncbi.nlm.nih.gov/20176986/" },
  }] },
  safety: { significant_findings: [] },
} as unknown as EvidenceResponse;

const dapa = {
  banner: { medicine: "Dapagliflozin", drug_class: "SGLT2 inhibitor" },
  maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5" },
  effectiveness: { findings: [{
    scope: "trial:DAPA-HF", significance: "no_significant_difference",
    endpoint: "Worsening heart failure event or cardiovascular death",
    female_estimate: "HR 0.79", female_ci: "95% CI 0.59-1.06", comparison_p: "0.67", female_rate: null,
    interpretation: "A prespecified DAPA-HF analysis reported a similar effect in women and men.",
    source: { url: "https://pubmed.ncbi.nlm.nih.gov/33787831/" },
  }] },
  safety: { significant_findings: [] },
} as unknown as EvidenceResponse;

describe("WhatToNotice — Rosuvastatin card", () => {
  it("titles the beneficial JUPITER finding and shows HR 0.54 / CI, in calm green", () => {
    const { container } = render(<WhatToNotice report={rosuva} />);
    expect(screen.getByText("Rosuvastatin: fewer first major cardiovascular events reported in women in JUPITER")).toBeInTheDocument();
    expect(screen.getByText(/HR 0\.54 · 95% CI 0\.37-0\.80/)).toBeInTheDocument();
    expect(container.querySelector(".notice-finding.calm")).not.toBeNull();
    expect(container.querySelector(".notice-finding.warn")).toBeNull(); // no pink/red
    // keeps the caution
    expect(screen.getByText(/Not menopause-specific/)).toBeInTheDocument();
    expect(screen.getByText(/Does not establish an\s+individual patient's outcome/)).toBeInTheDocument();
    // no medicine-specific Digoxin copy
    expect((container.textContent || "").toLowerCase()).not.toContain("digoxin");
  });
});

describe("WhatToNotice — Dapagliflozin card", () => {
  it("titles the no-sex-difference result with HR/CI/interaction P, calm, no recommendation", () => {
    const { container } = render(<WhatToNotice report={dapa} />);
    expect(screen.getByText("Dapagliflozin: no statistically significant difference in treatment effect by sex identified")).toBeInTheDocument();
    expect(screen.getByText(/Women HR 0\.79 · 95% CI 0\.59-1\.06 · Interaction P = 0\.67/)).toBeInTheDocument();
    expect(container.querySelector(".notice-finding.calm")).not.toBeNull();
    expect(container.querySelector(".notice-finding.warn")).toBeNull();
    const text = (container.textContent || "").toLowerCase();
    expect(text).not.toContain("equally effective");
    expect(text).not.toContain("digoxin");
  });
});
