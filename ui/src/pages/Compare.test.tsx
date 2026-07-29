import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Compare } from "./Compare";

/** Compare Evidence is CONTEXTUAL, DYNAMIC and ALIGNED. The comparison set is derived
 *  from the selected CONDITION via the canonical catalog (/api/catalog) — never a
 *  hard-coded medicine list. These tests drive the page from the URL context and a
 *  mocked catalog, and assert the approved rules. */

const CATALOG = {
  health_areas: [
    {
      health_area: "Cardiovascular",
      conditions: [
        {
          condition: "Heart failure",
          drug_classes: [
            { drug_class: "SGLT2 inhibitor", medicines: [{ medicine: "Dapagliflozin", status: "verified", active_ingredient: "Dapagliflozin" }] },
            { drug_class: "Cardiac glycoside", medicines: [{ medicine: "Digoxin", status: "verified", active_ingredient: "Digoxin" }] },
            { drug_class: "Angiotensin receptor blocker", medicines: [{ medicine: "Valsartan", status: "verified", active_ingredient: "Valsartan" }] },
          ],
        },
        {
          condition: "Cardiovascular disease prevention",
          drug_classes: [
            {
              drug_class: "Statin",
              medicines: [
                { medicine: "Rosuvastatin", status: "verified", active_ingredient: "Rosuvastatin" },
                { medicine: "Atorvastatin", status: "incomplete", active_ingredient: "Atorvastatin" },
              ],
            },
          ],
        },
      ],
    },
    {
      health_area: "Metabolic Health",
      conditions: [
        {
          condition: "Type 2 diabetes",
          drug_classes: [
            { drug_class: "GLP-1 receptor agonist", medicines: [{ medicine: "Ozempic", status: "verified", active_ingredient: "Semaglutide" }] },
            { drug_class: "Dual GIP/GLP-1 receptor agonist", medicines: [{ medicine: "Mounjaro", status: "verified", active_ingredient: "Tirzepatide" }] },
            { drug_class: "Thiazolidinedione", medicines: [{ medicine: "Pioglitazone", status: "verified", active_ingredient: "Pioglitazone" }] },
          ],
        },
        {
          condition: "Weight management",
          drug_classes: [
            { drug_class: "GLP-1 receptor agonist", medicines: [{ medicine: "Wegovy", status: "verified", active_ingredient: "Semaglutide" }] },
          ],
        },
      ],
    },
  ],
};

function report(o: any) {
  const level = o.level ?? 2;
  return {
    supported: true,
    dataset_version: "3.0.0",
    source_cutoff: "2026-07-18",
    human_verification_status: o.review ?? "pending",
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: o.medicine, active_ingredient: o.active_ingredient ?? null,
      brand_note: o.brand_note ?? null, drug_class: o.drug_class, indication: o.condition,
      known_adverse_effects: o.aes
        ? { list: o.aes, exact_passage: "Adverse reactions reported in prescribing information.",
            source: { source_id: "SRC-PI", title: "Prescribing information", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } }
        : null,
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true },
      effectiveness: { state: o.eff, headline: o.effHeadline ?? o.eff },
      safety: { state: o.saf, headline: o.safHeadline ?? o.saf },
    },
    maturity: {
      level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
    effectiveness: { state: o.eff, headline: o.effHeadline ?? o.eff, findings: [] },
    safety: { state: o.saf, headline: o.safHeadline ?? o.saf, significant_findings: [], other_findings: [] },
    dimensions: [],
    evidence_gaps: [],
    totals: {
      participants_total: o.total ?? 1000, women_reported_count: o.womenReported ?? 0,
      women_estimated_total: o.womenEstimated ?? o.womenReported ?? 0, women_pct_of_participants: o.pct ?? null,
    },
    trials: [{ display_name: o.study ?? "STUDY", study_type: "Randomized Controlled Trial" }],
    studies_behind: [{ study: o.study ?? "STUDY", source_url: o.sourceUrl ?? "https://clinicaltrials.gov/" }],
    sources: [{ source_id: o.sourceId ?? "SRC-1", title: o.study ?? "STUDY", url: o.sourceUrl ?? "https://clinicaltrials.gov/" }],
  };
}

