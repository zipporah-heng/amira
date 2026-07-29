import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EvidenceReview, SECTIONS } from "./EvidenceReview";
import { NoticePanel, MaturityPanel } from "./WhatToNotice";
import * as M from "../evidenceModel";
import type { EvidenceResponse } from "../api";

/** CHECK EVIDENCE SIMPLIFICATION.
 *
 *  The standalone Evidence Scope panel is gone from Check Evidence and from the table of
 *  contents. Nothing it reported is lost: the review-scope counts now sit in Source
 *  Coverage, and the review-status fields in About This Evidence Review. No replacement
 *  card is introduced, and the underlying metadata is untouched. */

const src = (f: string) => resolve(process.cwd(), "src", f);

function report(): EvidenceResponse {
  return {
    supported: true, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
    human_verification_status: "pending",
    query: { condition: "Heart failure", medicine: "Digoxin", life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine: "Digoxin", active_ingredient: "Digoxin", brand_note: null,
      drug_class: "Cardiac glycoside", indication: "Heart failure", known_adverse_effects: null,
      maturity: { level: 3, max_level: 5, label: "Women Analyzed", display: "3 / 5", scorable: true },
      effectiveness: { state: "Conflicting sex-specific results", headline: "" },
      safety: { state: "Women's safety discussed; no formal between-sex comparison", headline: "" },
    },
    maturity: { level: 3, max_level: 5, label: "Women Analyzed", display: "3 / 5", scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= 3 })) },
    study_selection: { rcts_for_selected_medicine: 2, publications_for_selected_medicine: 5 },
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
      significant_findings: [{ endpoint: "Serious adverse events", interpretation: "Discussed in women.",
        exact_passage: "Women experienced more digoxin toxicity.", source_locator: "p. 106",
        source: { source_id: "SRC-1", title: "DIG", url: "https://clinicaltrials.gov/" } }],
      trend_findings: [], other_findings: [] },
    dimensions: [], evidence_gaps: [],
    trials: [{ display_name: "DIG Trial", study_type: "Randomized Controlled Trial", minimum_age: null,
      assertions: [{ source: { source_id: "SRC-1", title: "DIG", url: "https://clinicaltrials.gov/" } }] }],
    studies_behind: [{ study: "DIG Trial", source_url: "https://clinicaltrials.gov/" }],
    sources: [{ source_id: "SRC-1", title: "DIG Trial", url: "https://clinicaltrials.gov/" }],
    totals: { participants_total: 7801, women_reported_count: 284, women_estimated_total: 284, women_pct_of_participants: null },
  } as unknown as EvidenceResponse;
}

const R = report();
const renderPage = () =>
  render(
    <EvidenceReview report={R} signalCard={<NoticePanel report={R} signal={null} />}
      maturityCard={<MaturityPanel report={R} />} />,
  );

describe("Evidence Scope is retired from Check Evidence", () => {
  it("1. Removes the standalone Evidence Scope section from the page", () => {
    const { container, queryByText } = renderPage();
    expect(container.querySelector("#evidence-scope")).toBeNull();
    expect(container.querySelector(".evidence-scope")).toBeNull();
    expect(queryByText("Evidence Scope")).toBeNull();
  });

  it("2. Removes Evidence Scope from the left table of contents", () => {
    const { container } = renderPage();
    expect(SECTIONS.some((s) => s.id === "evidence-scope")).toBe(false);
    const toc = container.querySelector(".ev-nav-list")!;
    expect(within(toc as HTMLElement).queryByText(/Evidence Scope/i)).toBeNull();
    expect(toc.querySelector('a[href="#evidence-scope"]')).toBeNull();
  });

  it("3. Keeps the underlying metadata — the page no longer mounts it", () => {
    // The component and its derivations survive; only the render site is gone.
    const clarity = readFileSync(src("components/EvidenceClarity.tsx"), "utf8");
    expect(clarity).toContain("export function EvidenceScope");
    const page = readFileSync(src("pages/CheckEvidence.tsx"), "utf8");
    expect(page).not.toContain("EvidenceScope");
    expect(page).not.toContain("scopeCard");
  });

  it("4. Introduces no replacement card", () => {
    const { container } = renderPage();
    // Every rendered section is a known table-of-contents section — nothing new was
    // inserted where Evidence Scope used to sit.
    const known = new Set(SECTIONS.map((s) => s.id));
    const ids = [...container.querySelectorAll(".ev-section")].map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !known.has(id))).toEqual([]);
    // The moved fields are metrics inside existing sections, not a card of their own.
    const sc = container.querySelector("#source-coverage")!;
    expect(sc.querySelectorAll(".card").length).toBe(0);
  });
});

describe("The useful fields moved into existing sections", () => {
  it("5. Source Coverage reports the evidence records and publications reviewed", () => {
    const { container } = renderPage();
    const sc = container.querySelector("#source-coverage")! as HTMLElement;
    const records = M.evidenceRecordsReviewed(R)!;
    expect(records.records).toBe(2);
    expect(records.publications).toBe(5);
    const recordCard = within(sc).getByText("Evidence records reviewed").closest(".ev-metric")!;
    expect(within(recordCard as HTMLElement).getByText("2")).toBeInTheDocument();
    const pubCard = within(sc).getByText("Publications reviewed").closest(".ev-metric")!;
    expect(within(pubCard as HTMLElement).getByText("5")).toBeInTheDocument();
  });

  it("6. Source Coverage reports the sex-specific findings located", () => {
    const { container } = renderPage();
    const sc = container.querySelector("#source-coverage")! as HTMLElement;
    // One effectiveness finding + one significant safety finding, counted from the
    // canonical lists rather than stored.
    expect(M.sexSpecificFindingsLocated(R)).toBe(2);
    const card = within(sc).getByText("Sex-specific findings located").closest(".ev-metric")!;
    expect(within(card as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("7. About This Evidence Review keeps the cutoff and human review status", () => {
    const { container } = renderPage();
    const about = container.querySelector("#about-this-evidence-review")! as HTMLElement;
    expect(within(about).getByText("Evidence reviewed through")).toBeInTheDocument();
    expect(within(about).getByText("2026-07-18")).toBeInTheDocument();
    expect(within(about).getByText("Human review status")).toBeInTheDocument();
    expect(within(about).getByText(M.humanReviewStatus(R))).toBeInTheDocument();
  });

  it("8. Guideline-level review status appears there as a small limitation", () => {
    const { container } = renderPage();
    const about = container.querySelector("#about-this-evidence-review")! as HTMLElement;
    const limits = about.querySelector(".ev-limits")!;
    expect(within(limits as HTMLElement).getByText(/Guideline-level coverage review not yet completed/i))
      .toBeInTheDocument();
    expect(M.limitations(R)).toContain(M.GUIDELINE_LIMITATION);
  });

  it("9. Keeps the page flow: summary → women represented → findings → sources → review status", () => {
    const { container } = renderPage();
    const at = (id: string) => {
      const el = container.querySelector(`#${id}`);
      expect(el, id).not.toBeNull();
      return [...container.querySelectorAll("*")].indexOf(el!);
    };
    const flow = ["evidence-summary", "women-in-the-evidence", "sex-specific-effectiveness",
      "source-coverage", "about-this-evidence-review"].map(at);
    expect(flow).toEqual([...flow].sort((a, b) => a - b));
  });
});
