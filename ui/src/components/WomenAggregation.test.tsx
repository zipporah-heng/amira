import { render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceReview } from "./EvidenceReview";
import { NoticePanel, MaturityPanel } from "./WhatToNotice";
import { Representation } from "./Representation";
import { Compare } from "../pages/Compare";
import * as M from "../evidenceModel";
import { buildEvidenceBriefBytes } from "../pdf";
import { extractPdfText } from "../test/pdfText";
import type { EvidenceResponse, WomenIncludedStudy } from "../api";

/** WOMEN COUNT AGGREGATION.
 *
 *  "284 of 7,801" was a known numerator from ONE study (DECISION) over a denominator
 *  that included a study with unknown female enrolment (DIG). It is neither a
 *  within-study ratio nor a complete cross-study count, so it must never render.
 *
 *  A medicine-level numerator and denominator may only be combined when EVERY included
 *  study contributes a compatible, verified pair. Otherwise the summary is bounded
 *  wording plus the study-specific values — on Check Evidence, in Compare Evidence and
 *  in the PDF exports alike. */

/** Canonical per-study rows, exactly as /api/check-evidence composes them. */
const DIGOXIN_STUDIES: WomenIncludedStudy[] = [
  { trial_id: "DIG", study: "DIG", total_enrollment: 6800, total_enrollment_state: "reported",
    female_n: null, female_basis: "not_located", female_pct_reported: null,
    female_pct_within_study: null, combinable: false },
  // The source records 28%; the displayed figure is the within-study ratio 284 / 1,001.
  { trial_id: "DECISION", study: "DECISION", total_enrollment: 1001, total_enrollment_state: "reported",
    female_n: 284, female_basis: "reported", female_pct_reported: 28.0,
    female_pct_within_study: 28.4, combinable: true },
];

const DIGOXIN_DETAIL =
  "The female enrollment count was not located for DIG. DECISION reported 284 of 1,001 women, 28.4%.";

function report(o: any): EvidenceResponse {
  const level = o.level ?? 2;
  return {
    supported: true, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
    human_verification_status: "pending",
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: o.medicine, active_ingredient: o.medicine, brand_note: null,
      drug_class: o.drug_class, indication: o.condition, known_adverse_effects: null,
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true },
      effectiveness: { state: o.eff, headline: o.eff },
      safety: { state: o.saf, headline: o.saf },
    },
    maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })) },
    effectiveness: { state: o.eff, headline: o.eff, findings: o.findings ?? [] },
    safety: { state: o.saf, headline: o.saf, significant_findings: [], trend_findings: [], other_findings: [] },
    dimensions: [], evidence_gaps: [],
    trials: (o.studies as WomenIncludedStudy[]).map((s) => ({
      trial_id: s.trial_id, display_name: s.study, study_type: "Randomized Controlled Trial",
      minimum_age: null, total_enrollment: s.total_enrollment, female_n: s.female_n,
      assertions: [{ source: { source_id: "SRC-1", title: s.study, url: "https://clinicaltrials.gov/" } }],
    })),
    studies_behind: [{ study: o.studies[0].study, source_url: "https://clinicaltrials.gov/" }],
    sources: [{ source_id: "SRC-1", title: o.studies[0].study, url: "https://clinicaltrials.gov/" }],
    totals: {
      trials: o.studies.length,
      // The legacy fields stay exactly as the backend reports them: a partial subtotal
      // and a full denominator. Nothing may pair them.
      participants_total: o.studies.reduce((a: number, s: WomenIncludedStudy) => a + (s.total_enrollment || 0), 0),
      women_reported_count: o.studies.reduce((a: number, s: WomenIncludedStudy) =>
        a + (s.female_basis === "reported" ? s.female_n || 0 : 0), 0),
      women_estimated_total: o.studies.reduce((a: number, s: WomenIncludedStudy) => a + (s.female_n || 0), 0),
      women_pct_of_participants: o.combined ? o.combined.percentage : null,
      trials_with_reported_female_count: o.studies.filter((s: WomenIncludedStudy) => s.female_basis === "reported").map((s: WomenIncludedStudy) => s.trial_id),
      trials_with_percentage_only: o.studies.filter((s: WomenIncludedStudy) => s.female_basis === "derived").map((s: WomenIncludedStudy) => s.trial_id),
      trials_without_female_count_or_percentage: o.studies.filter((s: WomenIncludedStudy) => !s.combinable).map((s: WomenIncludedStudy) => s.trial_id),
      women_included: {
        state: o.combined ? "reported" : (o.studies.some((s: WomenIncludedStudy) => s.combinable) ? "partially_reported" : "not_reported"),
        label: o.combined ? o.combined.label : (o.studies.some((s: WomenIncludedStudy) => s.combinable)
          ? M.PARTIAL_WOMEN_LABEL : "Not reported in the reviewed studies"),
        detail: o.detail,
        combined_count: o.combined ? o.combined.count : null,
        combined_total: o.combined ? o.combined.total : null,
        combined_percentage: o.combined ? o.combined.percentage : null,
        combined_basis: o.combined ? o.combined.basis : "not_combinable_incomplete_coverage",
        studies_reporting_women: o.studies.filter((s: WomenIncludedStudy) => s.combinable).length,
        studies_reviewed: o.studies.length,
        per_study: o.studies,
      },
    },
  } as unknown as EvidenceResponse;
}

