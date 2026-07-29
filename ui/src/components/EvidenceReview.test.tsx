import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceReview, SECTIONS } from "./EvidenceReview";
import type { EvidenceResponse } from "../api";

/** The approved Check Evidence review renders the approved sections, in the approved
 *  order, from canonical data only. Women counted and women analyzed stay separate,
 *  overall adverse effects stay separate from women-specific safety, and a missing
 *  analysis is never presented as evidence of no difference. */

function report(o: any): EvidenceResponse {
  const level = o.level ?? 2;
  return {
    supported: true,
    dataset_version: "3.0.0",
    source_cutoff: "2026-07-18",
    human_verification_status: o.review ?? "pending",
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: o.medicine, active_ingredient: o.active_ingredient, brand_note: o.brand_note ?? null,
      drug_class: o.drug_class, indication: o.condition,
      known_adverse_effects: o.aes
        ? { list: o.aes, exact_passage: "Adverse reactions reported in the prescribing information.",
            source: { source_id: "SRC-PI", title: "Prescribing information", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } }
        : null,
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: o.scorable !== false },
      effectiveness: { state: o.eff, headline: o.eff },
      safety: { state: o.saf, headline: o.saf },
    },
    maturity: {
      level, max_level: 5, label: o.matLabel ?? "Women Analyzed",
      display: `${level} / 5`, scorable: o.scorable !== false,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
    effectiveness: { state: o.eff, headline: o.effHeadline ?? o.eff, findings: o.findings ?? [] },
    safety: { state: o.saf, headline: o.saf, significant_findings: [], other_findings: [] },
    dimensions: o.dimensions ?? [],
    evidence_gaps: [{ dimension: "menopause_status_reported", label: "Menopause", n_reporting: 0, n_trials: 1,
      statement: "No reviewed study reported menopausal status." }],
    trials: [{ display_name: o.study, study_type: "Randomized Controlled Trial" }],
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
  drug_class: "GLP-1 receptor agonist", study: "SUSTAIN-6 trial", total: 3297, womenReported: 1295, pct: 39.3,
  eff: "No statistically significant sex difference identified", saf: "Sex-specific safety signal reported",
  aes: ["Nausea", "Vomiting", "Diarrhea", "Abdominal pain", "Constipation", "Fatigue"],
  sourceId: "SRC-PMID-31167654", sourceTitle: "Sex-based SUSTAIN-6 analysis",
  sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/",
  findings: [{
    finding_id: "F-1", scope: "SUSTAIN-6", interpretation: "Sex-specific analysis reported.",
    exact_passage: "Women comprised 1295 of the 3297 randomised participants.",
    source_locator: "Table 2",
    source: { source_id: "SRC-PMID-31167654", title: "Sex-based SUSTAIN-6 analysis", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/" },
  }],
});

const WEGOVY = report({
  medicine: "Wegovy", active_ingredient: "Semaglutide", condition: "Weight management",
  drug_class: "GLP-1 receptor agonist", study: "STEP 1", total: 1961, womenReported: 1453, pct: 74.1,
  level: 1, eff: "Sex-specific effectiveness not reported", saf: "Sex-specific safety not reported",
  matLabel: "Women Counted", aes: ["Nausea"], sourceId: "SRC-STEP", sourceTitle: "STEP 1",
  sourceUrl: "https://clinicaltrials.gov/study/NCT03548935",
});

const render_ = (r: EvidenceResponse) => render(<EvidenceReview report={r} />);
const section = (c: HTMLElement, id: string) => c.querySelector(`#${id}`) as HTMLElement;

