import { render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Compare } from "../pages/Compare";
import { EvidenceReview } from "./EvidenceReview";
import { NoticePanel, MaturityPanel } from "./WhatToNotice";
import * as CS from "../criticalSignal";
import type { CriticalSignal, EvidenceResponse } from "../api";

/** CRITICAL EVIDENCE SIGNAL VISIBILITY.
 *
 *  A critical signal is its own canonical field. It is visible in Compare Evidence and
 *  beside the Check Evidence section it concerns, it never alters evidence maturity,
 *  effectiveness, safety or column order, and its absence is always bounded to the
 *  reviewed source set. Mortality is never presented as a common adverse effect. */

const DIGOXIN_SIGNAL: CriticalSignal = {
  signal_id: "S-DIG", medicine: "Digoxin", health_area: "Cardiovascular", condition: "Heart failure",
  drug_class: "Cardiac glycoside", trial_id: "DIG", finding_id: "F-EFF-DIG-001",
  signal_type: "Mortality",
  headline: "33.1% of women assigned digoxin died during follow-up",
  summary: "28.9% placebo · Adjusted HR 1.23 · 95% CI 1.02-1.47 · Adjusted sex-by-treatment interaction P = 0.014",
  clinical_significance: "A post hoc DIG analysis found a statistically significant interaction between sex and digoxin.",
  evidence_status: "Human Review Pending", source_id: "SRC-PMID-12409542",
  source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/", source_resolved: true,
  exact_passage: "Among women, mortality was 33.1% with digoxin and 28.9% with placebo.",
  sex_specific: true, life_stage: "not_specified", life_stage_context: "", hormonal_context: "",
  human_verified: false,
  cautions: ["Historical post hoc signal", "Not menopause-specific", "Not a treatment recommendation"],
  why_matters: "A historical analysis found higher mortality among women assigned digoxin.",
  featured: true, featured_priority: 1,
};

const SOTALOL_SIGNAL: CriticalSignal = {
  ...DIGOXIN_SIGNAL, signal_id: "S-SOT", medicine: "Sotalol", condition: "Heart rhythm disorders",
  signal_type: "Serious Safety", finding_id: "F-SAF-SOT-001",
  headline: "Women experienced a higher rate of torsades de pointes during sotalol treatment",
  summary: "4.1% (33/799) women vs 1.9% (44/2336) men · P < 0.001",
  cautions: ["Historical pooled clinical-trial analysis"],
};

const ZOLPIDEM_SIGNAL: CriticalSignal = {
  ...DIGOXIN_SIGNAL, signal_id: "S-ZOL", medicine: "Zolpidem", condition: "Insomnia",
  signal_type: "Dosing / Regulatory Action", finding_id: "F-SAF-ZOL-001",
  headline: "FDA lowered recommended zolpidem doses for women",
  summary: "Immediate-release: 10 mg → 5 mg for women",
  cautions: ["Regulatory dosing information, not individual prescribing advice"],
};

const ASPIRIN_SIGNAL: CriticalSignal = {
  ...DIGOXIN_SIGNAL, signal_id: "S-ASA", medicine: "Aspirin", condition: "Cardiovascular disease prevention",
  signal_type: "Outcome Pattern / Safety", finding_id: "F-EFF-WHS-002",
  headline: "Low-dose aspirin reduced stroke risk but did not significantly reduce myocardial infarction",
  summary: "Stroke RR 0.83 (95% CI 0.69-0.99) · MI RR 1.02 (0.84-1.25)",
  cautions: ["Women-only randomized trial (39,876 women)"],
};

/* ------------------------------- Compare Evidence ------------------------------- */

const CATALOG = {
  health_areas: [{
    health_area: "Cardiovascular",
    conditions: [{
      condition: "Heart failure",
      drug_classes: [
        { drug_class: "Cardiac glycoside", medicines: [{ medicine: "Digoxin", status: "verified", active_ingredient: "Digoxin" }] },
        { drug_class: "SGLT2 inhibitor", medicines: [{ medicine: "Dapagliflozin", status: "verified", active_ingredient: "Dapagliflozin" }] },
      ],
    }],
  }],
};

