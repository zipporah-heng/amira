import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceReview, SECTIONS } from "./EvidenceReview";
import { NoticePanel, MaturityPanel } from "./WhatToNotice";
import { Representation } from "./Representation";
import { AiFound } from "./AiFound";
import { WhatRemainsUnknown } from "./EvidenceClarity";
import { CriticalSignals } from "./CriticalSignals";
import { Methodology } from "../pages/Methodology";
import type { EvidenceResponse } from "../api";

/** FINAL COSMETIC PASS: a compact three-column summary, anchors that land on headings,
 *  the approved final section order, a search control that reads as an input, and one
 *  Methodology introduction. No scientific value changes. */

function report(o: any = {}): EvidenceResponse {
  const level = o.level ?? 2;
  return {
    supported: true, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
    human_verification_status: "pending",
    query: { condition: "Type 2 diabetes", medicine: "Ozempic", life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: "Ozempic", active_ingredient: "Semaglutide", brand_note: null,
      drug_class: "GLP-1 receptor agonist", indication: "Type 2 diabetes",
      known_adverse_effects: { list: ["Nausea"], exact_passage: "Adverse reactions.",
        source: { source_id: "SRC-PI", title: "Prescribing information", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } },
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: o.scorable !== false },
      effectiveness: { state: "No statistically significant sex difference identified", headline: "" },
      safety: { state: "Sex-specific safety signal reported", headline: "" },
    },
    maturity: {
      level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: o.scorable !== false,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
    effectiveness: {
      state: "No statistically significant sex difference identified",
      headline: "No statistically significant sex difference identified",
      findings: [{
        interpretation: "Post hoc sex-specific analysis.", endpoint: "Major adverse cardiovascular events",
        significance: "not_tested", exact_passage: "Women comprised 1295 of 3297 participants.",
        source_locator: "Table 2", scope: "SUSTAIN-6",
        source: { source_id: "SRC-PMID-31167654", title: "Sex-based SUSTAIN-6 analysis", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/" },
      }],
    },
    safety: { state: "Sex-specific safety signal reported", headline: "", significant_findings: [], other_findings: [] },
    dimensions: [
      { dimension: "menopause_status_reported", n_reporting: 0 },
      { dimension: "hormone_therapy_reported", n_reporting: 0 },
      { dimension: "pregnancy_evidence_reported", n_reporting: 0 },
    ],
    evidence_gaps: [{ dimension: "menopause_status_reported", label: "Menopause", n_reporting: 0, n_trials: 2,
      statement: "No reviewed study reported menopausal status." }],
    trials: [{ display_name: "SUSTAIN-6", study_type: "Randomized Controlled Trial", minimum_age: "18 Years",
      assertions: [{ source: { source_id: "SRC-NCT01720446", title: "SUSTAIN-6 registry", url: "https://clinicaltrials.gov/study/NCT01720446" } }] }],
    studies_behind: [{ study: "SUSTAIN-6", source_url: "https://clinicaltrials.gov/study/NCT01720446" }],
    sources: [{ source_id: "SRC-NCT01720446", title: "SUSTAIN-6 registry", url: "https://clinicaltrials.gov/study/NCT01720446" }],
    totals: { participants_total: 3297, women_reported_count: 1295, women_estimated_total: 1295, women_pct_of_participants: 39.3 },
  } as unknown as EvidenceResponse;
}

const OZEMPIC = report();

const renderPage = (r: EvidenceResponse = OZEMPIC) =>
  render(
    <EvidenceReview
      report={r}
      signalCard={<NoticePanel report={r} signal={null} />}
      maturityCard={<MaturityPanel report={r} />}
      representationCard={<Representation report={r} />}
      unknownCard={<WhatRemainsUnknown report={r} />}
      aiFoundCard={<AiFound report={r} onOpenTrace={() => {}} />}
    />,
  );

afterEach(() => vi.unstubAllGlobals());

describe("Check Evidence — compact three-column summary", () => {
  it("1. Places medicine identity, the main finding and the maturity meter in one row", () => {
    const { container } = renderPage();
    const row = container.querySelector(".ev-summary3")!;
    expect(row).not.toBeNull();
    const cols = [...row.children];
    expect(cols.length).toBe(3);
    expect(cols[0].classList.contains("ev-identity")).toBe(true);
    expect(cols[1].id).toBe("important-finding");
    expect(cols[2].id).toBe("evidence-maturity");
    expect(cols[2].querySelector("svg.maturity-meter")).not.toBeNull();
  });

  it("2. Stacks in the same order (identity, finding, maturity) on narrow viewports", () => {
    const { container } = renderPage();
    // Source order IS the stacking order — the grid never reorders the columns.
    const ids = [...container.querySelector(".ev-summary3")!.children]
      .map((c) => c.id || c.className.split(" ")[0]);
    expect(ids).toEqual(["ev-identity", "important-finding", "evidence-maturity"]);
  });

  it("Keeps the identity column compact — no long evidence explanations", () => {
    const { container } = renderPage();
    const identity = container.querySelector(".ev-identity")! as HTMLElement;
    expect(identity.textContent).toContain("Ozempic");
    expect(identity.textContent).toContain("semaglutide");
    expect(within(identity).getByText("Drug class")).toBeInTheDocument();
    expect(within(identity).getByText("Condition")).toBeInTheDocument();
    expect(within(identity).getByText("Selected medicine")).toBeInTheDocument();
    // No maturity narrative, no score, no checklist in this column.
    expect(identity.textContent).not.toMatch(/\d\s*\/\s*5/);
    expect(identity.textContent).not.toMatch(/evidence completeness/i);
    expect(identity.querySelector(".nm-check")).toBeNull();
  });

  it("Preserves the finding and the full maturity presentation", () => {
    const { container } = renderPage();
    const finding = container.querySelector("#important-finding")!;
    expect(finding.textContent).toContain("What should I notice?");
    const maturity = container.querySelector("#evidence-maturity")!;
    expect(maturity.querySelector("svg.maturity-meter")!.getAttribute("aria-label"))
      .toMatch(/AMIRA Evidence Maturity Score: 2 of 5 evidence criteria met/);
    expect(maturity.querySelectorAll(".nm-check li").length).toBe(5);
    expect(maturity.textContent)
      .toMatch(/measures the maturity and completeness of evidence about women/i);
    expect(maturity.textContent)
      .toMatch(/does not measure whether a medicine is safe or effective/i);
  });
});

describe("Check Evidence — anchors and final order", () => {
  it("3+4. Every anchor id sits on a container covered by the sticky-header offset rule", () => {
    const { container } = renderPage();
    // The selectors in approved.css that carry scroll-margin-top: 96px.
    const OFFSET_SELECTORS = [".ev-section", "#representation",
      "#remains-unknown", "#ai-found", ".notice-panel", ".notice-maturity"];
    for (const s of [...SECTIONS, { id: "evidence-maturity" }]) {
      const el = container.querySelector(`#${s.id}`);
      expect(el, s.id).not.toBeNull();
      expect(OFFSET_SELECTORS.some((sel) => el!.matches(sel)), s.id).toBe(true);
    }
  });

  it("Clicking the same navigation item repeatedly still lands on its section", () => {
    const { container } = renderPage();
    const link = container.querySelector('a[href="#exact-passages"]')! as HTMLAnchorElement;
    const target = container.querySelector("#exact-passages") as HTMLElement;
    const calls: number[] = [];
    target.scrollIntoView = vi.fn(() => calls.push(calls.length)) as any;
    fireEvent.click(link);
    fireEvent.click(link);
    fireEvent.click(link);
    expect(calls.length).toBe(3);
  });

  it("5. Highlights exactly one active section", () => {
    const { container } = renderPage();
    const active = container.querySelectorAll(".ev-nav-link.active");
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("aria-current")).toBe("true");
  });

  it("6+7. Women in the Evidence precedes the AI trace, which sits just before About", () => {
    const { container } = renderPage();
    const all = [...container.querySelectorAll("*")];
    const at = (id: string) => all.indexOf(container.querySelector(`#${id}`)!);
    expect(at("women-in-the-evidence")).toBeLessThan(at("ai-found"));
    expect(at("source-coverage")).toBeLessThan(at("ai-found"));
    expect(at("ai-found")).toBeLessThan(at("about-this-evidence-review"));
    // "What remains unknown" now follows Women in the Evidence.
    expect(at("women-in-the-evidence")).toBeLessThan(at("remains-unknown"));
    expect(at("remains-unknown")).toBeLessThan(at("sex-specific-effectiveness"));
  });

  it("The table of contents lists the approved sections in the approved order", () => {
    const { container } = renderPage();
    expect([...container.querySelectorAll(".ev-nav-label")].map((n) => n.textContent)).toEqual([
      "Evidence Summary", "How were women represented?",
      "Women in the Evidence", "What remains unknown", "Sex-specific Effectiveness",
      "Women-specific Safety", "Common Adverse Effects", "Life-stage Evidence",
      "Hormonal Context", "Exact Passages", "Source Coverage",
      "How AMIRA's AI found this evidence", "About This Evidence Review",
    ]);
  });

  it("8+9. Every scientific component and the PDF export remain present", () => {
    const { container } = renderPage();
    for (const sel of ["svg.maturity-meter", ".nm-check", "#important-finding",
      "#representation", "#remains-unknown", "#ai-found", ".schema-panel", ".ev-nav-list",
      "#exact-passages", "#source-coverage", "#about-this-evidence-review", ".ev-export-btn",
      ".trace-open"]) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
  });
});

