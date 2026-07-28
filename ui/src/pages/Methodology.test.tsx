import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Methodology } from "./Methodology";
import { MATURITY_ANCHOR } from "../maturityLevels";

describe("Methodology — Evidence Maturity section anchor", () => {
  it("exposes the evidence-maturity anchor the card links to", () => {
    const { container } = render(<Methodology />);
    const el = container.querySelector(`#${MATURITY_ANCHOR}`);
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("Evidence Maturity Model");
  });

  it("documents all five maturity levels", () => {
    render(<Methodology />);
    for (const name of ["Women Counted", "Women Analyzed", "Life Stage Aware",
      "Hormone Aware", "Precision Women's Evidence"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });
});