function report(o: any): any {
  const level = o.level ?? 2;
  return {
    supported: true, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
    human_verification_status: "pending",
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: o.medicine, active_ingredient: o.medicine, brand_note: null,
      drug_class: o.drug_class, indication: o.condition,
      known_adverse_effects: o.aes
        ? { list: o.aes, exact_passage: "…", source: { source_id: "SRC-PI", title: "PI", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } }
        : null,
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true },
      effectiveness: { state: o.eff, headline: o.eff }, safety: { state: o.saf, headline: o.saf },
    },
    maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })) },
    effectiveness: { state: o.eff, headline: o.eff, findings: [{
      interpretation: "Post hoc analysis.", endpoint: "All-cause mortality", significance: "significant",
      exact_passage: "Among women, mortality was 33.1% with digoxin.", source_locator: "p. 105", scope: "DIG",
      source: { source_id: "SRC-PMID-12409542", title: "Sex-based DIG analysis", url: "https://pubmed.ncbi.nlm.nih.gov/12409542/" },
    }] },
    safety: { state: o.saf, headline: o.saf, significant_findings: [], other_findings: [] },
    dimensions: [{ dimension: "menopause_status_reported", n_reporting: 0 },
      { dimension: "hormone_therapy_reported", n_reporting: 0 },
      { dimension: "pregnancy_evidence_reported", n_reporting: 0 }],
    evidence_gaps: [],
    trials: [{ display_name: o.study, study_type: "Randomized Controlled Trial", minimum_age: null,
      assertions: [{ source: { source_id: "SRC-1", title: o.study, url: "https://clinicaltrials.gov/" } }] }],
    studies_behind: [{ study: o.study, source_url: "https://clinicaltrials.gov/" }],
    sources: [{ source_id: "SRC-1", title: o.study, url: "https://clinicaltrials.gov/" }],
    totals: { participants_total: 6800, women_reported_count: 1520, women_estimated_total: 1520, women_pct_of_participants: 22.4 },
  };
}

const REPORTS: Record<string, any> = {
  Digoxin: report({ medicine: "Digoxin", condition: "Heart failure", drug_class: "Cardiac glycoside",
    study: "DIG Trial", level: 3, eff: "Conflicting sex-specific results",
    saf: "Women's safety discussed; no formal between-sex comparison" }),
  Dapagliflozin: report({ medicine: "Dapagliflozin", condition: "Heart failure", drug_class: "SGLT2 inhibitor",
    study: "DAPA-HF", level: 2, eff: "No statistically significant sex difference identified",
    saf: "Reported by sex, no formal between-sex comparison", aes: ["Nausea"] }),
};

function mockFetch(library: CriticalSignal[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: any, opts: any) => {
    const u = String(url);
    if (u.includes("/api/catalog")) return { ok: true, json: async () => CATALOG } as any;
    if (u.includes("/api/critical-signals")) {
      return { ok: true, json: async () => ({ featured: [], library, signal_types: [], evidence_statuses: [], max_featured: 5 }) } as any;
    }
    return { ok: true, json: async () => REPORTS[JSON.parse(opts.body).medicine] } as any;
  }) as any);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

const renderCompare = async () => {
  window.history.pushState({}, "", "/amira/compare-evidence?healthArea=Cardiovascular&condition=Heart%20failure&medicine=Digoxin");
  const view = render(<Compare />);
  await waitFor(() => expect(view.container.querySelectorAll(".cmp-colname").length).toBe(2));
  return view;
};

const cellFor = (c: HTMLElement, label: string, col = 1) => {
  const cells = [...c.querySelectorAll(".cmp-cell")];
  const i = cells.findIndex((x) => x.classList.contains("label") && x.textContent === label);
  return cells[i + col] as HTMLElement;
};

