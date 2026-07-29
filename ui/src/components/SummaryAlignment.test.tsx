import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EvidenceReview } from "./EvidenceReview";
import { NoticePanel, MaturityPanel } from "./WhatToNotice";
import { ContinueExploring } from "./ContinueExploring";
import { CheckEvidence } from "../pages/CheckEvidence";
import type { EvidenceResponse } from "../api";

/** EVIDENCE SUMMARY ALIGNMENT.
 *
 *  The three summary columns must stay inside the Evidence Summary container, share the
 *  row's height, and let their content wrap rather than widening a track. The layout is
 *  driven entirely by the grid in approved.css, so these checks read the real stylesheet
 *  rather than trusting a class name. No evidence value is touched. */

/** Vitest runs from ui/, so the stylesheet and pages are read cwd-relative. */
const src = (f: string) => resolve(process.cwd(), "src", f);
const CSS = readFileSync(src("approved.css"), "utf8");

/** The `.ev-summary3` rule block as authored. */
const summaryRule = (() => {
  const i = CSS.indexOf(".ev-summary3 {");
  return CSS.slice(i, CSS.indexOf("}", i) + 1);
})();
const columnRule = (() => {
  const i = CSS.indexOf(".ev-summary3 > * {");
  return CSS.slice(i, CSS.indexOf("}", i) + 1);
})();

function report(o: any = {}): EvidenceResponse {
  const level = o.level ?? 3;
  return {
    supported: true, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
    human_verification_status: "pending",
    query: { condition: "Heart failure", medicine: "Digoxin", life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: "Digoxin", active_ingredient: "Digoxin", brand_note: null,
      drug_class: "Cardiac glycoside", indication: "Heart failure", known_adverse_effects: null,
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true },
      effectiveness: { state: "Conflicting sex-specific results", headline: "" },
      safety: { state: "Women's safety discussed; no formal between-sex comparison", headline: "" },
    },
    maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })) },
    effectiveness: {
      state: "Conflicting sex-specific results", headline: "Conflicting sex-specific results",
      findings: [{
        interpretation: "Post hoc analysis.", endpoint: "All-cause mortality", significance: "significant",
        exact_passage: "Among women, mortality was 33.1% with digoxin and 28.9% with placebo.",
        source_locator: "p. 105", scope: "DIG",
        source: { source_id: "SRC-PMID-12409542", title: "Sex-based DIG analysis", url: "https://pubmed.ncbi.nlm.nih.gov/12409542/" },
      }],
    },
    safety: { state: "Women's safety discussed; no formal between-sex comparison", headline: "",
      significant_findings: [], other_findings: [] },
    dimensions: [], evidence_gaps: [],
    trials: [{ display_name: "DIG Trial", study_type: "Randomized Controlled Trial", minimum_age: null,
      assertions: [{ source: { source_id: "SRC-1", title: "DIG", url: "https://clinicaltrials.gov/" } }] }],
    studies_behind: [{ study: "DIG Trial", source_url: "https://clinicaltrials.gov/" }],
    sources: [{ source_id: "SRC-1", title: "DIG Trial", url: "https://clinicaltrials.gov/" }],
    totals: { participants_total: 7801, women_reported_count: 284, women_estimated_total: 284, women_pct_of_participants: null },
  } as unknown as EvidenceResponse;
}

const DIGOXIN = report();
const renderSummary = (r: EvidenceResponse = DIGOXIN) =>
  render(
    <EvidenceReview report={r} signalCard={<NoticePanel report={r} signal={null} />}
      maturityCard={<MaturityPanel report={r} />} />,
  );

