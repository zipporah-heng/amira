import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidencePath } from "../api";
import { OtherEvidencePaths } from "./OtherEvidencePaths";

const paths: EvidencePath[] = [{
  medicine: "Dapagliflozin",
  drug_class: "SGLT2 inhibitor",
  headline: "A prespecified DAPA-HF analysis reported a similar effect in women and men",
  bullets: ["DAPA-HF: 4,744 participants", "1,109 women (23.4%)", "Women HR 0.79 (95% CI 0.59-1.06)",
            "Men HR 0.73 (95% CI 0.63-0.85)", "Sex-by-treatment interaction P = 0.67"],
  significance: "no_significant_difference",
  boundary: "This is not a head-to-head comparison or treatment recommendation.",
  source: { title: "JAMA cardiology", url: "https://pubmed.ncbi.nlm.nih.gov/33787831/", pmid: "33787831", source_type: "journal_article" },
}];

describe("OtherEvidencePaths", () => {
  it("frames Dapagliflozin as a separate evidence path with the DAPA-HF numbers", () => {
    render(<OtherEvidencePaths paths={paths} condition="Heart failure" />);
    expect(screen.getByText(/Another heart failure evidence path to review/i)).toBeInTheDocument();
    expect(screen.getByText("Dapagliflozin")).toBeInTheDocument();
    expect(screen.getByText("1,109 women (23.4%)")).toBeInTheDocument();
    expect(screen.getByText("Sex-by-treatment interaction P = 0.67")).toBeInTheDocument();
  });

  it("shows the not-a-head-to-head boundary and 'Not a treatment ranking' tag", () => {
    render(<OtherEvidencePaths paths={paths} condition="Heart failure" />);
    expect(screen.getByText("This is not a head-to-head comparison or treatment recommendation.")).toBeInTheDocument();
    expect(screen.getByText("Not a treatment ranking")).toBeInTheDocument();
  });
});