describe("Compare Evidence — critical evidence status", () => {
  it("1. Shows Digoxin's canonical critical status in its own fixed row", async () => {
    mockFetch([DIGOXIN_SIGNAL]);
    const { container } = await renderCompare();
    await waitFor(() => expect(cellFor(container, "Critical evidence status").textContent).toContain("Critical"));
    const cell = cellFor(container, "Critical evidence status");
    expect(cell.textContent).toContain("Critical mortality signal");
    expect(cell.textContent).toContain("33.1%");           // canonical headline statistic
    expect(cell.textContent).toContain("28.9% placebo");   // canonical summary statistic
    expect(cell.textContent).toContain("Historical post hoc signal");
    expect(cell.textContent).toContain("Human review pending");
    expect(cell.querySelector(".cmp-crit")!.classList.contains("critical")).toBe(true);
  });

  it("2. Badges only the medicine that carries a signal", async () => {
    mockFetch([DIGOXIN_SIGNAL]);
    const { container } = await renderCompare();
    await waitFor(() => expect(container.querySelectorAll(".cmp-crit-badge").length).toBe(1));
    const heads = [...container.querySelectorAll(".cmp-colhead")] as HTMLElement[];
    const digoxin = heads.find((h) => h.textContent!.includes("Digoxin"))!;
    const dapa = heads.find((h) => h.textContent!.includes("Dapagliflozin"))!;
    expect(within(digoxin).getByText("Critical signal")).toBeInTheDocument();
    expect(digoxin.querySelector(".cmp-crit-badge")!.classList.contains("critical")).toBe(true);
    expect(dapa.querySelector(".cmp-crit-badge")).toBeNull();
  });

  it("3. Bounds absence to the reviewed source set", async () => {
    mockFetch([DIGOXIN_SIGNAL]);
    const { container } = await renderCompare();
    await waitFor(() => expect(container.querySelectorAll(".cmp-crit").length).toBe(2));
    const dapaCell = cellFor(container, "Critical evidence status", 2);
    expect(dapaCell.textContent).toBe("No critical signal identified in the reviewed source set");
    // Never the unqualified claim.
    expect(dapaCell.textContent).not.toBe("No critical signal");
    expect(dapaCell.querySelector(".cmp-crit")!.classList.contains("none")).toBe(true);
  });

  it("4. Critical status does not alter maturity, effectiveness, safety or column order", async () => {
    mockFetch([DIGOXIN_SIGNAL]);
    const withSignal = await renderCompare();
    const read = (c: HTMLElement) => ({
      order: [...c.querySelectorAll(".cmp-colname")].map((n) => n.textContent),
      maturity: cellFor(c, "Evidence maturity").textContent,
      effectiveness: cellFor(c, "Sex-specific effectiveness").textContent,
      safety: cellFor(c, "Women-specific safety").textContent,
    });
    await waitFor(() => expect(read(withSignal.container).maturity).toBe("3 / 5"));
    const a = read(withSignal.container);
    withSignal.unmount();

    // The same data with NO signal library must produce identical classifications.
    vi.unstubAllGlobals();
    mockFetch([]);
    const without = await renderCompare();
    await waitFor(() => expect(read(without.container).maturity).toBe("3 / 5"));
    const b = read(without.container);
    expect(a).toEqual(b);
    expect(a.order).toEqual(["Digoxin", "Dapagliflozin"]);   // signal is not a ranking
  });

  it("Keeps critical status separate from the safety and adverse-effect rows", async () => {
    mockFetch([DIGOXIN_SIGNAL]);
    const { container } = await renderCompare();
    await waitFor(() => expect(cellFor(container, "Critical evidence status").textContent).toContain("Critical"));
    // The mortality statistic appears only in the critical row, never as an adverse effect.
    expect(cellFor(container, "Common adverse effects").textContent).not.toContain("33.1%");
    expect(cellFor(container, "Women-specific safety").textContent).not.toContain("33.1%");
    const labels = [...container.querySelectorAll(".cmp-cell.label")].map((n) => n.textContent);
    expect(labels).toContain("Critical evidence status");
    expect(labels).toContain("Women-specific safety");
    expect(labels).toContain("Evidence maturity");
  });
});