const REPORTS: Record<string, any> = {
  Digoxin: report({ medicine: "Digoxin", active_ingredient: "Digoxin", condition: "Heart failure", drug_class: "Cardiac glycoside", study: "DIG Trial", total: 6800, womenReported: 1520, pct: 22.4, level: 3, eff: "Conflicting sex-specific results", saf: "Sex-specific safety signal reported", aes: ["Nausea", "Arrhythmia"], sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/9036306/", sourceId: "SRC-DIG" }),
  Dapagliflozin: report({ medicine: "Dapagliflozin", active_ingredient: "Dapagliflozin", condition: "Heart failure", drug_class: "SGLT2 inhibitor", study: "DAPA-HF", total: 4744, womenReported: 1109, pct: 23.4, level: 2, eff: "No statistically significant sex difference identified", effHeadline: "Women HR 0.79 (95% CI 0.59-1.06) versus men HR 0.73 (0.63-0.85); interaction P=0.67.", saf: "Reported by sex, no formal between-sex comparison", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/31535829/", sourceId: "SRC-DAPA" }),
  Valsartan: report({ medicine: "Valsartan", active_ingredient: "Valsartan", condition: "Heart failure", drug_class: "Angiotensin receptor blocker", study: "HAYOZ-2012", total: 1200, womenReported: 400, pct: 33.3, level: 4, eff: "Sex-specific analysis reported", saf: "Sex-specific safety not reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/22best/", sourceId: "SRC-HAY" }),
  Rosuvastatin: report({ medicine: "Rosuvastatin", active_ingredient: "Rosuvastatin", condition: "Cardiovascular disease prevention", drug_class: "Statin", study: "JUPITER", total: 17802, womenReported: 6801, pct: 38.2, level: 2, eff: "Sex-specific analysis reported", saf: "Sex-specific safety not reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/18997196/", sourceId: "SRC-JUP" }),
  Ozempic: report({ medicine: "Ozempic", active_ingredient: "Semaglutide", condition: "Type 2 diabetes", drug_class: "GLP-1 receptor agonist", study: "SUSTAIN-6 trial", total: 3297, womenReported: 1295, pct: 39.3, level: 2, eff: "No statistically significant sex difference identified", saf: "Sex-specific safety signal reported", aes: ["Nausea", "Vomiting"], sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/", sourceId: "SRC-SUS" }),
  Mounjaro: report({ medicine: "Mounjaro", active_ingredient: "Tirzepatide", condition: "Type 2 diabetes", drug_class: "Dual GIP/GLP-1 receptor agonist", study: "SURPASS-2 trial", total: 1879, womenEstimated: 996, pct: 53.0, level: 2, eff: "Sex-specific analysis reported", saf: "Sex-specific safety signal reported", brand_note: "Tirzepatide is marketed as Zepbound for weight management.", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/34170647/", sourceId: "SRC-SUR" }),
  Pioglitazone: report({ medicine: "Pioglitazone", active_ingredient: "Pioglitazone", condition: "Type 2 diabetes", drug_class: "Thiazolidinedione", study: "PROactive trial", total: 5238, womenReported: 1775, pct: 33.9, level: 1, eff: "Sex-specific effectiveness not reported", saf: "Sex-specific safety signal reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/16214598/", sourceId: "SRC-PRO" }),
  Wegovy: report({ medicine: "Wegovy", active_ingredient: "Semaglutide", condition: "Weight management", drug_class: "GLP-1 receptor agonist", study: "STEP 1", total: 1961, womenReported: 1453, pct: 74.1, level: 1, eff: "Sex-specific effectiveness not reported", saf: "Sex-specific safety not reported", aes: ["Nausea"], sourceUrl: "https://clinicaltrials.gov/study/NCT03548935", sourceId: "SRC-STEP" }),
};

function mockFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: any, opts: any) => {
    if (typeof url === "string" && url.includes("/api/catalog")) {
      return { ok: true, json: async () => CATALOG } as any;
    }
    const body = JSON.parse(opts.body);
    return { ok: true, json: async () => REPORTS[body.medicine] } as any;
  }) as any);
}

function setCtx(params: Record<string, string>) {
  window.history.pushState({}, "", `/amira/compare-evidence?${new URLSearchParams(params).toString()}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

const colNames = (c: HTMLElement) => [...c.querySelectorAll(".cmp-colname")].map((n) => n.textContent);
const rowLabels = (c: HTMLElement) => [...c.querySelectorAll(".cmp-cell.label")].map((n) => n.textContent);

describe("Compare Evidence — dynamic comparison from the selected condition", () => {
  it("11+12. Digoxin (Heart failure) compares heart-failure medicines and NEVER defaults to GLP-1", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    expect(colNames(container)).toEqual(["Digoxin", "Dapagliflozin", "Valsartan"]);
    for (const glp1 of ["Ozempic", "Wegovy", "Mounjaro", "GLP-1"]) {
      expect(container.textContent).not.toContain(glp1);
    }
  });

  it("14. The selected medicine appears first and is labelled 'Selected medicine'", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Mounjaro" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    // Mounjaro is neither alphabetically nor catalog-order first, yet it leads.
    expect(colNames(container)[0]).toBe("Mounjaro");
    const firstHead = container.querySelector(".cmp-colhead")!;
    expect(firstHead.classList.contains("selected")).toBe(true);
    expect(firstHead.querySelector(".cmp-selbadge")!.textContent).toMatch(/Selected medicine/i);
    expect(container.querySelectorAll(".cmp-selbadge").length).toBe(1);
  });

  it("30. On a narrow viewport one medicine shows at a time, and a peer is never mislabelled as selected", async () => {
    // matchMedia reports a narrow viewport, so the page switches to the
    // one-medicine-at-a-time pattern used on tablet and mobile.
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: true, media: q, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
    }));
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-switch-btn").length).toBe(3));
    // One column, the selected medicine, correctly badged.
    expect(colNames(container)).toEqual(["Ozempic"]);
    expect(container.querySelectorAll(".cmp-selbadge").length).toBe(1);

    // Switch to a peer: the row order is unchanged and NO selected badge is shown.
    const rowsBefore = rowLabels(container);
    fireEvent.click(screen.getByRole("button", { name: /Mounjaro/ }));
    await waitFor(() => expect(colNames(container)).toEqual(["Mounjaro"]));
    expect(container.querySelectorAll(".cmp-selbadge").length).toBe(0);
    expect(container.querySelector(".cmp-colhead")!.classList.contains("selected")).toBe(false);
    expect(rowLabels(container)).toEqual(rowsBefore);
  });

  it("13. Wegovy shows a valid one-medicine state when no peer exists in the condition", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Weight management", medicine: "Wegovy" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(1));
    expect(colNames(container)).toEqual(["Wegovy"]);
    expect(await screen.findByText(/No other reviewed medicines are currently available for comparison within Weight management/i))
      .toBeInTheDocument();
    for (const other of ["Ozempic", "Mounjaro", "Pioglitazone", "Digoxin"]) {
      expect(container.textContent).not.toContain(other);
    }
  });

  it("Ozempic (Type 2 diabetes) excludes Wegovy despite the shared active ingredient", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    expect(colNames(container)).toEqual(["Ozempic", "Mounjaro", "Pioglitazone"]);
    expect(container.textContent).not.toContain("Wegovy");
  });

  it("16. Every evidence row is present once, in the approved order, aligned across columns", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    expect(rowLabels(container)).toEqual([
      "Evidence about women", "Evidence maturity", "Active ingredient", "Condition", "Drug class",
      "Primary evidence", "Women included", "Women counted", "Women analyzed",
      "Sex-specific effectiveness", "Women-specific safety", "Common adverse effects",
      "Life-stage evidence", "Hormonal context", "Human review status", "Evidence scope",
      "Exact passages", "Export Evidence Brief PDF",
    ]);
    // Alignment: every evidence row is followed by exactly one value cell per medicine,
    // so one medicine's longer text can never push later rows out of step. (The column
    // header row is skipped — its medicine cells are .cmp-colhead, not .cmp-cell.)
    const cells = [...container.querySelectorAll(".cmp-cell")];
    const labelIdx = cells.map((c, i) => (c.classList.contains("label") ? i : -1)).filter((i) => i >= 0);
    for (let i = 2; i < labelIdx.length; i++) {
      expect(labelIdx[i] - labelIdx[i - 1]).toBe(4); // 1 label + 3 medicine columns
    }
    expect(cells.filter((c) => c.classList.contains("value")).length).toBe((rowLabels(container).length - 1) * 3);
  });

  it("17. Pioglitazone shows its active ingredient (not blank)", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Pioglitazone" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    expect(colNames(container)[0]).toBe("Pioglitazone");
    expect(container.querySelector(".cmp-colhead")!.textContent).toContain("pioglitazone");
    const cells = [...container.querySelectorAll(".cmp-cell")];
    const ingredientRow = cells.findIndex((c) => c.classList.contains("label") && c.textContent === "Active ingredient");
    expect(cells[ingredientRow + 1].textContent).toBe("pioglitazone");
  });

  it("18. Mounjaro's counts match its named evidence scope (SURPASS-2), never a pooled figure", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Mounjaro" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    const cells = [...container.querySelectorAll(".cmp-cell")];
    const at = (label: string) => {
      const i = cells.findIndex((c) => c.classList.contains("label") && c.textContent === label);
      return cells[i + 1].textContent || "";
    };
    expect(at("Primary evidence")).toContain("SURPASS-2");
    expect(at("Women included")).toContain("1,879");   // the SURPASS-2 denominator
    expect(at("Women included")).toContain("53%");
  });

  it("19. No clinical ranking or superiority language is displayed", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    const text = (container.textContent || "").toLowerCase();
    for (const banned of ["better than", "more effective", "safer than", "ranked", "best choice", "schumer", "recommend this"]) {
      expect(text).not.toContain(banned);
    }
    expect(container.textContent).toMatch(/do not\s+recommend one medicine over another/i);
  });

  it("10. Shows the required disclaimer exactly once, above the comparison", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(3));
    expect(container.querySelectorAll(".cmp-note").length).toBe(1);
  });
});

describe("Compare Evidence — Edit Comparison", () => {
  const openEditor = async (ctx: Record<string, string>, columns: number) => {
    mockFetch();
    setCtx(ctx);
    const view = render(<Compare />);
    await waitFor(() => expect(view.container.querySelectorAll(".cmp-colname").length).toBe(columns));
    fireEvent.click(screen.getByRole("button", { name: /Edit Comparison/i }));
    return view;
  };

  it("15. Offers only medicines registered under the same condition", async () => {
    const { container } = await openEditor(
      { healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" }, 3);
    const options = [...container.querySelectorAll(".cmp-editor-item")].map((n) => n.textContent || "");
    expect(options.length).toBe(3);
    expect(options.join(" ")).toContain("Ozempic");
    expect(options.join(" ")).toContain("Mounjaro");
    expect(options.join(" ")).toContain("Pioglitazone");
    expect(options.join(" ")).not.toContain("Wegovy");   // different condition
    expect(options.join(" ")).not.toContain("Digoxin");
  });

  it("Keeps the selected medicine locked in, and removing a peer drops its column", async () => {
    const { container } = await openEditor(
      { healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" }, 3);
    const selected = container.querySelector("#cmp-pick-Digoxin") as HTMLInputElement;
    expect(selected.checked).toBe(true);
    expect(selected.disabled).toBe(true);              // cannot be removed

    fireEvent.click(container.querySelector("#cmp-pick-Valsartan") as HTMLInputElement);
    await waitFor(() => expect(container.querySelectorAll(".cmp-colname").length).toBe(2));
    expect(colNames(container)).toEqual(["Digoxin", "Dapagliflozin"]);
  });

  it("Labels an incomplete evidence review and never scores it", async () => {
    const { container } = await openEditor(
      { healthArea: "Cardiovascular", condition: "Cardiovascular disease prevention", medicine: "Rosuvastatin" }, 2);
    expect(container.querySelector(".cmp-editor")!.textContent).toMatch(/Atorvastatin · evidence review incomplete/i);
    const heads = [...container.querySelectorAll(".cmp-colhead")];
    const ator = heads.find((h) => h.textContent!.includes("Atorvastatin"))!;
    expect(ator.querySelector(".cmp-incomplete-badge")!.textContent).toMatch(/Evidence review incomplete/i);
    const cells = [...container.querySelectorAll(".cmp-cell")];
    const matIdx = cells.findIndex((c) => c.classList.contains("label") && c.textContent === "Evidence maturity");
    expect(cells[matIdx + 2].textContent).toBe("Not scored");   // second column = Atorvastatin
  });
});

describe("Compare Evidence — reviewed source coverage", () => {
  it("11. Computes coverage from the displayed medicines (never a hard-coded aggregate)", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelector(".cmp-coverage")).not.toBeNull());
    await waitFor(() => expect(container.querySelectorAll(".cmp-cov-cell").length).toBe(7));
    const cov = container.querySelector(".cmp-coverage")!;
    expect(cov.textContent).toContain("Reviewed source coverage");
    expect(cov.textContent).not.toContain("Guideline");
    expect(cov.textContent).toMatch(/AMIRA reports what is known from the reviewed sources/i);
    // 3 medicines displayed, all with women counted; only Valsartan (level 4) has
    // hormonal-context reporting — the values track the data, not a fixed "2 of 3".
    const val = (k: string) => {
      const cell = [...cov.querySelectorAll(".cmp-cov-cell")].find((c) => c.textContent!.includes(k))!;
      return cell.querySelector(".cmp-cov-v")!.textContent;
    };
    expect(val("Women counted")).toBe("3 of 3");
    expect(val("Women analyzed")).toBe("3 of 3");
    expect(val("Life-stage reporting")).toBe("2 of 3");     // Digoxin (L3) + Valsartan (L4)
    expect(val("Hormonal-context reporting")).toBe("1 of 3"); // Valsartan only
    expect(val("Human review status")).toBe("Pending");
  });

  it("Source coverage details list medicine, source, population, review status and cutoff", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelector(".cmp-coverage")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /View Source Coverage Details/i }));
    const table = container.querySelector(".cmp-cov-table")!;
    expect([...table.querySelectorAll("th")].map((n) => n.textContent))
      .toEqual(["Medicine", "Source", "Evidence population", "Review status", "Cutoff date"]);
    expect(table.textContent).toContain("Digoxin");
    expect(table.textContent).toContain("2026-07-18");
  });
});