const DIGOXIN = report({
  medicine: "Digoxin", condition: "Heart failure", drug_class: "Cardiac glycoside", level: 2,
  eff: "Conflicting sex-specific results", saf: "Sex-specific safety signal reported",
  studies: DIGOXIN_STUDIES, detail: DIGOXIN_DETAIL,
  findings: [{
    interpretation: "Post hoc analysis.", endpoint: "All-cause mortality", significance: "significant",
    exact_passage: "Among women, mortality was 33.1% with digoxin and 28.9% with placebo.",
    source_locator: "p. 105", scope: "trial:DIG",
    source: { source_id: "SRC-PMID-12409542", title: "Sex-based DIG analysis", url: "https://pubmed.ncbi.nlm.nih.gov/12409542/" },
  }],
});

/** Rosuvastatin: one reported count + one percentage-only study, each divided by its
 *  OWN total. Combinable, but the combined figure must be labelled approximate. */
const ROSUVASTATIN = report({
  medicine: "Rosuvastatin", condition: "Cardiovascular prevention", drug_class: "Statin", level: 2,
  eff: "Sex-specific analysis reported", saf: "Sex-specific safety not reported",
  studies: [
    { trial_id: "JUPITER", study: "JUPITER", total_enrollment: 17802, total_enrollment_state: "reported",
      female_n: 6801, female_basis: "reported", female_pct_reported: null,
      female_pct_within_study: 38.2, combinable: true },
    { trial_id: "HOPE-3", study: "HOPE-3", total_enrollment: 12705, total_enrollment_state: "reported",
      female_n: 5844, female_basis: "derived", female_pct_reported: 46.0,
      female_pct_within_study: 46.0, combinable: true },
  ],
  detail: "JUPITER reported 6,801 of 17,802 women, 38.2%. HOPE-3 reported approximately 5,844 of 12,705 women, 46.0%.",
  combined: { label: "approximately 12,645 of 30,507", count: 12645, total: 30507, percentage: 41.4,
    basis: "mixed_reported_and_derived" },
});

/** Atorvastatin: nothing located anywhere. */
const ATORVASTATIN = report({
  medicine: "Atorvastatin", condition: "Cardiovascular prevention", drug_class: "Statin", level: 0,
  eff: "Sex-specific effectiveness not reported", saf: "Sex-specific safety not reported",
  studies: [
    { trial_id: "CARDS", study: "CARDS", total_enrollment: 2800, total_enrollment_state: "reported",
      female_n: null, female_basis: "not_located", female_pct_reported: null,
      female_pct_within_study: null, combinable: false },
  ],
  detail: "The female enrollment count was not located for CARDS.",
});