/* ----------------------------- Signal tone + section ----------------------------- */

describe("Signal tone and placement", () => {
  it("Uses red only for mortality and serious safety; amber for dosing and outcome patterns", () => {
    expect(CS.signalTone("Mortality")).toBe("critical");
    expect(CS.signalTone("Serious Safety")).toBe("critical");
    expect(CS.signalTone("Dosing / Regulatory Action")).toBe("caution");
    expect(CS.signalTone("Outcome Pattern / Safety")).toBe("caution");
    expect(CS.signalTone(null)).toBe("neutral");
  });

  it("Routes each medicine's signal to the section the mission specifies", () => {
    expect(CS.signalSection(DIGOXIN_SIGNAL.signal_type)).toBe("safety");
    expect(CS.signalSection(SOTALOL_SIGNAL.signal_type)).toBe("safety");
    expect(CS.signalSection("Serious Safety")).toBe("safety");           // Pioglitazone
    expect(CS.signalSection(ZOLPIDEM_SIGNAL.signal_type)).toBe("safety");
    expect(CS.signalSection(ASPIRIN_SIGNAL.signal_type)).toBe("effectiveness");
  });

  it("Never invents a statistic — the label, headline and analysis note are canonical", () => {
    const p = CS.presentSignal(DIGOXIN_SIGNAL);
    expect(p.headline).toBe(DIGOXIN_SIGNAL.headline);
    expect(p.statistic).toBe(DIGOXIN_SIGNAL.summary);
    expect(p.analysis).toBe(DIGOXIN_SIGNAL.cautions[0]);
    expect(p.reviewStatus).toBe("Human review pending");
    // The non-safety types keep their canonical wording rather than being relabelled.
    expect(CS.presentSignal(ZOLPIDEM_SIGNAL).label).toBe("Dosing / Regulatory Action");
    expect(CS.presentSignal(ASPIRIN_SIGNAL).label).toBe("Outcome Pattern / Safety");
  });
});

/* -------------------------------- Check Evidence -------------------------------- */

const CHECK = report({ medicine: "Digoxin", condition: "Heart failure", drug_class: "Cardiac glycoside",
  study: "DIG Trial", level: 3, eff: "Conflicting sex-specific results",
  saf: "Women's safety discussed; no formal between-sex comparison" }) as EvidenceResponse;

const renderReview = (signal: CriticalSignal | null, r: EvidenceResponse = CHECK) =>
  render(
    <EvidenceReview
      report={r} signal={signal}
      signalCard={<NoticePanel report={r} signal={signal} />}
      maturityCard={<MaturityPanel report={r} />}
    />,
  );