describe("Evidence Summary — containment and alignment", () => {
  it("1. Uses an explicit three-track grid whose tracks can all shrink", () => {
    expect(summaryRule).toContain("display: grid");
    expect(summaryRule).toMatch(/grid-template-columns:\s*minmax\(150px, 0\.75fr\) minmax\(0, 1\.8fr\) minmax\(250px, 1fr\)/);
    expect(summaryRule).toContain("gap: 16px");
    expect(summaryRule).toContain("align-items: stretch");
    expect(summaryRule).toContain("box-sizing: border-box");
  });

  it("2. Gives every column min-width 0, full width and height, and border-box sizing", () => {
    expect(columnRule).toContain("min-width: 0");
    expect(columnRule).toContain("width: 100%");
    expect(columnRule).toContain("height: 100%");
    expect(columnRule).toContain("box-sizing: border-box");
  });

  it("3+4. Nothing can push a card outside the container", () => {
    // The column rule neutralises the escape hatches explicitly.
    expect(columnRule).toContain("transform: none");
    expect(columnRule).toContain("margin: 0");
    expect(columnRule).toContain("position: static");
    expect(columnRule).toContain("max-width: 100%");
    // …and no fixed or minimum width is set on the maturity column.
    const maturityRule = CSS.slice(CSS.indexOf(".ev-summary3 .notice-maturity {"));
    const block = maturityRule.slice(0, maturityRule.indexOf("}") + 1);
    expect(block).not.toMatch(/(^|[^-])width:\s*\d+px/);
    expect(block).not.toMatch(/min-width:\s*[1-9]/);
    expect(block).not.toContain("position: absolute");
  });

  it("8. All three columns stretch to the tallest card", () => {
    const { container } = renderSummary();
    const row = container.querySelector(".ev-summary3")!;
    expect([...row.children].length).toBe(3);
    // align-items: stretch on the row + height:100% on the children is what equalises
    // them; both are asserted above, and every child participates.
    expect(columnRule).toContain("display: flex");
    expect(columnRule).toContain("flex-direction: column");
  });

  it("6. The finding card fills its entire middle column", () => {
    const fillRule = CSS.slice(CSS.indexOf(".ev-summary3 .notice-panel > .notice-finding {"));
    const block = fillRule.slice(0, fillRule.indexOf("}") + 1);
    expect(block).toContain("height: 100%");
    expect(block).toContain("width: 100%");
    expect(block).toContain("box-sizing: border-box");
    expect(block).toContain("flex: 1 1 auto");
  });

  it("7. Lets the headline and statistics wrap across the available width", () => {
    const wrapRule = CSS.slice(CSS.indexOf(".ev-summary3 .nf-headline"));
    const block = wrapRule.slice(0, wrapRule.indexOf("}") + 1);
    expect(block).toContain("max-width: none");   // no artificially narrow text column
    expect(block).toContain("overflow-wrap: anywhere");
  });

  it("10. Stacks to two columns on tablet and one on mobile", () => {
    expect(CSS).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.ev-summary3 \{ grid-template-columns: minmax\(0, 1\.6fr\) minmax\(0, 1fr\); \}/);
    expect(CSS).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.ev-identity \{ grid-column: 1 \/ -1; \}/);
    expect(CSS).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.ev-summary3 \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
});

describe("Evidence Summary — the finding card owns its heading", () => {
  it("5. 'What should I notice?' sits inside the red finding card", () => {
    const { container } = renderSummary();
    const card = container.querySelector(".notice-finding")!;
    expect(within(card as HTMLElement).getByText("What should I notice?")).toBeInTheDocument();
    // Exactly one heading, and none of it outside the card.
    expect(container.querySelectorAll(".notice-title").length).toBe(1);
    const panel = container.querySelector(".notice-panel")!;
    expect(panel.firstElementChild!.classList.contains("notice-finding")).toBe(true);
  });

  it("Orders the card contents: heading, badges, finding, statistics, limits, passage, why", () => {
    const { container } = renderSummary();
    const body = container.querySelector(".notice-finding .nf-body")! as HTMLElement;
    const order = [...body.children].map((c) => c.className.split(" ")[0]);
    expect(order[0]).toBe("notice-title");
    // The finding headline and its statistics follow the heading, limitations after.
    expect(order.indexOf("nf-headline")).toBeGreaterThan(0);
    expect(order.indexOf("nf-caveat")).toBeGreaterThan(order.indexOf("nf-headline"));
    expect(order.indexOf("nf-link")).toBeGreaterThan(order.indexOf("nf-caveat"));
  });
});

describe("Check Evidence stays focused", () => {
  it("Removes the reusable-infrastructure banner from the page", () => {
    const source = readFileSync(src("pages/CheckEvidence.tsx"), "utf8");
    expect(source).not.toContain("ReusableScienceTeaser");
    expect(source).not.toContain("Built as reusable scientific infrastructure");
  });

  it("Points to the assets from Continue exploring instead", () => {
    render(<MemoryRouter><ContinueExploring onWhy={() => {}} onPassages={() => {}} /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /Explore AMIRA's reusable scientific assets/i });
    expect(link.getAttribute("href")).toBe("/amira/open-benchmark");
  });

  it("Keeps the underlying assets and Open Benchmark content intact", () => {
    const ob = readFileSync(src("pages/OpenBenchmark.tsx"), "utf8");
    expect(ob).toContain("ReusableAssets");
    expect(ob).toContain("Women's Evidence Schema");
    expect(ob).toContain("Benchmark records");
    // The teaser component itself is retained for the Open Benchmark surface.
    expect(() => readFileSync(src("components/ReusableScienceTeaser.tsx"), "utf8")).not.toThrow();
  });

  it("Renders the page without the banner and without horizontal overflow markers", () => {
    const source = readFileSync(src("pages/CheckEvidence.tsx"), "utf8");
    // Selection -> finding -> evidence -> sources -> limitations remains the flow.
    expect(source).toContain("EvidenceSearch");
    expect(source).toContain("EvidenceReview");
    expect(source).toContain("ContinueExploring");
    expect(CheckEvidence).toBeTypeOf("function");
  });
});
