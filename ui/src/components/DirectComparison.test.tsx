import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DirectComparison as DirectComparisonData } from "../api";
import { DirectComparison } from "./DirectComparison";

const data: DirectComparisonData = {
  comparison_id: "CMP-HAYOZ-001",
  trial_id: "HAYOZ-2012",
  medicine: "Valsartan",
  comparator: "Amlodipine",
  medicine_regimen: "Valsartan-based regimen",
  comparator_regimen: "Amlodipine-based regimen",
  population: "Postmenopausal women with hypertension",
  duration: "38 weeks",
  headline: "Both regimens reached similar blood pressure targets. Side effects differed.",
  clinical_boundary: "This is evidence from one study, not a prescribing recommendation. It does not establish that either medicine is better for every patient.",
  regimen_note: "Hydrochlorothiazide could be added in either group.",
  limitations: ["Single-center study"],
  outcomes: [
    {
      outcome_type: "effectiveness",
      endpoint: "Reached target office blood pressure",
      medicine_value: "71.7%",
      comparator_value: "71.4%",
      comparison_test: "Between-group comparison",
      comparison_p: "Not significant",
      interpretation: "Target attainment was similar.",
    },
    {
      outcome_type: "safety",
      endpoint: "Peripheral edema",
      medicine_value: "14.3%",
      comparator_value: "77.4%",
      comparison_test: "Between-group comparison",
      comparison_p: "P < 0.001",
      interpretation: "Edema was reported more often with the amlodipine-based regimen.",
    },
  ],
  exact_passage: "Primary source passage",
  source_locator: "Results",
  source_verified: true,
  human_verified: false,
  source: {
    source_id: "SRC-PMC8108841",
    title: "Study title",
    source_type: "journal_article",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8108841/",
  },
};

describe("DirectComparison", () => {
  it("separates effectiveness from side effects and keeps the prescribing boundary", () => {
    render(<DirectComparison data={data} />);

    expect(screen.getByText("Postmenopausal women with hypertension")).toBeInTheDocument();
    expect(screen.getByText("71.7%")).toBeInTheDocument();
    expect(screen.getByText("77.4%")).toBeInTheDocument();
    expect(screen.getByText("Life stage reported")).toBeInTheDocument();
    expect(screen.getByText(/not a prescribing recommendation/i)).toBeInTheDocument();
  });
});