describe("Research Map — Critical Evidence Library search", () => {
  const LIB = {
    featured: [], signal_types: ["Mortality"], evidence_statuses: ["human_review_pending"], max_featured: 5,
    library: [
      { signal_id: "S1", medicine: "Digoxin", health_area: "Cardiovascular", condition: "Heart failure",
        signal_type: "Mortality", headline: "Higher mortality among women assigned digoxin",
        clinical_significance: "Post hoc analysis", evidence_status: "human_review_pending",
        life_stage: "not_specified", source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/",
        source_resolved: true, exact_passage: "…", featured: false, featured_priority: null,
        source_id: "SRC-PMID-12409542", finding_id: "F-EFF-DIG-001", sex_specific: true,
        drug_class: "Cardiac glycoside", trial_id: "DIG", human_verified: false, cautions: [],
        life_stage_context: "", hormonal_context: "" },
      { signal_id: "S2", medicine: "Sotalol", health_area: "Cardiovascular", condition: "Heart rhythm disorders",
        signal_type: "Serious Safety", headline: "Torsades de pointes reported more often in women",
        clinical_significance: "Pooled analysis", evidence_status: "human_review_pending",
        life_stage: "not_specified", source_url: "https://pubmed.ncbi.nlm.nih.gov/8921798/",
        source_resolved: true, exact_passage: "…", featured: false, featured_priority: null,
        source_id: "SRC-PMID-8921798", finding_id: "F-SAF-SOT-001", sex_specific: true,
        drug_class: "Antiarrhythmic", trial_id: "SOTALOL", human_verified: false, cautions: [],
        life_stage_context: "", hormonal_context: "" },
    ],
  };

  const renderLib = async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => LIB })) as any);
    const view = render(<MemoryRouter><CriticalSignals /></MemoryRouter>);
    await waitFor(() => expect(view.container.querySelector(".cs-search-input")).not.toBeNull());
    return view;
  };

  it("15+18. Renders a labelled search input with a visible focus target", async () => {
    const { container } = await renderLib();
    const input = container.querySelector(".cs-search-input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("search");
    expect(input.getAttribute("placeholder")).toBe("Search medicine or finding");
    expect(screen.getByLabelText("Search medicine or finding")).toBe(input);
    expect(container.querySelector(".cs-search-wrap")).not.toBeNull();   // bordered box
    expect(container.querySelector(".cs-search-icon")).not.toBeNull();   // search icon
    expect(container.querySelector("label[for='cs-search-input']")!.textContent).toBe("Search");
  });

  it("16. Filters on medicine and on finding text", async () => {
    const { container } = await renderLib();
    const rows = () => container.querySelectorAll(".cs-table tbody tr").length;
    expect(rows()).toBe(2);
    const input = container.querySelector(".cs-search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sotalol" } });      // by medicine
    await waitFor(() => expect(rows()).toBe(1));
    fireEvent.change(input, { target: { value: "mortality among women" } });  // by finding text
    await waitFor(() => expect(rows()).toBe(1));
    expect(container.querySelector(".cs-table tbody")!.textContent).toContain("Digoxin");
  });

  it("17. Offers a clear control only when text is entered, and it resets the list", async () => {
    const { container } = await renderLib();
    expect(container.querySelector(".cs-search-clear")).toBeNull();
    const input = container.querySelector(".cs-search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sotalol" } });
    const clear = await screen.findByLabelText("Clear search");
    fireEvent.click(clear);
    await waitFor(() => expect(container.querySelectorAll(".cs-table tbody tr").length).toBe(2));
    expect((container.querySelector(".cs-search-input") as HTMLInputElement).value).toBe("");
  });
});

describe("Methodology — a single introduction", () => {
  it("26+27+28+29. One lavender panel, then the steps, model and two states", () => {
    const { container } = render(<MemoryRouter><Methodology /></MemoryRouter>);
    expect(container.querySelectorAll(".method-positioning").length).toBe(1);
    expect(container.querySelectorAll(".hormonal-focus").length).toBe(0);
    expect(container.querySelector(".method-positioning")!.textContent)
      .toMatch(/source-linked women's evidence layer/i);
    expect(container.querySelector(".method-positioning")!.textContent)
      .toMatch(/does not claim complete coverage/i);
    // The methodology steps, maturity model and the two distinct states all remain.
    expect(container.querySelector(".flow, .method-flow, [class*='flow']")).not.toBeNull();
    expect(container.querySelector("#evidence-maturity-model")).not.toBeNull();
    expect(container.querySelectorAll(".ladder .rung").length).toBe(5);
    expect(screen.getByText(/No evidence found/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence of no effect/)).toBeInTheDocument();
  });
});