describe("Check Evidence — signal callout and adverse-effect clarity", () => {
  it("Places a mortality signal beside Women-specific safety, not in adverse effects", () => {
    const { container } = renderReview(DIGOXIN_SIGNAL);
    const safety = container.querySelector("#women-specific-safety")!;
    const callout = safety.querySelector(".ev-signal")!;
    expect(callout).not.toBeNull();
    expect(callout.classList.contains("critical")).toBe(true);
    expect(callout.textContent).toContain("Critical mortality signal");
    expect(callout.textContent).toContain("33.1%");
    expect(container.querySelector("#sex-specific-effectiveness")!.querySelector(".ev-signal")).toBeNull();
    expect(container.querySelector("#common-adverse-effects")!.querySelector(".ev-signal")).toBeNull();
  });

  it("Places an outcome-pattern signal beside Sex-specific effectiveness", () => {
    const { container } = renderReview(ASPIRIN_SIGNAL);
    expect(container.querySelector("#sex-specific-effectiveness")!.querySelector(".ev-signal")).not.toBeNull();
    expect(container.querySelector("#women-specific-safety")!.querySelector(".ev-signal")).toBeNull();
    expect(container.querySelector("#sex-specific-effectiveness .ev-signal")!.classList.contains("caution")).toBe(true);
  });

  it("7. A critical safety signal coexists with 'adverse effects not reported' without contradiction", () => {
    const { container } = renderReview(DIGOXIN_SIGNAL);
    const ae = container.querySelector("#common-adverse-effects")! as HTMLElement;
    // The medicine has no recorded adverse-effect list.
    expect(ae.textContent).toContain("Not reported in the reviewed sources");
    // …and the page explains the coexistence rather than leaving it looking contradictory.
    expect(ae.textContent).toMatch(/separate critical mortality signal was identified/i);
    expect(ae.textContent).toMatch(/shown in\s+the Evidence Summary/i);
    expect(ae.textContent).toMatch(/not a common adverse effect/i);
    // Mortality is never converted into an adverse-effect entry.
    expect(ae.querySelectorAll(".ev-ae-item").length).toBe(0);
    expect(ae.textContent).not.toContain("33.1%");
  });

  it("Says nothing about a signal when the medicine has none", () => {
    const { container } = renderReview(null);
    expect(container.querySelector(".ev-signal")).toBeNull();
    const ae = container.querySelector("#common-adverse-effects")!;
    expect(ae.textContent).toContain("Not reported in the reviewed sources");
    expect(ae.textContent).not.toMatch(/separate critical/i);
  });

  it("Does not change the evidence classifications when a signal is present", () => {
    const withSignal = renderReview(DIGOXIN_SIGNAL);
    const read = (c: HTMLElement) => ({
      maturity: c.querySelector("svg.maturity-meter")!.getAttribute("aria-label"),
      effectiveness: c.querySelector("#sex-specific-effectiveness .ev-chip")!.textContent,
      safety: c.querySelector("#women-specific-safety .ev-chip")!.textContent,
    });
    const a = read(withSignal.container);
    withSignal.unmount();
    const b = read(renderReview(null).container);
    expect(a).toEqual(b);
  });
});

/* ------------------------------ Evidence freshness ------------------------------ */

describe("Evidence reviewed through", () => {
  it("5. 18 July 2026 resolves to Current on 29 July 2026", () => {
    const f = CS.freshness("2026-07-18", new Date("2026-07-29T12:00:00Z"))!;
    expect(f.days).toBe(11);
    expect(f.label).toBe("Current");
    expect(f.tone).toBe("current");
  });

  it("Applies the 0-30 / 31-90 / over-90 day bands at their boundaries", () => {
    const at = (d: string) => CS.freshness("2026-07-18", new Date(`${d}T00:00:00Z`))!;
    expect(at("2026-07-18").label).toBe("Current");        // 0 days
    expect(at("2026-08-17").label).toBe("Current");        // 30 days
    expect(at("2026-08-18").label).toBe("Review due");     // 31 days
    expect(at("2026-10-16").label).toBe("Review due");     // 90 days
    expect(at("2026-10-17").label).toBe("Update needed");  // 91 days
  });

  it("Uses the approved label and handles a missing or unparseable date", () => {
    expect(CS.REVIEWED_THROUGH_LABEL).toBe("Evidence reviewed through");
    expect(CS.freshness(null)).toBeNull();
    expect(CS.freshness("not-a-date")).toBeNull();
  });

  it("6. Shows 'Last checked for new sources' only with a real recorded timestamp", () => {
    expect(CS.lastCheckedForNewSources(undefined)).toBeNull();
    expect(CS.lastCheckedForNewSources({})).toBeNull();
    expect(CS.lastCheckedForNewSources({ last_source_check: null })).toBeNull();
    expect(CS.lastCheckedForNewSources({ last_source_check: "2026-07-29T10:00:00Z" })).toBe("2026-07-29");
  });

  it("Surfaces the reviewed-through date with its freshness on the review page", () => {
    const { container } = renderReview(null);
    const about = container.querySelector("#about-this-evidence-review")!;
    expect(about.textContent).toContain("Evidence reviewed through");
    expect(about.textContent).toContain("2026-07-18");
    expect(about.textContent).not.toContain("Evidence cutoff date");
    expect(about.textContent).not.toMatch(/Last checked for new sources/);
  });
});
