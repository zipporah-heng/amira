import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { OtherEvidencePaths } from "./OtherEvidencePaths";

const report = {
  query: { condition: "Heart failure", medicine: "Digoxin", life_stage: "not_specified", hormone_therapy: "any" },
  banner: { medicine: "Digoxin", drug_class: "Cardiac glycoside" },
  effectiveness: { findings: [{
    scope: "trial:DIG", significance: "significant", endpoint: "Death from any cause",
    female_estimate: "Adjusted HR 1.23", female_ci: "95% CI 1.02-1.47",
    interpretation: "A post hoc DIG analysis found a statistically significant interaction.",
    source: { url: "https://pubmed.ncbi.nlm.nih.gov/12409542/" },
  }] },
  other_evidence_paths: [{
    medicine: "Dapagliflozin", drug_class: "SGLT2 inhibitor",
    headline: "A prespecified DAPA-HF analysis reported a similar effect in women and men",
    bullets: ["1,109 women in DAPA-HF", "Formal sex interaction P = 0.67", "Menopause not reported", "DAPA-HF trial"],
    significance: "no_significant_difference",
    boundary: "This is not a head-to-head comparison or treatment recommendation.",
    source: { title: "JAMA cardiology", url: "https://pubmed.ncbi.nlm.nih.gov/33787831/", pmid: "33787831", source_type: "journal_article" },
  }],
} as unknown as EvidenceResponse;

describe("OtherEvidencePaths", () => {
  it("shows the selected medicine and Dapagliflozin as separate paths", () => {
    render(<OtherEvidencePaths report={report} />);
    expect(screen.getByText(/Another heart failure evidence path to review/i)).toBeInTheDocument();
    expect(screen.getByText("Digoxin")).toBeInTheDocument();
    expect(screen.getByText("Dapagliflozin")).toBeInTheDocument();
    expect(screen.getByText("1,109 women in DAPA-HF")).toBeInTheDocument();
  });

  it("frames it as not a ranking and not a recommendation", () => {
    render(<OtherEvidencePaths report={report} />);
    expect(screen.getByText("Not a treatment ranking")).toBeInTheDocument();
    expect(screen.getByText(/Evidence readiness is not clinical effectiveness. AMIRA does not choose a medicine./)).toBeInTheDocument();
  });
});
