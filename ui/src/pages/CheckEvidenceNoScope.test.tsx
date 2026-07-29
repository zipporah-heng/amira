import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EvidenceResponse } from "../api";

/** EVIDENCE SCOPE IS GONE FROM CHECK EVIDENCE — FOR EVERY MEDICINE.
 *
 *  The page is rendered end to end for a complete review (Digoxin), a second complete
 *  review (Dapagliflozin) and an incomplete one (Atorvastatin, which returns a bounded
 *  response). None of them may contain the words "Evidence Scope", the panel, its
 *  anchor, or an empty container left behind where it used to sit. */

const src = (f: string) => resolve(process.cwd(), "src", f);

const checkEvidence = vi.fn();
const getCriticalSignals = vi.fn(async () => ({ library: [] }));
vi.mock("../api", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  checkEvidence: (...a: unknown[]) => checkEvidence(...a),
  getCriticalSignals: () => getCriticalSignals(),
}));

/** A complete, supported review. Values are fixture-only; the assertions below never
 *  depend on them. */
function complete(medicine: string, condition: string, over: Partial<EvidenceResponse> = {}): EvidenceResponse {
  return {
    supported: true, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
    human_verification_status: "pending",
    query: { condition, medicine, life_stage: "not_specified", hormone_therapy: "any" },
    banner: {
      medicine, active_ingredient: medicine, brand_note: null,
      drug_class: "Class", indication: condition, known_adverse_effects: null,
      maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5", scorable: true },
      effectiveness: { state: "Sex-specific analysis reported", headline: "" },
      safety: { state: "Reported by sex, no formal between-sex comparison", headline: "" },
    },
    maturity: { level: 2, max_level: 5, label: "Women Analyzed", display: "2 / 5", scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= 2 })) },
    study_selection: { rcts_for_selected_medicine: 2, publications_for_selected_medicine: 2 },
    effectiveness: {
      state: "Sex-specific analysis reported", headline: "Sex-specific analysis reported",
      findings: [{
        interpretation: "Reported by sex.", endpoint: "All-cause mortality", significance: "not_tested",
        exact_passage: "Outcomes were reported separately for women and men.",
        source_locator: "p. 1", scope: medicine,
        source: { source_id: "SRC-1", title: "Trial report", url: "https://clinicaltrials.gov/" },
      }],
    },
    safety: { state: "Reported by sex, no formal between-sex comparison", headline: "",
      significant_findings: [], trend_findings: [], other_findings: [] },
    dimensions: [], evidence_gaps: [],
    trials: [{ display_name: "Trial", study_type: "Randomized Controlled Trial", minimum_age: null,
      assertions: [{ source: { source_id: "SRC-1", title: "Trial report", url: "https://clinicaltrials.gov/" } }] }],
    studies_behind: [{ study: "Trial", source_url: "https://clinicaltrials.gov/" }],
    sources: [{ source_id: "SRC-1", title: "Trial report", url: "https://clinicaltrials.gov/" }],
    totals: { participants_total: 4744, women_reported_count: 1109, women_estimated_total: 1109,
      women_pct_of_participants: 23.4 },
    ...over,
  } as unknown as EvidenceResponse;
}

/** Atorvastatin's review is incomplete, so the API returns a bounded response and the
 *  evidence sections never mount. */
const INCOMPLETE = {
  supported: false, dataset_version: "3.0.0", source_cutoff: "2026-07-18",
  query: { condition: "Cardiovascular prevention", medicine: "Atorvastatin",
    life_stage: "not_specified", hormone_therapy: "any" },
  bounded_response: { status: "incomplete_evidence_review",
    message: "AMIRA has not completed its evidence review for this medicine." },
} as unknown as EvidenceResponse;

const CASES: Array<[string, EvidenceResponse]> = [
  ["Digoxin", complete("Digoxin", "Heart failure")],
  ["Dapagliflozin", complete("Dapagliflozin", "Heart failure")],
  ["Atorvastatin", INCOMPLETE],
];

let CheckEvidence: typeof import("./CheckEvidence").CheckEvidence;

beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ health_areas: [] }) })) as never);
  ({ CheckEvidence } = await import("./CheckEvidence"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Check Evidence renders no Evidence Scope panel, for any medicine", () => {
  for (const [medicine, response] of CASES) {
    it(`${medicine}: the words "Evidence Scope" never appear on the page`, async () => {
      checkEvidence.mockResolvedValue(response);
      const { container } = render(<MemoryRouter><CheckEvidence /></MemoryRouter>);
      await waitFor(() => expect(checkEvidence).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText(/Loading evidence/)).toBeNull());

      const text = (container.textContent || "").toUpperCase();
      expect(text).not.toContain("EVIDENCE SCOPE");
      expect(container.querySelector("#evidence-scope")).toBeNull();
      expect(container.querySelector(".evidence-scope")).toBeNull();
      expect(container.querySelector(".es-grid, .es-note, .es-k, .es-v, .es-badge")).toBeNull();
      expect(container.querySelector('[href="#evidence-scope"]')).toBeNull();
    });
  }

  it("Leaves no empty container or spacer where the panel used to sit", async () => {
    checkEvidence.mockResolvedValue(complete("Digoxin", "Heart failure"));
    const { container } = render(<MemoryRouter><CheckEvidence /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector(".ev-summary3")).not.toBeNull());
    // Evidence Summary is followed immediately by "How were women represented?".
    const summary = container.querySelector("#evidence-summary")!;
    const next = summary.nextElementSibling as HTMLElement | null;
    expect(next, "a node follows the evidence summary").not.toBeNull();
    expect(next!.id).toBe("representation");
    // Nothing empty is rendered anywhere in the review.
    const empties = [...container.querySelectorAll("section, .card")]
      .filter((el) => !(el.textContent || "").trim())
      .map((el) => el.id || el.className);
    expect(empties).toEqual([]);
  });

  it("Removes the component and its styles from the codebase, keeping the metadata", () => {
    const clarity = readFileSync(src("components/EvidenceClarity.tsx"), "utf8");
    expect(clarity).not.toContain("EvidenceScope");
    expect(clarity).not.toContain("Evidence Scope");
    expect(clarity).toContain("export function WhatRemainsUnknown");
    // No page or component imports it any more, and no orphan styles remain.
    for (const f of ["pages/CheckEvidence.tsx", "components/EvidenceReview.tsx"]) {
      const source = readFileSync(src(f), "utf8");
      expect(source, f).not.toContain("EvidenceScope");
      expect(source, f).not.toContain("scopeCard");
    }
    for (const f of ["mockup.css", "approved.css"]) {
      const css = readFileSync(src(f), "utf8");
      expect(css, f).not.toContain(".evidence-scope");
      expect(css, f).not.toContain("#evidence-scope");
      expect(css, f).not.toContain(".es-grid");
    }
    // The metadata itself survives in the shared model.
    const model = readFileSync(src("evidenceModel.ts"), "utf8");
    for (const fn of ["evidenceRecordsReviewed", "sexSpecificFindingsLocated", "GUIDELINE_LIMITATION"]) {
      expect(model, fn).toContain(fn);
    }
  });
});
