import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { OtherEvidencePaths } from "./OtherEvidencePaths";

const dapaPath = {
  medicine: "Dapagliflozin", drug_class: "SGLT2 inhibitor",
  headline: "A prespecified DAPA-HF analysis reported a similar effect in women (HR 0.79, 95% CI 0.59-1.06) and men (HR 0.73, 95% CI 0.63-0.85), interaction p=0.67.",
  bullets: ["1,109 women in DAPA-HF", "Women HR 0.79 (95% CI 0.59-1.06)", "Formal sex interaction P = 0.67", "Menopause not reported"],
  significance: "no_significant_difference",
  female_estimate: "HR 0.79", female_ci: "95% CI 0.59-1.06", ci_crosses_one: true,
  interpretation_note: "The estimate (HR 0.79) suggests possible benefit, but the result is statistically inconclusive: the 95% CI (0.59–1.06) crosses 1.0.",
  boundary: "This is not a head-to-head comparison or treatment recommendation.",
  source: { title: "JAMA cardiology", url: "https://pubmed.ncbi.nlm.nih.gov/33787831/", pmid: "33787831", source_type: "journal_article" },
};

// DIGOXIN selected: it carries a significant sex-specific signal, so the section
// appears and surfaces the OTHER heart-failure path (Dapagliflozin) — never Digoxin.
const digoxinReport = {
  query: { condition: "Heart failure", medicine: "Digoxin", life_stage: "not_specified", hormone_therapy: "any" },
  banner: { medicine: "Digoxin", drug_class: "Cardiac glycoside" },
  effectiveness: { findings: [{
    scope: "trial:DIG", significance: "significant", endpoint: "Death from any cause",
    female_estimate: "Adjusted HR 1.23", female_ci: "95% CI 1.02-1.47",
    interpretation: "A post hoc DIG analysis found a statistically significant interaction.",
    source: { url: "https://pubmed.ncbi.nlm.nih.gov/12409542/" },
  }] },
  safety: { significant_findings: [] },
  other_evidence_paths: [dapaPath],
} as unknown as EvidenceResponse;

// DAPAGLIFLOZIN selected: its own result is a contemporary no-significant-difference
// finding (no signal), so NO additional heart-failure path section is shown.
const dapaReport = {
  query: { condition: "Heart failure", medicine: "Dapagliflozin", life_stage: "not_specified", hormone_therapy: "any" },
  banner: { medicine: "Dapagliflozin", drug_class: "SGLT2 inhibitor" },
  effectiveness: { findings: [{
    scope: "trial:DAPA-HF", significance: "no_significant_difference",
    endpoint: "Worsening heart failure event or cardiovascular death",
    female_estimate: "HR 0.79", female_ci: "95% CI 0.59-1.06",
    interpretation: "A prespecified DAPA-HF analysis reported a similar effect in women and men.",
    source: { url: "https://pubmed.ncbi.nlm.nih.gov/33787831/" },
  }] },
  safety: { significant_findings: [] },
  // Even though Digoxin exists as another HF medicine, it must NOT be surfaced here.
  other_evidence_paths: [{ ...dapaPath, medicine: "Digoxin", drug_class: "Cardiac glycoside" }],
} as unknown as EvidenceResponse;

describe("OtherEvidencePaths — conditional on the selected medicine", () => {
  it("Digoxin selected: shows the section with Dapagliflozin, and NOT Digoxin itself", () => {
    render(<OtherEvidencePaths report={digoxinReport} />);
    expect(screen.getByText(/Another heart failure evidence path to review/i)).toBeInTheDocument();
    expect(screen.getByText("Dapagliflozin")).toBeInTheDocument();
    // Digoxin (the selected medicine) must not appear as its own alternative card.
    expect(screen.queryByText("Digoxin")).toBeNull();
    expect(screen.getByText("1,109 women in DAPA-HF")).toBeInTheDocument();
  });

  it("Dapagliflozin selected: NO additional heart-failure path section at all", () => {
    const { container } = render(<OtherEvidencePaths report={dapaReport} />);
    expect(container.querySelector(".other-paths")).toBeNull();
    expect(screen.queryByText(/Another heart failure evidence path to review/i)).toBeNull();
    expect(screen.queryByText("Digoxin")).toBeNull();
  });

  it("frames the section as not a ranking and not a recommendation (Digoxin view)", () => {
    render(<OtherEvidencePaths report={digoxinReport} />);
    expect(screen.getByText("Not a treatment ranking")).toBeInTheDocument();
    expect(screen.getByText(/Evidence readiness is not clinical effectiveness. AMIRA does not choose a medicine./)).toBeInTheDocument();
  });

  it("renders the full Dapagliflozin HR and CI without truncation (Digoxin view)", () => {
    render(<OtherEvidencePaths report={digoxinReport} />);
    const dapaCard = screen.getByText("Dapagliflozin").closest(".op-card") as HTMLElement;
    expect(dapaCard.textContent).toContain("HR 0.79");
    expect(dapaCard.textContent).toContain("0.59-1.06");
    expect(dapaCard.className).toContain("info");           // neutral, not red/green
    expect(dapaCard.className).not.toContain("warn");
  });
});
