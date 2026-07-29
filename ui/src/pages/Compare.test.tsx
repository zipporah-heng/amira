import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Compare } from "./Compare";

/** Compare Evidence is CONTEXTUAL and DYNAMIC. The comparison set is derived from the
 *  selected CONDITION via the canonical catalog (/api/catalog) — never a hard-coded
 *  medicine list. These tests drive the page from the URL context and a mocked catalog,
 *  and assert the mission rules: selected-first, same-condition matching (not same class,
 *  not same active ingredient), honest empty/incomplete states, no GLP-1 defaulting. */

// --- Canonical catalog fixture (health area -> condition -> drug class -> medicine) ---
const CATALOG = {
  health_areas: [
    {
      health_area: "Cardiovascular",
      conditions: [
        {
          condition: "Heart failure",
          drug_classes: [
            { drug_class: "SGLT2 inhibitor", medicines: [{ medicine: "Dapagliflozin", status: "verified", active_ingredient: null }] },
            { drug_class: "Cardiac glycoside", medicines: [{ medicine: "Digoxin", status: "verified", active_ingredient: null }] },
          ],
        },
        {
          condition: "Cardiovascular disease prevention",
          drug_classes: [
            {
              drug_class: "Statin",
              medicines: [
                { medicine: "Rosuvastatin", status: "verified", active_ingredient: null },
                { medicine: "Atorvastatin", status: "incomplete", active_ingredient: null },
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
            { drug_class: "Thiazolidinedione", medicines: [{ medicine: "Pioglitazone", status: "verified", active_ingredient: null }] },
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
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: o.medicine, active_ingredient: o.active_ingredient ?? null,
      brand_note: o.brand_note ?? null, drug_class: o.drug_class, indication: o.condition,
      known_adverse_effects: o.aes ? { list: o.aes, exact_passage: "Adverse reactions reported in prescribing information.", source: { source_id: "SRC", title: "Prescribing information", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } } : null,
      maturity: { level, max_level: 5, label: "L", display: `${level} / 5`, scorable: true },
      effectiveness: { state: o.eff, headline: o.eff },
      safety: { state: o.saf, headline: o.saf },
    },
    maturity: {
      level, max_level: 5, label: "L", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })),
    },
    effectiveness: { state: o.eff, findings: [] },
    safety: { state: o.saf, significant_findings: [], other_findings: [] },
    totals: {
      participants_total: o.total ?? 1000, women_reported_count: o.womenReported ?? 0,
      women_estimated_total: o.womenEstimated ?? o.womenReported ?? 0, women_pct_of_participants: o.pct ?? null,
    },
    trials: [{ display_name: o.study ?? "STUDY" }],
    studies_behind: [{ study: o.study ?? "STUDY", source_url: o.sourceUrl ?? "https://clinicaltrials.gov/" }],
  };
}

const REPORTS: Record<string, any> = {
  Digoxin: report({ medicine: "Digoxin", condition: "Heart failure", drug_class: "Cardiac glycoside", study: "DIG Trial", total: 6800, womenReported: 1520, pct: 22.4, level: 3, eff: "Sex-specific effectiveness signal reported", saf: "Sex-specific safety signal reported", aes: ["Nausea", "Arrhythmia"], sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/9036306/" }),
  Dapagliflozin: report({ medicine: "Dapagliflozin", condition: "Heart failure", drug_class: "SGLT2 inhibitor", study: "DAPA-HF", total: 4744, womenReported: 1109, pct: 23.4, level: 2, eff: "Sex-specific analysis reported", saf: "Sex-specific safety not reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/31535829/" }),
  Rosuvastatin: report({ medicine: "Rosuvastatin", condition: "Cardiovascular disease prevention", drug_class: "Statin", study: "JUPITER", total: 17802, womenReported: 6801, pct: 38.2, level: 2, eff: "Sex-specific analysis reported", saf: "Sex-specific safety not reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/18997196/" }),
  Ozempic: report({ medicine: "Ozempic", active_ingredient: "Semaglutide", condition: "Type 2 diabetes", drug_class: "GLP-1 receptor agonist", study: "SUSTAIN-6", total: 3297, womenReported: 1295, pct: 39.3, level: 2, eff: "No statistically significant sex difference identified", saf: "Sex-specific safety signal reported", aes: ["Nausea", "Vomiting"], sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/" }),
  Mounjaro: report({ medicine: "Mounjaro", active_ingredient: "Tirzepatide", condition: "Type 2 diabetes", drug_class: "Dual GIP/GLP-1 receptor agonist", study: "SURPASS-2", total: 1879, womenEstimated: 996, pct: 53.0, level: 2, eff: "Sex-specific analysis reported", saf: "Sex-specific safety signal reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/34170647/" }),
  Pioglitazone: report({ medicine: "Pioglitazone", condition: "Type 2 diabetes", drug_class: "Thiazolidinedione", study: "PROactive", total: 5238, womenReported: 1660, pct: 33.7, level: 2, eff: "Sex-specific analysis reported", saf: "Sex-specific safety not reported", sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/16214598/" }),
  Wegovy: report({ medicine: "Wegovy", active_ingredient: "Semaglutide", condition: "Weight management", drug_class: "GLP-1 receptor agonist", study: "STEP 1", total: 1961, womenReported: 1453, pct: 74.1, level: 1, eff: "Sex-specific effectiveness not reported", saf: "Sex-specific safety not reported", aes: ["Nausea", "Vomiting"], sourceUrl: "https://clinicaltrials.gov/study/NCT03548935" }),
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
  const qs = new URLSearchParams(params).toString();
  window.history.pushState({}, "", `/amira/compare-evidence?${qs}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

const brands = (container: HTMLElement) =>
  [...container.querySelectorAll(".ce-brand")].map((n) => n.textContent);

describe("Compare Evidence — contextual and dynamic", () => {
  it("1+10. Digoxin (Heart failure) compares heart-failure medicines and NEVER defaults to GLP-1", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(2));
    expect(brands(container)).toEqual(["Digoxin", "Dapagliflozin"]);
    for (const glp1 of ["Ozempic", "Wegovy", "Mounjaro", "Pioglitazone", "GLP-1"]) {
      expect(container.textContent).not.toContain(glp1);
    }
  });

  it("2+6. Selected medicine appears first with the 'Selected medicine' badge; different drug classes may appear", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(3));
    const first = container.querySelector(".ce-card")!;
    expect(first.querySelector(".ce-selbadge")?.textContent).toMatch(/Selected medicine/i);
    expect(first.querySelector(".ce-brand")?.textContent).toBe("Ozempic");
    // Same condition, three DIFFERENT drug classes — no same-class requirement.
    expect(brands(container)).toEqual(["Ozempic", "Mounjaro", "Pioglitazone"]);
  });

  it("3+8. Wegovy (Weight management) shows only Weight-management medicines and the accurate empty state", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Weight management", medicine: "Wegovy" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(1));
    expect(brands(container)).toEqual(["Wegovy"]);
    for (const other of ["Ozempic", "Mounjaro", "Pioglitazone", "Digoxin"]) {
      expect(container.textContent).not.toContain(other);
    }
    expect(await screen.findByText(/No other reviewed medicines are currently available for comparison within Weight management/i)).toBeInTheDocument();
  });

  it("4+5. Ozempic (Type 2 diabetes) excludes Wegovy despite the shared active ingredient (semaglutide)", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(3));
    expect(container.textContent).not.toContain("Wegovy");
  });

  it("5b. Wegovy is not grouped with Ozempic/Mounjaro even though it shares semaglutide", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Weight management", medicine: "Wegovy" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(1));
    expect(container.textContent).not.toContain("Ozempic");
  });

  it("7+9. Context comes from the URL/canonical catalog: heading and set follow the selected condition", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Mounjaro", lifeStage: "older_adult", hormonalContext: "Menopause status" });
    const { container } = render(<Compare />);
    expect(await screen.findByText(/Compare evidence for medicines studied in Type 2 diabetes/i)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(3));
    // Selected (Mounjaro) first even though it is not alphabetically first.
    expect(container.querySelector(".ce-brand")?.textContent).toBe("Mounjaro");
  });

  it("11. Incomplete medicines are labelled 'Evidence review incomplete / Not scored' and never scored", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Cardiovascular disease prevention", medicine: "Rosuvastatin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(2));
    const cards = [...container.querySelectorAll(".ce-card")] as HTMLElement[];
    const ator = cards.find((c) => c.textContent!.includes("Atorvastatin"))!;
    expect(ator.querySelector(".ce-inc-badge")?.textContent).toMatch(/Evidence review incomplete/i);
    expect(ator.textContent).toMatch(/Not scored/i);
    expect(ator.querySelector(".ce-mat-v")).toBeNull(); // no maturity score on an incomplete card
  });

  it("shows the required non-recommendation note and a contextual heading", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    render(<Compare />);
    expect(await screen.findByText(/They do not\s+recommend one medicine over another/i)).toBeInTheDocument();
    expect(screen.getByText(/Compare evidence for medicines studied in Heart failure/i)).toBeInTheDocument();
  });

  it("does not rank medicines or use superiority language, and names no celebrity", async () => {
    mockFetch();
    setCtx({ healthArea: "Metabolic Health", condition: "Type 2 diabetes", medicine: "Ozempic" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll(".ce-card").length).toBe(3));
    const text = (container.textContent || "").toLowerCase();
    for (const banned of ["better than", "more effective", "safer than", "ranked", "schumer"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("provides working exact-passage links for verified medicines", async () => {
    mockFetch();
    setCtx({ healthArea: "Cardiovascular", condition: "Heart failure", medicine: "Digoxin" });
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelectorAll("a.cmp-passage").length).toBeGreaterThanOrEqual(2));
    const links = [...container.querySelectorAll("a.cmp-passage")] as HTMLAnchorElement[];
    expect(links.every((a) => /^https?:\/\//.test(a.href))).toBe(true);
  });
});