describe("Check Evidence — approved review layout", () => {
  it("Renders the approved section navigation, in order, with an export action", () => {
    const { container } = render_(OZEMPIC);
    const labels = [...container.querySelectorAll(".ev-nav-label")].map((n) => n.textContent);
    // Without the summary components, only the detailed sections are offered — a link
    // is never shown for a section that is not on the page.
    expect(labels).toEqual([
      "Evidence Summary", "Women in the Evidence", "Sex-specific Effectiveness", "Women-specific Safety",
      "Common Adverse Effects", "Life-stage Evidence", "Hormonal Context", "Exact Passages",
      "Source Coverage", "About This Evidence Review",
    ]);
    expect(container.querySelector(".ev-nav-export-h")!.textContent).toBe("Export Evidence Brief PDF");
  });

  it("Every navigation link points at a section that exists on the page", () => {
    const { container } = render_(OZEMPIC);
    const links = [...container.querySelectorAll(".ev-nav-link")] as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
    // Every detailed section is reachable.
    for (const s of SECTIONS.filter((x) => !["important-finding", "representation", "remains-unknown", "ai-found"].includes(x.id))) {
      expect(container.querySelector(`a[href="#${s.id}"]`)).not.toBeNull();
    }
  });

  it("Clicking a section link scrolls to that exact section", () => {
    const { container } = render_(OZEMPIC);
    const calls: string[] = [];
    const links = [...container.querySelectorAll(".ev-nav-link")] as HTMLAnchorElement[];
    const ids = links.map((l) => l.getAttribute("href")!.slice(1));
    ids.forEach((id) => {
      const el = container.querySelector(`#${id}`) as HTMLElement;
      el.scrollIntoView = vi.fn(() => calls.push(id)) as any;
    });
    links.forEach((l) => fireEvent.click(l));
    expect(calls).toEqual(ids);
  });

  it("Marks exactly one section as active, and never drops the navigation", () => {
    const { container } = render_(OZEMPIC);
    const active = container.querySelectorAll(".ev-nav-link.active");
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("aria-current")).toBe("true");
    // The list is always present — restoring other components must not displace it.
    expect(container.querySelectorAll(".ev-nav-link").length).toBeGreaterThanOrEqual(10);
  });

  it("Offers a compact 'Jump to section' menu that opens and closes", () => {
    const { container } = render_(OZEMPIC);
    const toggle = screen.getByRole("button", { name: /Jump to section/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("ev-nav-list");
    expect(container.querySelector("#ev-nav-list")!.classList.contains("open")).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#ev-nav-list")!.classList.contains("open")).toBe(true);
    // Choosing a section closes the menu again.
    fireEvent.click(container.querySelector(`a[href="#exact-passages"]`)!);
    expect(container.querySelector("#ev-nav-list")!.classList.contains("open")).toBe(false);
  });

  it("Keeps the Export Evidence Brief PDF action beneath the navigation", () => {
    const { container } = render_(OZEMPIC);
    const nav = container.querySelector(".ev-nav")!;
    const list = nav.querySelector(".ev-nav-list")!;
    const exportPanel = nav.querySelector(".ev-nav-export")!;
    expect(exportPanel).not.toBeNull();
    // Document order: the list comes before the export panel, inside the same nav.
    expect(list.compareDocumentPosition(exportPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(exportPanel.querySelector(".ev-export-btn")).not.toBeNull();
  });

  it("5. Shows the active ingredient separately (never inside the medicine name)", () => {
    const { container } = render_(OZEMPIC);
    expect(container.querySelector(".ev-med-name")!.textContent).toBe("Ozempic");
    expect(container.querySelector(".ev-med-ing")!.textContent).toBe("semaglutide");
    expect(container.querySelector(".ev-med-name")!.textContent).not.toContain("semaglutide");
  });

  it("7. Women in the Evidence uses canonical counts and keeps counted/analyzed separate", () => {
    const { container } = render_(OZEMPIC);
    const s = section(container, "women-in-the-evidence");
    expect(within(s).getByText("Women included")).toBeInTheDocument();
    expect(s.textContent).toContain("1,295 of 3,297");
    expect(s.textContent).toContain("39.3%");
    expect(within(s).getByText("Women counted")).toBeInTheDocument();
    expect(within(s).getByText("Women analyzed")).toBeInTheDocument();
    expect(within(s).getByText("Evidence population")).toBeInTheDocument();
    expect(s.textContent).toContain("SUSTAIN-6 trial");
  });

  it("Does not convert a missing sex-specific analysis into evidence of no difference", () => {
    const { container } = render_(WEGOVY);
    const women = section(container, "women-in-the-evidence");
    // 74.1% women, but the outcomes were never analysed by sex.
    expect(women.textContent).toContain("74.1%");
    const analyzed = [...women.querySelectorAll(".ev-metric")]
      .find((m) => m.textContent!.includes("Women analyzed"))!;
    expect(analyzed.textContent).toContain("Not established");
    expect(analyzed.textContent).not.toContain("Yes");
    const eff = section(container, "sex-specific-effectiveness");
    expect(eff.textContent).toContain("Sex-specific effectiveness not reported");
    expect(eff.textContent).not.toMatch(/no (statistically significant )?(sex )?difference/i);
  });

  it("Keeps overall adverse effects separate from women-specific safety", () => {
    const { container } = render_(OZEMPIC);
    const ae = section(container, "common-adverse-effects");
    expect(ae.textContent).toContain("From reviewed sources");
    ["Nausea", "Vomiting", "Diarrhea", "Fatigue"].forEach((x) => expect(ae.textContent).toContain(x));
    expect(ae.textContent).toMatch(/not, on their own, evidence of a sex-specific effect/i);
    const saf = section(container, "women-specific-safety");
    expect(saf.textContent).toContain("Sex-specific safety signal reported");
    expect(saf.textContent).not.toContain("Nausea");
  });

  it("Shows the three hormonal-context questions separately and never infers menopause from age", () => {
    const { container } = render_(OZEMPIC);
    const hc = section(container, "hormonal-context");
    expect(within(hc).getByText("Menopause representation")).toBeInTheDocument();
    expect(within(hc).getByText("Hormone therapy representation")).toBeInTheDocument();
    expect(within(hc).getByText("Hormonal-context analysis")).toBeInTheDocument();
    expect(section(container, "life-stage-evidence").textContent)
      .toMatch(/never inferred from age/i);
  });

  it("8. Exact passages link to the supporting source record", () => {
    const { container } = render_(OZEMPIC);
    const p = section(container, "exact-passages");
    expect(p.textContent).toContain("Women comprised 1295 of the 3297 randomised participants.");
    expect(p.textContent).toContain("SRC-PMID-31167654");
    expect(p.textContent).toContain("Table 2");
    const link = p.querySelector("a") as HTMLAnchorElement;
    expect(link.href).toBe("https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("Reports the human review status accurately and never claims completed review", () => {
    const { container } = render_(OZEMPIC);
    const about = section(container, "about-this-evidence-review");
    expect(about.textContent).toContain("Human review status");
    expect(about.textContent).toContain("Pending");
    expect(about.textContent).not.toContain("Completed");
    expect(about.textContent).toContain("2026-07-18");
    expect(about.textContent).toContain("Limitations");
    expect(about.textContent).toMatch(/does not diagnose, prescribe, recommend treatment/i);
  });

  it("Never scores an unscorable medicine as 0 / 5", () => {
    const unscored = report({
      medicine: "Atorvastatin", active_ingredient: "Atorvastatin", condition: "Cardiovascular disease prevention",
      drug_class: "Statin", study: "CARDS", total: 2838, level: 0, scorable: false,
      eff: "Insufficient evidence", saf: "Insufficient evidence",
      sourceId: "SRC-CARDS", sourceTitle: "CARDS", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/15325833/",
    });
    const { container } = render(<EvidenceReview report={unscored} />);
    // No fabricated score anywhere in the identity column.
    expect(container.textContent).not.toContain("0 / 5");
    expect(container.querySelector(".ev-identity")!.textContent).not.toMatch(/\d\s*\/\s*5/);
  });

  it("Displays every evidence state with a text label, never colour alone", () => {
    const { container } = render_(OZEMPIC);
    const chips = [...container.querySelectorAll(".ev-chip")];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const label = chip.textContent!.replace(/[✓✕!?]/g, "").trim();
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it("Counts only the sources reviewed for THIS medicine, not the whole corpus", () => {
    // The API returns the corpus-wide source list; a medicine's coverage must come
    // from its own trial assertions and findings.
    const scoped = {
      ...OZEMPIC,
      sources: [
        ...(OZEMPIC.sources as any),
        { source_id: "SRC-UNRELATED-1", title: "Another medicine's trial", url: "https://example.invalid/a" },
        { source_id: "SRC-UNRELATED-2", title: "Yet another trial", url: "https://example.invalid/b" },
      ],
      trials: [{
        display_name: "SUSTAIN-6 trial", study_type: "Randomized Controlled Trial",
        assertions: [{ source: { source_id: "SRC-NCT01720446", title: "SUSTAIN-6 registry record", url: "https://clinicaltrials.gov/study/NCT01720446" } }],
      }],
    } as unknown as EvidenceResponse;
    const { container } = render(<EvidenceReview report={scoped} />);
    const s = section(container, "source-coverage");
    expect(s.textContent).toContain("SUSTAIN-6 registry record");
    expect(s.textContent).toContain("Sex-based SUSTAIN-6 analysis");
    expect(s.textContent).not.toContain("Another medicine's trial");
    // Its own three: the registry record, the sex-specific analysis, and the
    // prescribing information behind the adverse-effects list.
    const sourcesReviewed = [...s.querySelectorAll(".ev-metric")]
      .find((m) => m.textContent!.includes("Sources reviewed"))!;
    expect(sourcesReviewed.querySelector(".ev-metric-v")!.textContent).toBe("3");
    expect(s.textContent).toContain("Prescribing information");
  });

  it("6. The evidence brief export button keeps its label on one line", () => {
    const { container } = render_(OZEMPIC);
    const btn = container.querySelector(".ev-export-btn") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).not.toMatch(/\n/);
    expect(screen.getByRole("button", { name: /Export PDF/i })).toBeInTheDocument();
  });
});
