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
    headline: "A prespecified DAPA-HF analysis reported a similar effect in women (HR 0.79, 95% CI 0.59-1.06) and men (HR 0.73, 95% CI 0.63-0.85), interaction p=0.67.",
    bullets: ["1,109 women in DAPA-HF", "Women HR 0.79 (95% CI 0.59-1.06)", "Formal sex interaction P = 0.67", "Menopause not reported"],
    significance: "no_significant_difference",
    female_estimate: "HR 0.79", female_ci: "95% CI 0.59-1.06", ci_crosses_one: true,
    interpretation_note: "The estimate (HR 0.79) suggests possible benefit, but the result is statistically inconclusive: the 95% CI (0.59–1.06) crosses 1.0. Menopause-specific evidence remains limited or unavailable in the reviewed record.",
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

  it("renders the full Dapagliflozin HR and CI without truncation", () => {
    render(<OtherEvidencePaths report={report} />);
    const dapaCard = screen.getByText("Dapagliflozin").closest(".op-card") as HTMLElement;
    expect(dapaCard.textContent).toContain("HR 0.79");
    expect(dapaCard.textContent).toContain("0.59-1.06");
    expect(dapaCard.textContent).not.toMatch(/\(HR 0\.\s*$/); // never ends at "HR 0."
    expect(dapaCard.textContent).toMatch(/inconclusive/i);
  });

  it("colors Digoxin as a warning card and Dapagliflozin as neither red nor green", () => {
    const { container } = render(<OtherEvidencePaths report={report} />);
    const digoxin = screen.getByText("Digoxin").closest(".op-card") as HTMLElement;
    const dapa = screen.getByText("Dapagliflozin").closest(".op-card") as HTMLElement;
    expect(digoxin.className).toContain("warn");   // pale-red mortality signal
    expect(dapa.className).toContain("info");        // lavender, not red
    expect(dapa.className).not.toContain("warn");
    expect(container.querySelector(".op-card.green")).toBeNull(); // no green card
  });
});
