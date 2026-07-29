import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Compare } from "./Compare";

/** The Compare page reads canonical /api/check-evidence responses for the three GLP-1
 *  brands and renders three comparison cards. Nothing is hard-coded; maturity comes
 *  from the (mocked) canonical response. */

function report(over: any) {
  const level = over.level ?? 2;
  const scorable = over.scorable ?? true;
  return {
    query: { condition: over.condition },
    human_verification_status: "pending",
    banner: {
      medicine: over.medicine, active_ingredient: over.active_ingredient,
      brand_note: over.brand_note ?? null, drug_class: over.drug_class,
      indication: over.condition,
      known_adverse_effects: over.aes
        ? { list: over.aes, exact_passage: "…", source: { source_id: "SRC-DAILYMED-X", title: "PI", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } }
        : null,
      maturity: { level, max_level: 5, label: over.label, display: scorable ? `${level} / 5` : "Not yet established", scorable },
      effectiveness: { state: over.eff, headline: over.eff },
      safety: { state: over.saf, headline: over.saf },
    },
    maturity: {
      level, max_level: 5, label: over.label, display: scorable ? `${level} / 5` : "Not yet established", scorable,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
    effectiveness: { state: over.eff, findings: [] },
    safety: { state: over.saf, significant_findings: [],
      other_findings: over.bySex ? [{ female_rate: over.bySex.f, male_rate: over.bySex.m }] : [] },
    totals: {
      participants_total: over.total, women_reported_count: over.womenReported ?? 0,
      women_estimated_total: over.womenEstimated ?? over.womenReported ?? 0,
      women_pct_of_participants: over.pct,
    },
    trials: [{ display_name: over.study }],
    studies_behind: [{ study: over.study, source_url: over.sourceUrl }],
  };
}

const OZEMPIC = report({ medicine: "Ozempic", active_ingredient: "Semaglutide", condition: "Type 2 diabetes",
  drug_class: "GLP-1 receptor agonist", study: "SUSTAIN-6", total: 3297, womenReported: 1295, pct: 39.3,
  level: 2, label: "Women Analyzed", eff: "No statistically significant sex difference identified",
  saf: "Sex-specific safety signal reported", sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/",
  aes: ["Nausea", "Vomiting", "Diarrhea", "Abdominal pain", "Constipation"],
  bySex: { f: "55.6% GI adverse events with semaglutide (women)", m: "48.5% GI adverse events with semaglutide (men)" } });
const WEGOVY = report({ medicine: "Wegovy", active_ingredient: "Semaglutide", condition: "Weight management",
  drug_class: "GLP-1 receptor agonist", study: "STEP 1", total: 1961, womenReported: 1453, pct: 74.1,
  level: 1, label: "Women Counted", eff: "Sex-specific effectiveness not reported",
  saf: "Sex-specific safety not reported", sourceUrl: "https://clinicaltrials.gov/study/NCT03548935",
  aes: ["Nausea", "Vomiting", "Diarrhea", "Constipation", "Fatigue"] });
const MOUNJARO = report({ medicine: "Mounjaro", active_ingredient: "Tirzepatide", condition: "Type 2 diabetes",
  drug_class: "Dual GIP/GLP-1 receptor agonist",
  brand_note: "Tirzepatide is marketed as Zepbound for weight management. This card reviews the Mounjaro type 2 diabetes evidence.",
  study: "SURPASS-2", total: 1879, womenReported: 0, womenEstimated: 996, pct: 53.0,
  level: 2, label: "Women Analyzed", eff: "Sex-specific analysis reported, statistical comparison unclear",
  saf: "Sex-specific safety signal reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/34170647/",
  aes: ["Nausea", "Vomiting", "Diarrhea", "Decreased appetite", "Constipation", "Abdominal pain"],
  bySex: { f: "46.8% (154/329) Mounjaro vs 25.7% (29/113) placebo (women)", m: "34.4% (134/389) Mounjaro vs 15.6% (19/122) placebo (men)" } });

function mockFetch() {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, opts: any) => {
    const body = JSON.parse(opts.body);
    const map: any = { Ozempic: OZEMPIC, Wegovy: WEGOVY, Mounjaro: MOUNJARO };
    return { ok: true, json: async () => map[body.medicine] };
  }) as any);
}
afterEach(() => vi.unstubAllGlobals());
const renderPage = () => render(<MemoryRouter><Compare /></MemoryRouter>);

