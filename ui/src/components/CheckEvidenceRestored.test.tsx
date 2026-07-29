import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { EvidenceResponse } from "../api";
import { EvidenceReview } from "./EvidenceReview";
import { Representation } from "./Representation";
import { AiFound } from "./AiFound";
import { WhatToNotice } from "./WhatToNotice";
import { EvidenceScope, WhatRemainsUnknown } from "./EvidenceClarity";
import * as M from "../evidenceModel";

/** REGRESSION GUARD: the original AMIRA evidence components must live inside the new
 *  Check Evidence layout — the circular maturity meter, the maturity checklist, "How
 *  were women represented?", "How AMIRA's AI found this evidence" and the Women's
 *  Evidence Schema panel — alongside the new detailed sections, source coverage and
 *  PDF export. No component may report a state that contradicts another. */

function report(o: any): EvidenceResponse {
  const level = o.level ?? 2;
  return {
    supported: true,
    dataset_version: "3.0.0",
    source_cutoff: "2026-07-18",
    human_verification_status: o.review ?? "pending",
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: o.medicine, active_ingredient: o.active_ingredient, brand_note: null,
      drug_class: o.drug_class, indication: o.condition,
      known_adverse_effects: o.aes
        ? { list: o.aes, exact_passage: "Adverse reactions reported in the prescribing information.",
            source: { source_id: "SRC-PI", title: "Prescribing information", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } }
        : null,
      maturity: { level, max_level: 5, label: o.matLabel ?? "Women Analyzed", display: `${level} / 5`, scorable: true },
      effectiveness: { state: o.eff, headline: o.eff },
      safety: { state: o.saf, headline: o.saf },
    },
    maturity: {
      level, max_level: 5, label: o.matLabel ?? "Women Analyzed", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
    effectiveness: {
      state: o.eff, headline: o.eff,
      findings: [{
        interpretation: o.postHoc ? "Post hoc sex-specific analysis." : "Sex-specific analysis reported.",
        endpoint: "Major adverse cardiovascular events", significance: "not_tested",
        exact_passage: o.passage, source_locator: "Table 2", scope: o.study,
        source: { source_id: o.sourceId, title: o.sourceTitle, url: o.sourceUrl },
      }],
    },
    safety: { state: o.saf, headline: o.saf, significant_findings: [], other_findings: [] },
    dimensions: [
      { dimension: "menopause_status_reported", n_reporting: o.meno ?? 0 },
      { dimension: "hormone_therapy_reported", n_reporting: o.ht ?? 0 },
      { dimension: "pregnancy_evidence_reported", n_reporting: o.preg ?? 0 },
    ],
    evidence_gaps: [{ dimension: "menopause_status_reported", label: "Menopause", n_reporting: 0, n_trials: 1,
      statement: "No reviewed study reported menopausal status." }],
    trials: [{
      display_name: o.study, study_type: "Randomized Controlled Trial", minimum_age: o.minAge ?? null,
      assertions: [{ source: { source_id: o.sourceId, title: o.sourceTitle, url: o.sourceUrl } }],
    }],
    studies_behind: [{ study: o.study, source_url: o.sourceUrl }],
    sources: [{ source_id: o.sourceId, title: o.sourceTitle, url: o.sourceUrl }],
    totals: {
      participants_total: o.total, women_reported_count: o.womenReported ?? 0,
      women_estimated_total: o.womenEstimated ?? o.womenReported ?? 0,
      women_pct_of_participants: o.pct,
    },
  } as unknown as EvidenceResponse;
}

const OZEMPIC = report({
  medicine: "Ozempic", active_ingredient: "Semaglutide", condition: "Type 2 diabetes",
  drug_class: "GLP-1 receptor agonist", study: "SUSTAIN-6", total: 3297, womenReported: 1295, pct: 39.3,
  eff: "No statistically significant sex difference identified", saf: "Sex-specific safety signal reported",
  aes: ["Nausea", "Vomiting"], postHoc: true, minAge: "18 Years",
  passage: "Women comprised 1295 of the 3297 randomised participants.",
  sourceId: "SRC-PMID-31167654", sourceTitle: "Sex-based SUSTAIN-6 analysis",
  sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/",
});

