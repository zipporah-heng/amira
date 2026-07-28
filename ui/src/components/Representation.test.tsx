import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { Representation } from "./Representation";

const base = {
  totals: { women_reported_count: 6801 },
  dimensions: [
    { dimension: "menopause_status_reported", n_reporting: 0 },
    { dimension: "hormone_therapy_reported", n_reporting: 0 },
  ],
  effectiveness: { state: "No statistically significant sex difference identified", findings: [] },
  safety: { state: "Reported by sex, no formal between-sex comparison" },
  trials: [{ minimum_age: "50 Years" }],
} as unknown as EvidenceResponse;

describe("Representation (redesigned cards)", () => {
  it("renders exactly seven dimension cards, each with a status pill", () => {
    const { container } = render(<Representation report={base} />);
    expect(screen.getByText("How were women represented?")).toBeInTheDocument();
    expect(container.querySelectorAll(".rep-cell").length).toBe(7);
    expect(container.querySelectorAll(".rep-pill").length).toBe(7);
    expect(container.querySelectorAll(".rep-cell-icon").length).toBe(7);
    ["Women included", "Sex-specific outcomes", "Sex-specific safety", "Menopause",
     "Hormone therapy", "Older women", "Race and ethnicity"].forEach((t) =>
      expect(screen.getByText(t)).toBeInTheDocument());
  });

  it("derives each pill tone from the REAL evidence state (not hardcoded)", () => {
    const { container } = render(<Representation report={base} />);
    // women reported -> green YES pill
    const women = screen.getByText("Women included").closest(".rep-cell") as HTMLElement;
    expect(women.querySelector(".rep-pill.yes")).not.toBeNull();
    // menopause not reported -> pink "missing" pill
    const meno = screen.getByText("Menopause").closest(".rep-cell") as HTMLElement;
    expect(meno.querySelector(".rep-pill.missing")).not.toBeNull();

    // Flip women to zero -> the same card becomes a "missing" pill (dynamic).
    const noWomen = { ...base, totals: { women_reported_count: 0 } } as unknown as EvidenceResponse;
    const { container: c2 } = render(<Representation report={noWomen} />);
    const women2 = [...c2.querySelectorAll(".rep-cell")].find((el) => el.textContent?.includes("Women included")) as HTMLElement;
    expect(women2.querySelector(".rep-pill.yes")).toBeNull();
    expect(women2.querySelector(".rep-pill.missing")).not.toBeNull();
  });

  // Consistency guard (Mounjaro-style): when female participation is stored as a
  // PERCENTAGE (no reported count) — or via a verified sex-specific analysis / the
  // Women-Counted maturity level — 'Women included' must NOT resolve to Not reported.
  it("shows Women included = Yes when only a female percentage / analysis is stored", () => {
    const pctOnly = {
      totals: { women_reported_count: 0, women_estimated_total: 996, women_pct_of_participants: 53 },
      dimensions: [
        { dimension: "menopause_status_reported", n_reporting: 0 },
        { dimension: "hormone_therapy_reported", n_reporting: 0 },
      ],
      maturity: { rule_trace: [{ level: 1, satisfied: true }, { level: 2, satisfied: true }] },
      effectiveness: { state: "Sex-specific analysis reported, statistical comparison unclear", findings: [{}] },
      safety: { state: "Sex-specific safety signal reported", significant_findings: [], other_findings: [{}] },
      trials: [{ minimum_age: "18 Years" }],
    } as unknown as EvidenceResponse;
    const { container } = render(<Representation report={pctOnly} />);
    const women = [...container.querySelectorAll(".rep-cell")].find((el) => el.textContent?.includes("Women included")) as HTMLElement;
    expect(women.querySelector(".rep-pill.yes")).not.toBeNull();
    expect(women.querySelector(".rep-pill.missing")).toBeNull();
    expect(women.textContent).not.toContain("Not reported");
    expect(women.textContent).toContain("53%");
  });
});