describe("Compare Women's Evidence", () => {
  it("renders three brand cards with brand + active ingredient", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".cmp-card").length).toBe(3));
    for (const brand of ["Ozempic", "Wegovy", "Mounjaro"]) {
      expect(screen.getByText(brand)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Semaglutide").length).toBe(2); // Ozempic + Wegovy
    expect(screen.getByText("Tirzepatide")).toBeInTheDocument();
  });

  it("shows the required comparison-warning note and an evidence-scope note", async () => {
    mockFetch();
    renderPage();
    expect(await screen.findByText(/do not rank medicines or compare clinical effectiveness/i)).toBeInTheDocument();
    expect(screen.getByText(/defined studies and regulatory sources currently reviewed/i)).toBeInTheDocument();
  });

  it("distinguishes Women Counted (Wegovy) from Women Analyzed (Ozempic)", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".cmp-card").length).toBe(3));
    const cards = [...container.querySelectorAll(".cmp-card")] as HTMLElement[];
    const oze = cards.find((c) => c.textContent!.includes("Ozempic"))!;
    const weg = cards.find((c) => c.textContent!.includes("Wegovy"))!;
    expect(within(oze).getByText("Women analyzed")).toBeInTheDocument();
    expect(within(weg).getByText("Women counted, not yet analyzed")).toBeInTheDocument();
  });

  it("preserves participant numbers and the Mounjaro Zepbound distinction", async () => {
    mockFetch();
    renderPage();
    await screen.findByText("Ozempic");
    expect(screen.getByText(/39.3%.*1,295 of 3,297/)).toBeInTheDocument();
    expect(screen.getByText(/74.1%.*1,453 of 1,961/)).toBeInTheDocument();
    expect(screen.getByText(/53%.*~996 of 1,879/)).toBeInTheDocument();
    expect(screen.getByText(/marketed as Zepbound/i)).toBeInTheDocument();
  });

  it("does not rank medicines or use superiority language, and names no celebrity", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".cmp-card").length).toBe(3));
    const text = (container.textContent || "").toLowerCase();
    for (const banned of ["better than", "more effective", "safer than", "best ", "ranked", "schumer"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("provides working exact-passage links", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".cmp-card").length).toBe(3));
    const links = [...container.querySelectorAll("a.cmp-passage")] as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(links.every((a) => /^https?:\/\//.test(a.href))).toBe(true);
  });
});

describe("Compare — two safety layers (overall adverse effects vs women-specific)", () => {
  const cardFor = async (brand: string) => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".cmp-card").length).toBe(3));
    return [...container.querySelectorAll(".cmp-card")].find((c) => c.textContent!.includes(brand)) as HTMLElement;
  };

  it("shows Ozempic overall adverse effects and bounded by-sex GI reporting", async () => {
    const oze = await cardFor("Ozempic");
    expect(within(oze).getByText(/Known adverse effects/i)).toBeInTheDocument();
    ["Nausea", "Vomiting", "Diarrhea", "Abdominal pain", "Constipation"].forEach((ae) =>
      expect(oze.textContent).toContain(ae));
    expect(oze.textContent).toContain("55.6%");   // women GI
    expect(oze.textContent).toContain("48.5%");   // men GI
    expect(oze.textContent!.toLowerCase()).not.toContain("statistically greater");
  });

  it("lists Wegovy nausea, vomiting and fatigue, and does NOT infer women-specific safety", async () => {
    const weg = await cardFor("Wegovy");
    ["Nausea", "Vomiting", "Fatigue"].forEach((ae) => expect(weg.textContent).toContain(ae));
    expect(weg.textContent).toMatch(/Sex-specific safety not reported/i);
    // No fabricated by-sex percentages for Wegovy.
    expect(weg.querySelector(".cmp-bysex")).toBeNull();
  });

  it("shows Mounjaro overall adverse effects (no fatigue) and preserves female/male GI separately", async () => {
    const mou = await cardFor("Mounjaro");
    ["Nausea", "Vomiting", "Diarrhea", "Decreased appetite"].forEach((ae) =>
      expect(mou.textContent).toContain(ae));
    expect(mou.textContent).not.toContain("Fatigue");
    expect(mou.textContent).toContain("46.8%");   // women
    expect(mou.textContent).toContain("34.4%");   // men
    expect(mou.textContent).toContain("25.7%");   // women placebo
  });
});
