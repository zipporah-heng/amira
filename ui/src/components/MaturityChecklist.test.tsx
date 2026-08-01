import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceResponse } from "../api";
import { WhatToNotice } from "./WhatToNotice";

/** The "How this score was reached" checklist inside the Evidence Maturity card. It
 *  explains the canonical maturity level; it never recomputes maturity. */

function report(opts: { medicine: string; level: number; scorable?: boolean; reviewComplete?: boolean }): EvidenceResponse {
  const { medicine, level, scorable = true, reviewComplete = true } = opts;
  return {
    banner: { medicine, drug_class: "Cardiac glycoside", evidence_review_complete: reviewComplete },
    maturity: {
      level, max_level: 5,
      label: level >= 2 ? "Women Analyzed" : level === 1 ? "Women Counted" : "Not yet established",
      display: scorable ? `${level} / 5` : "Not yet established",
      scorable,
    },
    effectiveness: { findings: [] },
    safety: { significant_findings: [] },
  } as unknown as EvidenceResponse;
}

describe("Evidence Maturity checklist — Digoxin (Level 2)", () => {
  const r = report({ medicine: "Digoxin", level: 2 });

  it("shows the 2/5 gauge and the 'How this score was reached' checklist", () => {
    const { container } = render(<WhatToNotice report={r} />);
    expect(screen.getByLabelText(/AMIRA Evidence Maturity Score: 2 of 5 evidence criteria met/i))
      .toBeInTheDocument();
    expect(screen.getByText("How this score was reached")).toBeInTheDocument();
    expect(container.querySelectorAll(".nm-check li").length).toBe(5);
  });

  it("marks Women Counted and Women Analyzed reached; levels 3-5 not reached", () => {
    const { container } = render(<WhatToNotice report={r} />);
    const items = [...container.querySelectorAll(".nm-check li")];
    const reached = items.filter((li) => li.classList.contains("reached")).map((li) => li.querySelector(".nm-lvl")!.textContent);
    const unreached = items.filter((li) => li.classList.contains("unreached")).map((li) => li.querySelector(".nm-lvl")!.textContent);
    expect(reached.join(" ")).toContain("Women Counted");
    expect(reached.join(" ")).toContain("Women Analyzed");
    expect(unreached.join(" ")).toContain("Life Stage Aware");
    expect(unreached.join(" ")).toContain("Hormone Aware");
    expect(unreached.join(" ")).toContain("Precision Women's Evidence");
  });

  it("communicates reached/not-reached to screen readers, not by colour alone", () => {
    const { container } = render(<WhatToNotice report={r} />);
    const items = [...container.querySelectorAll(".nm-check li")];
    const women = items.find((li) => li.textContent!.includes("Women Analyzed"))!;
    expect(within(women as HTMLElement).getByText(/level reached/)).toBeInTheDocument();
    const life = items.find((li) => li.textContent!.includes("Life Stage Aware"))!;
    expect(within(life as HTMLElement).getByText(/level not reached/)).toBeInTheDocument();
  });

  it("links to the Methodology evidence-maturity section", () => {
    render(<WhatToNotice report={r} />);
    const link = screen.getByText("About evidence maturity levels →") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/amira/methodology#evidence-maturity-model");
  });

  it("has an accessible information icon", () => {
    render(<WhatToNotice report={r} />);
    expect(screen.getByLabelText(/how this evidence maturity score is reached/i)).toBeInTheDocument();
  });
});

describe("Evidence Maturity checklist — Level 4 medicine (Valsartan)", () => {
  it("marks the first four levels reached and level 5 not reached", () => {
    const { container } = render(<WhatToNotice report={report({ medicine: "Valsartan", level: 4 })} />);
    const items = [...container.querySelectorAll(".nm-check li")];
    expect(items.map((li) => li.classList.contains("reached"))).toEqual([true, true, true, true, false]);
  });
});

describe("Evidence Maturity checklist — incomplete / unscored medicine (Atorvastatin)", () => {
  const r = report({ medicine: "Atorvastatin", level: 0, scorable: false, reviewComplete: false });

  it("does not display a 0/5 score or the five-level checklist", () => {
    const { container } = render(<WhatToNotice report={r} />);
    expect(container.querySelector(".nm-how")).toBeNull();
    expect(container.querySelectorAll(".nm-check li").length).toBe(0);
    expect(container.textContent || "").toMatch(/Not yet established/);
    expect(container.textContent || "").not.toMatch(/0\s*\/\s*5/);
  });
});
