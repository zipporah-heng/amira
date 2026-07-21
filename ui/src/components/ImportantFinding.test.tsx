import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse, Finding } from "../api";
import { ImportantFinding } from "./ImportantFinding";

const digoxinFinding: Finding = {
  finding_id: "F-EFF-DIG-001",
  scope: "trial:DIG",
  finding_type: "efficacy",
  population_scope: "women_and_men",
  endpoint: "Death from any cause",
  female_estimate: "Adjusted HR 1.23",
  male_estimate: "Adjusted HR 0.93",
  effect_measure: "Hazard ratio vs placebo",
  female_ci: "95% CI 1.02-1.47",
  male_ci: "95% CI 0.85-1.02",
  female_rate: "33.1% digoxin vs 28.9% placebo",
  male_rate: "35.2% digoxin vs 36.9% placebo",
  comparison_test: "Adjusted sex-by-treatment interaction",
  comparison_p: "0.014",
  significance: "significant",
  interpretation: "A post hoc DIG analysis found a statistically significant interaction between sex and digoxin.",
  exact_passage: "antly higher risk of death among women (adjusted hazard ratio ... 1.23 ...",
  source_locator: "Abstract, Results",
  source_verified: true,
  human_verified: false,
  source: {
    source_id: "SRC-PMID-12409542", title: "Sex-based differences in the effect of digoxin",
    source_type: "journal_article", pmid: "12409542",
    url: "https://pubmed.ncbi.nlm.nih.gov/12409542/",
  },
};

const report = {
  banner: { medicine: "Digoxin" },
  effectiveness: { findings: [digoxinFinding] },
  safety: { significant_findings: [] },
} as unknown as EvidenceResponse;

describe("ImportantFinding", () => {
  it("derives a plain-language headline and comparison from the finding record", () => {
    render(<ImportantFinding report={report} />);
    expect(screen.getByText("About 1 in 3 women assigned digoxin died during follow-up.")).toBeInTheDocument();
    // The comparison and statistics are always shown alongside the striking figure.
    expect(screen.getByText("33.1% digoxin vs 28.9% placebo")).toBeInTheDocument();
    expect(screen.getByText("P = 0.014")).toBeInTheDocument();
    expect(screen.getByText("Adjusted HR 1.23 (95% CI 1.02-1.47)")).toBeInTheDocument();
  });

  it("shows limitations so a rate is never read as a drug-caused outcome rate", () => {
    render(<ImportantFinding report={report} />);
    expect(screen.getByText("Historical post hoc analysis")).toBeInTheDocument();
    expect(screen.getByText(/Shows an association, not proof/)).toBeInTheDocument();
    expect(screen.getByText("Not menopause-specific")).toBeInTheDocument();
  });

  it("links to the exact source", () => {
    render(<ImportantFinding report={report} />);
    const link = screen.getByText("Open source ↗").closest("a");
    expect(link).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/12409542/");
  });
});
