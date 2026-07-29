import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { Representation } from "./Representation";

/** "How were women represented?" renders the canonical evidence fields, deriving every
 *  state from the shared evidence model — never hard-coded, never inferred. */

const base = {
  totals: { women_reported_count: 6801, women_estimated_total: 6801, women_pct_of_participants: 38.2 },
  dimensions: [
    { dimension: "menopause_status_reported", n_reporting: 0 },
    { dimension: "hormone_therapy_reported", n_reporting: 0 },
    { dimension: "pregnancy_evidence_reported", n_reporting: 0 },
  ],
  maturity: { level: 2, max_level: 5, scorable: true,
    rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, satisfied: n <= 2 })) },
  effectiveness: { state: "No statistically significant sex difference identified", findings: [] },
  safety: { state: "Reported by sex, no formal between-sex comparison" },
  trials: [{ minimum_age: "50 Years" }],
} as unknown as EvidenceResponse;

const cellFor = (c: HTMLElement, title: string) =>
  [...c.querySelectorAll(".rep-cell")].find((el) => el.textContent?.includes(title)) as HTMLElement;

describe("How were women represented?", () => {
  it("renders every canonical representation field with a status pill", () => {
    const { container } = render(<Representation report={base} />);
    expect(screen.getByText("How were women represented?")).toBeInTheDocument();
    const fields = ["Women included", "Sex-specific outcomes", "Sex-specific safety", "Menopause",
      "Hormone therapy", "Pregnancy", "Older women or age reporting", "Race and ethnicity"];
    fields.forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(container.querySelectorAll(".rep-cell").length).toBe(fields.length);
    expect(container.querySelectorAll(".rep-pill").length).toBe(fields.length);
    expect(container.querySelectorAll(".rep-cell-icon").length).toBe(fields.length);
  });

  it("derives each pill tone from the REAL evidence state (not hardcoded)", () => {
    const { container } = render(<Representation report={base} />);
    expect(cellFor(container, "Women included").querySelector(".rep-pill.reported")).not.toBeNull();
    // Menopause not reported -> the not-reported tone.
    expect(cellFor(container, "Menopause").querySelector(".rep-pill.not_reported")).not.toBeNull();
    expect(cellFor(container, "Pregnancy").querySelector(".rep-pill.not_reported")).not.toBeNull();

    // Flip the canonical inputs: the same cards change state.
    const flipped = {
      ...base,
      totals: { women_reported_count: 0, women_estimated_total: 0, women_pct_of_participants: null },
      maturity: { level: 0, max_level: 5, scorable: true, rule_trace: [] },
      effectiveness: { state: "Sex-specific effectiveness not reported", findings: [] },
      safety: { state: "Sex-specific safety not reported" },
      dimensions: [{ dimension: "menopause_status_reported", n_reporting: 2 }],
    } as unknown as EvidenceResponse;
    const { container: c2 } = render(<Representation report={flipped} />);
    expect(cellFor(c2, "Women included").querySelector(".rep-pill.not_reported")).not.toBeNull();
    expect(cellFor(c2, "Menopause").querySelector(".rep-pill.reported")).not.toBeNull();
  });

  // Consistency guard (Mounjaro-style): when female participation is stored as a
  // PERCENTAGE (no reported count) — or via a verified sex-specific analysis / the
  // Women-Counted maturity level — 'Women included' must NOT resolve to Not reported.
  it("shows Women included as reported when only a percentage / analysis is stored", () => {
    const pctOnly = {
      totals: { women_reported_count: 0, women_estimated_total: 996, women_pct_of_participants: 53, participants_total: 1879 },
      dimensions: [{ dimension: "menopause_status_reported", n_reporting: 0 }],
      maturity: { level: 2, max_level: 5, scorable: true,
        rule_trace: [{ level: 1, satisfied: true }, { level: 2, satisfied: true }] },
      effectiveness: { state: "Sex-specific analysis reported, statistical comparison unclear", findings: [{}] },
      safety: { state: "Sex-specific safety signal reported", significant_findings: [], other_findings: [{}] },
      trials: [{ minimum_age: "18 Years" }],
    } as unknown as EvidenceResponse;
    const { container } = render(<Representation report={pctOnly} />);
    const women = cellFor(container, "Women included");
    expect(women.querySelector(".rep-pill.reported")).not.toBeNull();
    expect(women.textContent).not.toContain("Not reported");
    expect(women.textContent).toContain("53%");
  });

  it("reports age as a reporting fact and never infers menopause or 'older women' from it", () => {
    const { container } = render(<Representation report={base} />);
    const age = cellFor(container, "Older women or age reporting");
    expect(age.querySelector(".rep-pill.reported")).not.toBeNull();   // minimum age IS recorded
    const meno = cellFor(container, "Menopause");
    expect(meno.querySelector(".rep-pill.not_reported")).not.toBeNull(); // still not reported
    expect(container.textContent).toMatch(/never inferred from age/i);

    const noAge = { ...base, trials: [{ minimum_age: null }] } as unknown as EvidenceResponse;
    const { container: c2 } = render(<Representation report={noAge} />);
    expect(cellFor(c2, "Older women or age reporting").querySelector(".rep-pill.not_reported")).not.toBeNull();
  });

  it("keeps race and ethnicity explicitly unestablished rather than claiming silence", () => {
    const { container } = render(<Representation report={base} />);
    const race = cellFor(container, "Race and ethnicity");
    expect(race.querySelector(".rep-pill.incomplete")).not.toBeNull();
    expect(race.textContent).toContain("Not established");
    expect(race.textContent).not.toContain("Not reported");
  });
});
