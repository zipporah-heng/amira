import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClassComparison as ClassComparisonData } from "../api";
import { ClassComparison } from "./ClassComparison";

const data: ClassComparisonData = {
  drug_class: "Statin",
  verified_count: 2,
  scored_count: 1,
  verified_medicines: ["Atorvastatin", "Rosuvastatin"],
  ranking: {
    rankable: false,
    summary: "1 statin has a verified Evidence Maturity score; 2 statins are represented.",
    basis: "Evidence maturity only.",
  },
  sort: "evidence_maturity_desc_then_unscored",
  rows: [
    {
      medicine: "Rosuvastatin",
      drug_class: "Statin",
      maturity_level: 2,
      maturity_scorable: true,
      maturity_display: "2 / 5",
      maturity_label: "Women Analyzed",
      effectiveness_state: "Sex-specific analysis reported, statistical comparison unclear",
      safety_state: "Insufficient sex-specific safety evidence",
      key_gap: "Menopausal status not reported",
      n_trials: 2,
    },
    {
      medicine: "Atorvastatin",
      drug_class: "Statin",
      maturity_level: 0,
      maturity_scorable: false,
      maturity_display: "Not established",
      maturity_label: "Not established",
      effectiveness_state: "Insufficient sex-specific evidence",
      safety_state: "Insufficient sex-specific safety evidence",
      key_gap: "Menopausal status not reported",
      n_trials: 1,
    },
  ],
  note: "Evidence maturity does not compare effectiveness.",
  class_level_findings: [],
};

describe("ClassComparison", () => {
  it("presents a compact evidence comparison without treatment-ranking language", () => {
    render(<ClassComparison data={data} current="Rosuvastatin" />);

    expect(screen.getByRole("table", { name: "Statin women's evidence comparison" })).toBeInTheDocument();
    expect(screen.getByText("Viewing")).toBeInTheDocument();
    expect(screen.getByText("Analysis by sex reported; comparison unclear")).toBeInTheDocument();
    expect(screen.getByText("Evidence depth only")).toBeInTheDocument();
    expect(screen.getByText(/not which medicine should be prescribed/i)).toBeInTheDocument();
  });
});
