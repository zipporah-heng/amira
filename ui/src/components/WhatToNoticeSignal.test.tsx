import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CriticalSignal, EvidenceResponse } from "../api";
import { WhatToNotice } from "./WhatToNotice";

/** Part A — the Digoxin mortality signal is presented ONCE, consolidated inside the
 *  "What should I notice?" card (no separate standalone pink panel). */

const digoxinReport = {
  banner: { medicine: "Digoxin", drug_class: "Cardiac glycoside" },
  maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5" },
  effectiveness: { findings: [] },
  safety: { significant_findings: [] },
} as unknown as EvidenceResponse;

const digoxinSignal = {
  medicine: "Digoxin",
  signal_type: "Mortality",
  headline: "33.1% of women assigned digoxin died during follow-up",
  summary: "28.9% placebo · Adjusted HR 1.23 · 95% CI 1.02-1.47 · Adjusted sex-by-treatment interaction P = 0.014",
  evidence_status: "Human Review Pending",
  source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/",
  cautions: ["Historical post hoc signal", "Not menopause-specific",
             "Not a treatment recommendation", "Does not establish an individual patient's outcome"],
  why_matters: "A historical analysis found higher mortality among women assigned digoxin. This signal should not be missed, but it does not by itself determine treatment for an individual patient.",
} as unknown as CriticalSignal;

describe("WhatToNotice — consolidated Digoxin signal (Part A)", () => {
  it("shows the signal badges, headline, statistics, cautions and exact-passage link once", () => {
    const { container } = render(<WhatToNotice report={digoxinReport} signal={digoxinSignal} />);
    // "What should I notice?" appears exactly once.
    expect(screen.getAllByText("What should I notice?")).toHaveLength(1);
    // Badges.
    expect(screen.getByText("Mortality Signal")).toBeInTheDocument();
    expect(screen.getByText("Human Review Pending")).toBeInTheDocument();
    expect(screen.getByText("Historical Post Hoc Signal")).toBeInTheDocument();
    // Headline appears exactly once in the primary summary.
    expect(screen.getAllByText("33.1% of women assigned digoxin died during follow-up")).toHaveLength(1);
    // Statistics + cautions preserved.
    expect(screen.getByText(/28.9% placebo/)).toBeInTheDocument();
    expect(screen.getByText(/95% CI 1.02-1.47/)).toBeInTheDocument();
    expect(screen.getByText(/Not menopause-specific/)).toBeInTheDocument();
    // View exact passage.
    const link = screen.getByText("View exact passage →") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("12409542");
  });

  it("renders 'Why does this matter?' with the complete bounded explanation", () => {
    render(<WhatToNotice report={digoxinReport} signal={digoxinSignal} />);
    expect(screen.getByText("Why does this matter?")).toBeInTheDocument();
    expect(screen.getByText(/found higher mortality among women assigned digoxin/i)).toBeInTheDocument();
    expect(screen.getByText(/full balance of risks and benefits/i)).toBeInTheDocument();
  });

  it("keeps the Evidence Maturity card and shows NO standalone signal panel", () => {
    const { container } = render(<WhatToNotice report={digoxinReport} signal={digoxinSignal} />);
    expect(screen.getByText("Evidence Maturity")).toBeInTheDocument();
    expect(container.querySelector(".maturity-meter")).not.toBeNull();
    // The old standalone pink critical-signal panel class must be gone.
    expect(container.querySelector(".cs-check")).toBeNull();
    // The consolidated signal renders inside the single notice card.
    expect(container.querySelectorAll(".notice-card")).toHaveLength(1);
    expect(container.querySelector(".notice-finding.warn")).not.toBeNull();
  });

  it("shows no recommendation / switch language", () => {
    const { container } = render(<WhatToNotice report={digoxinReport} signal={digoxinSignal} />);
    const text = (container.textContent || "").toLowerCase();
    expect(text).not.toMatch(/instead of|switch to|recommend .* alternative/);
  });
});