/** The full Check Evidence composition, exactly as the page assembles it: the original
 *  scientific summary components integrated above the newer detailed review. */
const renderPage = (r: EvidenceResponse = OZEMPIC) =>
  render(
    <EvidenceReview
      report={r}
      signalCard={<WhatToNotice report={r} signal={null} />}
      scopeCard={<EvidenceScope report={r} />}
      representationCard={<Representation report={r} />}
      unknownCard={<WhatRemainsUnknown report={r} />}
      aiFoundCard={<AiFound report={r} onOpenTrace={() => {}} />}
    />,
  );

const cellFor = (c: HTMLElement, title: string) =>
  [...c.querySelectorAll(".rep-cell")].find((el) => el.textContent?.includes(title)) as HTMLElement;
const toneOf = (cell: HTMLElement) =>
  [...cell.querySelector(".rep-pill")!.classList].find((c) => c !== "rep-pill");

afterEach(() => vi.unstubAllGlobals());

describe("Hybrid integration — every approved component coexists", () => {
  it("Renders the original scientific summary AND the newer detailed review together", () => {
    const { container } = renderPage();
    const present: Record<string, boolean> = {
      "1. circular maturity meter": !!container.querySelector("svg.maturity-meter"),
      "2. maturity checklist": container.querySelectorAll(".nm-item, .ev-mat-check li").length >= 5,
      "3. what should I notice": !!container.querySelector("#important-finding"),
      "4. evidence scope": !!container.querySelector("#evidence-scope"),
      "5. how were women represented": !!container.querySelector("#representation"),
      "6. what remains unknown": !!container.querySelector("#remains-unknown"),
      "7. how AMIRA's AI found this": !!container.querySelector("#ai-found"),
      "8. women's evidence schema": !!container.querySelector(".schema-panel"),
      "9. left table of contents": !!container.querySelector(".ev-nav-list"),
      "10. detailed evidence sections": ["women-in-the-evidence", "sex-specific-effectiveness",
        "women-specific-safety", "common-adverse-effects", "life-stage-evidence", "hormonal-context"]
        .every((id) => !!container.querySelector(`#${id}`)),
      "11. exact passages": !!container.querySelector("#exact-passages"),
      "12. source coverage": !!container.querySelector("#source-coverage"),
      "13. about this evidence review": !!container.querySelector("#about-this-evidence-review"),
      "14. PDF export control": !!container.querySelector(".ev-export-btn"),
      "15. open evidence trace": !!container.querySelector(".trace-open"),
    };
    const missing = Object.entries(present).filter(([, ok]) => !ok).map(([k]) => k);
    expect(missing).toEqual([]);
  });

  it("Follows the approved order: quick understanding first, detailed inspection second", () => {
    const { container } = renderPage();
    const order = ["evidence-summary", "important-finding", "evidence-scope", "representation",
      "remains-unknown", "ai-found", "women-in-the-evidence", "sex-specific-effectiveness",
      "women-specific-safety", "common-adverse-effects", "life-stage-evidence", "hormonal-context",
      "exact-passages", "source-coverage", "about-this-evidence-review"];
    const positions = order.map((id) => {
      const el = container.querySelector(`#${id}`);
      expect(el, id).not.toBeNull();
      return [...container.querySelectorAll("*")].indexOf(el!);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("Offers navigation links for the restored summary sections too", () => {
    const { container } = renderPage();
    const labels = [...container.querySelectorAll(".ev-nav-label")].map((n) => n.textContent);
    expect(labels).toContain("What should I notice?");
    expect(labels).toContain("How were women represented?");
    expect(labels).toContain("How AMIRA's AI found this");
    expect(labels).toContain("Evidence Summary");
    expect(labels).toContain("About This Evidence Review");
    // Every link still resolves to a real section.
    for (const link of [...container.querySelectorAll(".ev-nav-link")] as HTMLAnchorElement[]) {
      expect(container.querySelector(link.getAttribute("href")!)).not.toBeNull();
    }
  });

  it("Presents the maturity level once in full, without a competing second meter", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll("svg.maturity-meter").length).toBe(1);
    // The summary card keeps a compact marker of the same canonical level.
    const compact = container.querySelector(".ev-mat-compact .ev-mat-v")!.textContent;
    expect(compact).toContain(String(M.maturity(OZEMPIC).level));
    expect(container.querySelector("svg.maturity-meter")!.getAttribute("aria-label"))
      .toContain(`${M.maturity(OZEMPIC).level} of 5`);
  });
});

describe("Restored components", () => {
  it("1. Shows the circular Evidence Maturity meter in the Evidence Summary", () => {
    const { container } = renderPage();
    const summary = container.querySelector("#evidence-summary")!;
    const meter = summary.querySelector("svg.maturity-meter")!;
    expect(meter).not.toBeNull();
    expect(meter.querySelectorAll("path").length).toBe(5);           // five segments
    expect(meter.textContent).toContain("2");
    expect(meter.textContent).toContain("/ 5");
    expect(meter.textContent).toContain("Women Analyzed");
    expect(meter.getAttribute("aria-label")).toMatch(/Evidence maturity 2 of 5/i);
    expect(summary.textContent)
      .toMatch(/measures evidence completeness[—,] ?not whether the medicine is better/i);
  });

  it("2. Shows the maturity checklist with reached and unreached levels", () => {
    const { container } = renderPage();
    const list = container.querySelector(".nm-check")!;
    ["Women Counted", "Women Analyzed", "Life Stage Aware", "Hormone Aware", "Precision Women's Evidence"]
      .forEach((l) => expect(list.textContent).toContain(l));
    expect(list.querySelectorAll(".nm-ic.on").length).toBe(2);
    expect(list.querySelectorAll(".nm-ic.off").length).toBe(3);
    // Reached / not reached is conveyed in text, never by colour alone.
    expect(list.textContent).toContain("level reached");
    expect(list.textContent).toContain("level not reached");
  });

  it("3+4. Shows 'How were women represented?' with all canonical fields", () => {
    const { container } = renderPage();
    const row = container.querySelector("#representation")! as HTMLElement;
    expect(within(row).getByText("How were women represented?")).toBeInTheDocument();
    // Scoped to the representation row — "Women included" also (correctly) appears as a
    // metric card in the detailed section below.
    const fields = ["Women included", "Sex-specific outcomes", "Sex-specific safety", "Menopause",
      "Hormone therapy", "Pregnancy", "Older women or age reporting", "Race and ethnicity"];
    fields.forEach((t) => expect(within(row).getByText(t)).toBeInTheDocument());
    expect(row.querySelectorAll(".rep-cell").length).toBe(fields.length);
  });

  it("5. Shows 'How AMIRA's AI found this evidence' with the five-stage workflow and trace", () => {
    const { container } = renderPage();
    const ai = container.querySelector("#ai-found")! as HTMLElement;
    expect(within(ai).getByText("How AMIRA's AI found this evidence")).toBeInTheDocument();
    ["Published sources", "AMIRA-Extract (AI)", "Women's Evidence Schema", "Exact passage check", "Human review"]
      .forEach((s) => expect(ai.textContent).toContain(s));
    ["Source", "AI extraction", "Structured field", "Passage validation", "Review state"]
      .forEach((k) => expect(ai.textContent).toContain(k));
    // The trace points at THIS medicine's real source and never claims a finished review.
    expect(ai.textContent).toContain("SRC-PMID-31167654");
    expect(ai.textContent).toContain("Human review pending");
    expect(ai.textContent).not.toContain("Human review completed");
  });

  it("6. Shows the Women's Evidence Schema panel with the canonical field names", () => {
    const { container } = renderPage();
    const panel = container.querySelector(".schema-panel")!;
    ["women_represented", "sex_specific_effectiveness", "sex_specific_safety", "menopause", "pregnancy",
     "hormone_therapy", "race_ethnicity", "age", "evidence_passage", "source_id"]
      .forEach((f) => expect(panel.textContent).toContain(f));
  });

  it("7. 'Open evidence trace' is present and invokes the trace drawer", () => {
    const onOpen = vi.fn();
    render(<AiFound report={OZEMPIC} onOpenTrace={onOpen} />);
    const btn = screen.getByRole("button", { name: /Open evidence trace/i });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("8. The new detailed sections and source coverage remain visible", () => {
    const { container } = renderPage();
    for (const id of ["evidence-summary", "women-in-the-evidence", "sex-specific-effectiveness",
      "women-specific-safety", "common-adverse-effects", "life-stage-evidence", "hormonal-context",
      "exact-passages", "source-coverage", "about-this-evidence-review"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(container.querySelector(".ev-nav-list")).not.toBeNull();
  });

  it("9. The PDF export control remains functional", async () => {
    const { container } = renderPage();
    const btn = container.querySelector(".ev-export-btn") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false);
    const clicks: string[] = [];
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
      const el = origCreate(tag);
      if (tag === "a") (el as any).click = () => clicks.push((el as HTMLAnchorElement).download);
      return el;
    });
    fireEvent.click(btn);
    await screen.findByRole("button", { name: /Export PDF/i }, { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 400));
    expect(clicks.some((n) => n.endsWith(".pdf"))).toBe(true);
    expect(clicks.some((n) => n.endsWith(".md"))).toBe(false);
    vi.restoreAllMocks();
  });

  it("11. Remains readable on desktop, tablet and mobile widths", () => {
    for (const w of [1440, 820, 390]) {
      vi.stubGlobal("innerWidth", w);
      const { container, unmount } = renderPage();
      expect(container.querySelectorAll(".rep-cell").length).toBe(8);
      expect(container.querySelector("svg.maturity-meter")).not.toBeNull();
      expect(container.querySelector(".ev-nav-list")).not.toBeNull();
      unmount();
    }
  });

  it("12. Existing medicine pages keep their canonical values (unscored stays unscored)", () => {
    const atorva = report({
      medicine: "Atorvastatin", active_ingredient: "Atorvastatin",
      condition: "Cardiovascular disease prevention", drug_class: "Statin", study: "CARDS",
      total: 2838, level: 0, eff: "Insufficient evidence", saf: "Insufficient evidence",
      sourceId: "SRC-CARDS", sourceTitle: "CARDS", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/15325833/",
    });
    (atorva.maturity as any).scorable = false;
    (atorva.banner as any).maturity.scorable = false;
    const { container } = renderPage(atorva);
    expect(container.querySelector("svg.maturity-meter")!.textContent).toContain("—");
    expect(container.querySelector(".ev-mat-compact .ev-mat-v")!.textContent).toBe("—");
    expect(container.textContent).not.toContain("0 / 5");
    expect(container.querySelector(".nm-check")).toBeNull();
  });
});

describe("10. Cross-component consistency — no component contradicts another", () => {
  const cases: [string, EvidenceResponse][] = [
    ["Ozempic (analyzed, post hoc)", OZEMPIC],
    ["Wegovy (counted, not analyzed)", report({
      medicine: "Wegovy", active_ingredient: "Semaglutide", condition: "Weight management",
      drug_class: "GLP-1 receptor agonist", study: "STEP 1", total: 1961, womenReported: 1453, pct: 74.1,
      level: 1, matLabel: "Women Counted", eff: "Sex-specific effectiveness not reported",
      saf: "Sex-specific safety not reported", sourceId: "SRC-STEP", sourceTitle: "STEP 1",
      sourceUrl: "https://clinicaltrials.gov/study/NCT03548935",
    })],
    ["Valsartan (life-stage + hormone aware)", report({
      medicine: "Valsartan", active_ingredient: "Valsartan", condition: "Hypertension",
      drug_class: "Angiotensin receptor blocker", study: "HAYOZ-2012", total: 1200, womenReported: 400, pct: 33.3,
      level: 4, matLabel: "Hormone Aware", eff: "Sex-specific analysis reported",
      saf: "Reported by sex, no formal between-sex comparison", meno: 1, ht: 1, preg: 1, minAge: "40 Years",
      sourceId: "SRC-HAY", sourceTitle: "Hayoz 2012", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/23126349/",
    })],
  ];

  it.each(cases)("%s keeps every summary card in step with its detailed section", (_name, r) => {
    const { container } = renderPage(r);

    // maturity meter === maturity checklist === canonical level
    const level = M.maturity(r).level;
    const meter = container.querySelector("svg.maturity-meter")!;
    expect(meter.getAttribute("aria-label")).toContain(`${level} of 5`);
    const reached = container.querySelectorAll(".nm-check .nm-ic.on").length;
    expect(reached).toBe(level);

    // Women analyzed === Sex-specific outcomes (same wording, same tone)
    const analyzed = M.womenAnalyzed(r);
    const outcomes = cellFor(container, "Sex-specific outcomes");
    expect(outcomes.textContent).toContain(M.shortLabel(analyzed));
    expect(toneOf(outcomes)).toBe(analyzed.tone);
    const analyzedMetric = [...container.querySelectorAll(".ev-metric")]
      .find((m) => m.textContent!.includes("Women analyzed"))!;
    expect(analyzedMetric.textContent).toContain(analyzed.label);

    // Women-specific safety row === the safety section state
    const safety = M.safety(r);
    expect(toneOf(cellFor(container, "Sex-specific safety"))).toBe(safety.tone);
    expect(container.querySelector("#women-specific-safety")!.textContent).toContain(safety.label);

    // menopause + hormone therapy rows === the Hormonal Context section
    const hc = M.hormonalContext(r);
    expect(toneOf(cellFor(container, "Menopause"))).toBe(hc.menopauseRepresentation.tone);
    expect(toneOf(cellFor(container, "Hormone therapy"))).toBe(hc.hormoneTherapyRepresentation.tone);
    const hcSection = container.querySelector("#hormonal-context")! as HTMLElement;
    expect(within(hcSection).getByText("Menopause representation")).toBeInTheDocument();
    expect(hcSection.textContent).toContain(hc.menopauseRepresentation.label);
    expect(hcSection.textContent).toContain(hc.hormoneTherapyRepresentation.label);

    // pregnancy row === the canonical pregnancy dimension (a schema field, not a guess)
    expect(toneOf(cellFor(container, "Pregnancy"))).toBe(M.pregnancyEvidence(r).tone);
    expect(container.querySelector(".schema-panel")!.textContent).toContain("pregnancy");

    // age / older-women is reporting-derived, never inferred; race stays unestablished
    expect(toneOf(cellFor(container, "Older women or age reporting"))).toBe(M.ageReporting(r).tone);
    expect(toneOf(cellFor(container, "Race and ethnicity"))).toBe("incomplete");

    // Women included row === the Women in the evidence metric
    const included = M.womenIncluded(r);
    expect(toneOf(cellFor(container, "Women included"))).toBe(included.tone);
    const includedMetric = [...container.querySelectorAll(".ev-metric")]
      .find((m) => m.textContent!.includes("Women included"))!;
    expect(includedMetric.textContent).toContain(included.label);

    // human review status is identical wherever it appears
    const status = M.humanReviewStatus(r);
    const statusMentions = (container.textContent || "").match(/Human review (pending|completed)/gi) || [];
    statusMentions.forEach((m) => expect(m.toLowerCase()).toContain(status.toLowerCase()));
    expect(container.querySelector("#about-this-evidence-review")!.textContent).toContain(status);

    // source and passage counts stay consistent with the model
    const sources = M.sourceRecords(r).length;
    const passages = M.exactPassages(r).length;
    const coverage = container.querySelector("#source-coverage")! as HTMLElement;
    const sourcesCell = [...coverage.querySelectorAll(".ev-metric")]
      .find((m) => m.textContent!.includes("Sources reviewed"))!;
    expect(sourcesCell.querySelector(".ev-metric-v")!.textContent).toBe(String(sources));
    expect(container.querySelectorAll("#exact-passages .ev-passage").length).toBe(passages);
  });
});
