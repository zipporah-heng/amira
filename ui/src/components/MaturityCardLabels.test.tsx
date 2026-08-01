import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MaturityPanel, MATURITY_CAPTION, MATURITY_NOTE } from "./WhatToNotice";
import { maturityChecklist } from "../maturityLevels";
import type { EvidenceResponse } from "../api";

/** EVIDENCE MATURITY CARD — WORDING ONLY.
 *
 *  The caption under the score, the checklist heading and the explanatory note were
 *  reworded. The score itself, its thresholds, the rule trace and the card's layout are
 *  untouched, and these tests assert that too. */

function report(level = 2, scorable = true): EvidenceResponse {
  return {
    banner: { medicine: "Digoxin", evidence_review_complete: true },
    maturity: {
      level, max_level: 5, scorable,
      label: scorable ? "Women Analyzed" : "Not yet established",
      display: scorable ? `${level} / 5` : "Not yet established",
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
  } as unknown as EvidenceResponse;
}

describe("Evidence Maturity card wording", () => {
  it("Captions the score 'Evidence Criteria Met'", () => {
    const { container } = render(<MaturityPanel report={report(2)} />);
    const meter = container.querySelector("svg.maturity-meter")!;
    expect(MATURITY_CAPTION).toBe("Evidence Criteria Met");
    expect(meter.textContent).toContain("2");
    expect(meter.textContent).toContain("/ 5");
    expect(meter.textContent).toContain("Evidence Criteria Met");
    // The old caption is gone from the card head; the canonical level name still names
    // the level inside the checklist.
    expect(meter.textContent).not.toContain("Women Analyzed");
    expect(container.querySelector(".nm-check")!.textContent).toContain("Women Analyzed");
  });

  it("Heads the checklist 'How this score was calculated'", () => {
    const { container } = render(<MaturityPanel report={report(2)} />);
    expect(screen.getByText("How this score was calculated")).toBeInTheDocument();
    expect(container.textContent).not.toContain("How this level was reached");
    expect(screen.getByLabelText(/how this evidence maturity score is calculated/i)).toBeInTheDocument();
  });

  it("States what the score measures and what it does not", () => {
    const { container } = render(<MaturityPanel report={report(2)} />);
    expect(MATURITY_NOTE).toBe(
      "This measures the completeness of women's evidence, not whether the medicine is safe or effective.",
    );
    expect(container.querySelector(".nm-note")!.textContent).toBe(MATURITY_NOTE);
    expect(container.textContent).not.toContain("not whether the medicine is better");
  });

  it("Changes no score, threshold or rule trace", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const { container, unmount } = render(<MaturityPanel report={report(level)} />);
      const meter = container.querySelector("svg.maturity-meter")!;
      expect(meter.getAttribute("aria-label")).toMatch(new RegExp(`Evidence maturity ${level} of 5`, "i"));
      expect(meter.querySelectorAll("path").length).toBe(5);
      const items = [...container.querySelectorAll(".nm-check li")];
      expect(items.length).toBe(5);
      // Reached / unreached follows the level exactly, as before.
      expect(container.querySelectorAll(".nm-ic.on").length).toBe(level);
      expect(container.querySelectorAll(".nm-ic.off").length).toBe(5 - level);
      // The canonical level names are unchanged.
      expect(items.map((li) => li.textContent)).toEqual(
        maturityChecklist(level).map((it) => expect.stringContaining(it.label)),
      );
      unmount();
    }
  });

  it("Keeps an unscored medicine's canonical status instead of claiming criteria met", () => {
    const { container } = render(<MaturityPanel report={report(0, false)} />);
    const meter = container.querySelector("svg.maturity-meter")!;
    expect(meter.textContent).toContain("Not yet established");
    expect(meter.textContent).not.toContain("Evidence Criteria Met");
    // No checklist for an unscored medicine — unchanged behaviour.
    expect(container.querySelector(".nm-check")).toBeNull();
  });

  it("Keeps the caption inside the gauge ring", () => {
    // The caption sits at CX, CY + 26 inside a ring of radius 80 with a 17-unit stroke,
    // so the clear width at its baseline is 2 * sqrt((80 - 8.5)^2 - 26^2) = ~133 units.
    // "Evidence Criteria Met" measures ~141 units at 14px and ~126 at 12.5px, so the
    // caption must not be enlarged past the base size or it would graze the arc.
    const meter = readFileSync(resolve(process.cwd(), "src/components/MaturityMeter.tsx"), "utf8");
    expect(meter).toContain("const CX = 110, CY = 104, R = 80, STROKE = 17;");
    expect(meter).toContain("y={CY + 26}");
    const base = readFileSync(resolve(process.cwd(), "src/mockup.css"), "utf8");
    expect(base).toMatch(/\.mm-label \{ font-size: 12\.5px;/);
    const polish = readFileSync(resolve(process.cwd(), "src/polish.css"), "utf8");
    expect(polish).not.toMatch(/\.mm-label \{ font-size:/);
  });

  it("Leaves the card structure alone", () => {
    const { container } = render(<MaturityPanel report={report(2)} />);
    const card = container.querySelector(".notice-maturity")!;
    expect(card.id).toBe("evidence-maturity");
    const order = [...card.children].map((c) => c.tagName.toLowerCase() + "." + (c.className.baseVal ?? c.className).split(" ")[0]);
    expect(order).toEqual(["div.nm-head", "svg.maturity-meter", "p.nm-note", "div.nm-how"]);
    expect(within(card as HTMLElement).getByText("Evidence Maturity")).toBeInTheDocument();
  });
});