const renderCheck = (r: EvidenceResponse) =>
  render(
    <EvidenceReview report={r} signalCard={<NoticePanel report={r} signal={null} />}
      maturityCard={<MaturityPanel report={r} />} representationCard={<Representation report={r} />} />,
  );

afterEach(() => { vi.unstubAllGlobals(); window.history.pushState({}, "", "/"); });

describe("Digoxin women count", () => {
  it("1. Never renders 284 of 7,801, on any surface", async () => {
    const { container } = renderCheck(DIGOXIN);
    const page = (container.textContent || "").replace(/\s+/g, " ");
    for (const bad of ["284 of 7,801", "284 of 7801", "7,801"]) expect(page).not.toContain(bad);
    expect(M.womenIncluded(DIGOXIN).label).not.toContain("7,801");
    const pdf = await extractPdfText(await buildEvidenceBriefBytes(DIGOXIN));
    expect(pdf.replace(/\s+/g, " ")).not.toContain("284 of 7,801");
  });

  it("2. DIG shows its total and that female enrollment was not located", () => {
    const { container } = renderCheck(DIGOXIN);
    const table = container.querySelector(".ev-women-studies")! as HTMLElement;
    const dig = within(table).getByText("DIG").closest("tr")! as HTMLElement;
    expect(within(dig).getByText("6,800")).toBeInTheDocument();
    expect(within(dig).getByText(/not located/i)).toBeInTheDocument();
  });

  it("3. DECISION shows 284 of 1,001 with its reported percentage", () => {
    const { container } = renderCheck(DIGOXIN);
    const table = container.querySelector(".ev-women-studies")! as HTMLElement;
    const dec = within(table).getByText("DECISION").closest("tr")! as HTMLElement;
    expect(within(dec).getByText("1,001")).toBeInTheDocument();
    // The within-study ratio of DECISION's own count to its own total.
    expect(within(dec).getByText("284 of 1,001, 28.4%")).toBeInTheDocument();
  });

  it("4. The medicine-level answer is labelled partial, with no combined percentage", () => {
    const cell = M.womenIncluded(DIGOXIN);
    expect(cell.label).toBe(M.PARTIAL_WOMEN_LABEL);
    expect(cell.tone).toBe("limited");
    expect(DIGOXIN.totals!.women_included!.combined_count).toBeNull();
    expect(DIGOXIN.totals!.women_included!.combined_total).toBeNull();
    expect(DIGOXIN.totals!.women_included!.combined_percentage).toBeNull();

    const { container } = renderCheck(DIGOXIN);
    const metric = within(container.querySelector("#women-in-the-evidence")! as HTMLElement)
      .getByText("Women included").closest(".ev-metric")! as HTMLElement;
    expect(within(metric).getByText(M.PARTIAL_WOMEN_LABEL)).toBeInTheDocument();
    expect(within(metric).getByText(/Partial study coverage/i)).toBeInTheDocument();
    // The representation row agrees, and shows the study coverage rather than a percentage.
    const row = container.querySelector("#representation")! as HTMLElement;
    const pill = within(row).getByText("Women included").closest(".rep-cell")!.querySelector(".rep-pill")!;
    expect(pill.textContent).toContain("Partially reported");
    expect(pill.textContent).toContain("1 of 2 studies");
    expect(pill.textContent).not.toContain("%");
  });

  it("5. Check Evidence, Compare Evidence and the PDF all use the same values", async () => {
    // Check Evidence
    const { container } = renderCheck(DIGOXIN);
    const check = (container.textContent || "").replace(/\s+/g, " ");
    expect(check).toContain(M.PARTIAL_WOMEN_LABEL);
    expect(check).toContain("284 of 1,001");
    expect(check).toContain(DIGOXIN_DETAIL);

    // Compare Evidence — driven from the catalog with the same canonical report.
    vi.stubGlobal("fetch", vi.fn(async (url: any, opts: any) => {
      if (typeof url === "string" && url.includes("/api/catalog")) {
        return { ok: true, json: async () => ({ health_areas: [{ health_area: "Cardiovascular", conditions: [{
          condition: "Heart failure", drug_classes: [{ drug_class: "Cardiac glycoside",
            medicines: [{ medicine: "Digoxin", status: "verified", active_ingredient: "Digoxin" }] }] }] }] }) } as any;
      }
      if (typeof url === "string" && url.includes("/api/critical-signals")) {
        return { ok: true, json: async () => ({ library: [] }) } as any;
      }
      JSON.parse(opts.body);
      return { ok: true, json: async () => DIGOXIN } as any;
    }) as never);
    window.history.pushState({}, "", "/amira/compare-evidence?healthArea=Cardiovascular&condition=Heart+failure&medicine=Digoxin");
    const cmp = render(<Compare />);
    await waitFor(() => expect(cmp.container.querySelector(".cmp-women-studies")).not.toBeNull());
    const compare = (cmp.container.textContent || "").replace(/\s+/g, " ");
    expect(compare).toContain(M.PARTIAL_WOMEN_LABEL);
    expect(compare).toContain("284 of 1,001");
    expect(compare).not.toContain("284 of 7,801");

    // PDF export
    const pdf = (await extractPdfText(await buildEvidenceBriefBytes(DIGOXIN))).replace(/\s+/g, " ");
    expect(pdf).toContain(M.PARTIAL_WOMEN_LABEL);
    expect(pdf).toContain("284 of 1,001");
    expect(pdf).toContain("6,800 participants");
    expect(pdf).toMatch(/DIG:.*not located/);
  });

  it("6. An unknown female count can never enter a combined denominator", () => {
    // Same canonical rule with the summary block absent (an older API response): the
    // model must still refuse to combine.
    const legacy = JSON.parse(JSON.stringify(DIGOXIN)) as EvidenceResponse;
    delete (legacy.totals as any).women_included;
    expect(M.womenIncluded(legacy).label).toBe(M.PARTIAL_WOMEN_LABEL);
    expect(M.womenIncluded(legacy).label).not.toContain("7,801");

    // And a hand-forged "combined" figure that includes a non-combinable study is
    // impossible to produce from the canonical rows.
    const rows = M.womenIncludedStudies(DIGOXIN);
    const combinable = rows.filter((s) => s.combinable);
    expect(combinable.length).toBeLessThan(rows.length);
    expect(DIGOXIN.totals!.women_included!.combined_total).toBeNull();
  });

  it("7. Other medicines are audited for the same numerator/denominator mixing", async () => {
    // Rosuvastatin: every study contributes both sides, so a combined figure is allowed —
    // and its numerator matches the percentage shown beside it.
    const ros = M.womenIncluded(ROSUVASTATIN);
    const rw = ROSUVASTATIN.totals!.women_included!;
    expect(rw.state).toBe("reported");
    expect(rw.combined_count).toBe(rw.per_study.reduce((a, s) => a + (s.female_n || 0), 0));
    expect(rw.combined_total).toBe(rw.per_study.reduce((a, s) => a + (s.total_enrollment || 0), 0));
    expect(rw.combined_percentage)
      .toBe(Math.round((rw.combined_count! / rw.combined_total!) * 1000) / 10);
    expect(ros.label).toContain("approximately");   // part derived, and labelled so
    // The old defect would have shown the reported-only numerator (6,801) beside a
    // percentage derived from a different numerator.
    expect(ros.label).not.toContain("6,801 of 30,507");

    // Atorvastatin: nothing located — no ratio at all.
    const ato = M.womenIncluded(ATORVASTATIN);
    expect(ato.label).not.toMatch(/\d+ of \d+/);
    expect(ATORVASTATIN.totals!.women_included!.combined_percentage).toBeNull();
    const pdf = await extractPdfText(await buildEvidenceBriefBytes(ATORVASTATIN));
    expect(pdf).toContain("not located");
  });
});
