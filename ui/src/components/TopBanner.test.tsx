import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Banner, ContextBlock, Totals } from "../api";
import { TopBanner } from "./TopBanner";

const banner: Banner = {
  medicine: "Rosuvastatin",
  drug_class: "Statin",
  indication: "Cardiovascular disease prevention",
  maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5", scorable: true },
  effectiveness: { state: "Sex-specific analysis reported, statistical comparison unclear", headline: "" },
  safety: { state: "Insufficient sex-specific safety evidence", headline: "" },
  class_comparison: {
    drug_class: "Statin",
    verified_count: 2,
    this_rank: "",
    summary: "Two statins represented",
  },
  why_this_result: "Women were counted and analyzed, while important reporting gaps remain.",
};

const totals: Totals = {
  trials: 2,
  participants_total: 30507,
  participants_basis: "reported",
  women_reported_count: 6801,
  women_reported_basis: "reported",
  trials_with_reported_female_count: ["jupiter"],
  trials_with_percentage_only: ["hope3"],
  women_estimated_total: 0,
  women_estimated_basis: "not_used",
  women_estimate_components: [],
  women_pct_of_participants: null,
  women_pct_basis: "mixed",
  count_basis_warning: null,
};

const lifeStage: ContextBlock = {
  selected: "menopause_postmenopause",
  status: "not_established_in_corpus",
  supported: false,
  message: "Menopausal status was not reported.",
  trials_reporting_menopausal_status: [],
};

const hormoneTherapy: ContextBlock = {
  selected: "any",
  status: "no_filter_applied",
  supported: true,
  message: "Hormone therapy use was not reported.",
  trials_reporting_hormone_therapy: [],
};

describe("TopBanner", () => {
  it("puts the selected life-stage evidence near the headline result", () => {
    render(
      <TopBanner
        banner={banner}
        totals={totals}
        lifeStage={lifeStage}
        hormoneTherapy={hormoneTherapy}
        onJump={vi.fn()}
      />,
    );

    expect(screen.getByText("6,801")).toBeInTheDocument();
    expect(screen.getByText("Menopause / Postmenopause")).toBeInTheDocument();
    expect(screen.getByText("AMIRA never infers menopausal status from age.")).toBeInTheDocument();
    expect(screen.getByText("Not represented")).toBeInTheDocument();
    expect(screen.getByText("Not reported")).toBeInTheDocument();
    expect(screen.getByText("2 statins to review")).toBeInTheDocument();
  });
});
