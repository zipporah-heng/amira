import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEvidenceBriefBytes, buildComparisonBytes, buildEvidenceBriefPdf, buildComparisonPdf,
  evidenceBriefFilename, comparisonFilename, downloadBlob, pdfBlob,
} from "./pdf";
import { extractPdfText } from "./test/pdfText";
import type { EvidenceResponse } from "./api";

/** PDF EXPORT DOWNLOADS.
 *
 *  In production every export failed silently: the bytes were generated correctly, but
 *  the temporary anchor was clicked while DETACHED from the document and the object URL
 *  was revoked in the same turn — so no download ever started and nothing was shown to
 *  the user. These tests lock the whole path: valid bytes, application/pdf, a %PDF
 *  signature, an attached-then-removed anchor, a surviving object URL, a .pdf filename,
 *  and a visible message whenever generation fails. */

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
      effectiveness: { state: "Sex-specific analysis reported", headline: "" },
      safety: { state: "Sex-specific safety not reported", headline: "" },
    },
    maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true,
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({ level: n, label: `L${n}`, satisfied: n <= level })) },
    effectiveness: { state: "Sex-specific analysis reported", headline: "", findings: [] },
    safety: { state: "Sex-specific safety not reported", headline: "",
      significant_findings: [], trend_findings: [], other_findings: [] },
    dimensions: [], evidence_gaps: [],
    trials: [{ display_name: o.study, study_type: "Randomized Controlled Trial", minimum_age: null,
      assertions: [{ source: { source_id: "SRC-1", title: o.study, url: "https://clinicaltrials.gov/" } }] }],
    studies_behind: [{ study: o.study, source_url: "https://clinicaltrials.gov/" }],
    sources: [{ source_id: "SRC-1", title: o.study, url: "https://clinicaltrials.gov/" }],
    totals: {
      trials: 1, participants_total: o.total, women_reported_count: o.women,
      women_estimated_total: o.women, women_pct_of_participants: o.pct,
      trials_with_reported_female_count: [o.study], trials_with_percentage_only: [],
      trials_without_female_count_or_percentage: [],
      women_included: {
        state: "reported", label: `${o.women.toLocaleString()} of ${o.total.toLocaleString()}`,
        detail: `${o.study} reported ${o.women.toLocaleString()} of ${o.total.toLocaleString()} women, ${o.pct}%.`,
        combined_count: o.women, combined_total: o.total, combined_percentage: o.pct,
        combined_basis: "reported", studies_reporting_women: 1, studies_reviewed: 1,
        per_study: [{ trial_id: o.study, study: o.study, total_enrollment: o.total,
          total_enrollment_state: "reported", female_n: o.women, female_basis: "reported",
          female_pct_reported: o.pct, combinable: true }],
      },
    },
  } as unknown as EvidenceResponse;
}

const DAPA = report({ medicine: "Dapagliflozin", condition: "Heart failure", drug_class: "SGLT2 inhibitor",
  study: "DAPA-HF", total: 4744, women: 1109, pct: 23.4 });
const VALSARTAN = report({ medicine: "Valsartan", condition: "Heart failure", drug_class: "Angiotensin receptor blocker",
  study: "Hayoz 2012", total: 125, women: 125, pct: 100, level: 4 });

const asLatin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

/** Record everything the download path does to the DOM and the object-URL registry. */
function instrumentDownloads() {
  const events: any[] = [];
  const created: string[] = [];
  vi.stubGlobal("URL", Object.assign(Object.create(URL), {
    ...URL,
    createObjectURL: (b: Blob) => {
      const url = `blob:test/${created.length}`;
      created.push(url);
      events.push({ ev: "create", type: b.type, size: b.size, url });
      return url;
    },
    revokeObjectURL: (url: string) => events.push({ ev: "revoke", url }),
  }));
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    events.push({
      ev: "click", download: this.download, href: this.href,
      // The single most important fact: was the anchor in the document?
      attached: document.body.contains(this),
    });
  };
  return {
    events,
    restore: () => { HTMLAnchorElement.prototype.click = origClick; vi.unstubAllGlobals(); },
  };
}

let dl: ReturnType<typeof instrumentDownloads>;
beforeEach(() => { vi.useFakeTimers(); dl = instrumentDownloads(); });
afterEach(() => { dl.restore(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("The download path itself", () => {
  it("8+11+12. Downloads the Check Evidence brief as a real application/pdf file", async () => {
    const bytes = await buildEvidenceBriefBytes(DAPA);
    expect(asLatin1(bytes.slice(0, 5))).toBe("%PDF-");            // 12
    const blob = pdfBlob(bytes);
    expect(blob.type).toBe("application/pdf");                     // 11
    downloadBlob(blob, evidenceBriefFilename(DAPA, "2026-07-29"));
    const click = dl.events.find((e) => e.ev === "click");
    expect(click).toBeTruthy();                                    // 8 — a download starts
    expect(click.download).toBe("AMIRA_Dapagliflozin_Evidence_Brief_2026-07-29.pdf");
    expect(click.download.endsWith(".pdf")).toBe(true);
    expect(click.download).not.toMatch(/\.md$/);
  });

  it("Attaches the anchor before clicking and removes it afterwards", () => {
    const before = document.body.childElementCount;
    downloadBlob(pdfBlob(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), "x.pdf");
    const click = dl.events.find((e) => e.ev === "click");
    expect(click.attached).toBe(true);                              // the production bug
    expect(document.body.childElementCount).toBe(before);           // and cleaned up
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("Does not revoke the object URL before the browser can read it", () => {
    downloadBlob(pdfBlob(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), "x.pdf");
    const order = dl.events.map((e) => e.ev);
    expect(order).toEqual(["create", "click"]);                     // no synchronous revoke
    vi.advanceTimersByTime(60_000);
    expect(dl.events.map((e) => e.ev)).toEqual(["create", "click", "revoke"]);
  });

  it("16. Refuses to appear successful when the bytes are not a PDF", () => {
    expect(() => pdfBlob(Uint8Array.from([]))).toThrow(/no bytes/i);
    expect(() => pdfBlob(new TextEncoder().encode("# Markdown brief"))).toThrow(/%PDF/);
    expect(() => downloadBlob(new Blob(["# Markdown"], { type: "text/markdown" }), "x.pdf"))
      .toThrow(/Unexpected file type/);
    expect(() => downloadBlob(new Blob([], { type: "application/pdf" }), "x.pdf")).toThrow(/empty/i);
    expect(() => downloadBlob(pdfBlob(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), "brief.md"))
      .toThrow(/Unexpected filename/);
    // No click is ever attempted for an unusable file.
    expect(dl.events.some((e) => e.ev === "click")).toBe(false);
  });

  it("9+13. Downloads an individual Compare Evidence brief containing that medicine", async () => {
    const blob = await buildEvidenceBriefPdf(VALSARTAN);
    expect(blob.type).toBe("application/pdf");
    downloadBlob(blob, evidenceBriefFilename(VALSARTAN, "2026-07-29"));
    expect(dl.events.find((e) => e.ev === "click").download)
      .toBe("AMIRA_Valsartan_Evidence_Brief_2026-07-29.pdf");
    const text = await extractPdfText(await buildEvidenceBriefBytes(VALSARTAN));
    expect(text).toContain("Valsartan");
    expect(text).toContain("Hayoz 2012");
  });

  it("10+13. Downloads the comparison PDF containing every selected medicine", async () => {
    const bytes = await buildComparisonBytes([DAPA, VALSARTAN], "Heart failure");
    expect(asLatin1(bytes.slice(0, 5))).toBe("%PDF-");
    const blob = await buildComparisonPdf([DAPA, VALSARTAN], "Heart failure");
    expect(blob.type).toBe("application/pdf");
    downloadBlob(blob, comparisonFilename("Heart failure", "2026-07-29"));
    expect(dl.events.find((e) => e.ev === "click").download)
      .toBe("AMIRA_Heart_Failure_Evidence_Comparison_2026-07-29.pdf");
    const text = await extractPdfText(bytes);
    expect(text).toContain("Dapagliflozin");
    expect(text).toContain("Valsartan");
    expect(text).toContain("Heart failure");
  });
});

/* --------------------------------------------------------------------------- *
 * 15. A deliberately failed generation must produce a VISIBLE error, on both
 *     the Check Evidence and the Compare Evidence surfaces.
 * --------------------------------------------------------------------------- */
describe("15+16. A failed export is visible, never silent", () => {
  it("Check Evidence shows the error beside the Export PDF button", async () => {
    vi.useRealTimers();
    vi.resetModules();
    vi.doMock("./pdf", async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      buildEvidenceBriefPdf: async () => { throw new Error("deliberate generation failure"); },
    }));
    const { EvidenceReview } = await import("./components/EvidenceReview");
    const { NoticePanel, MaturityPanel } = await import("./components/WhatToNotice");
    render(
      <EvidenceReview report={DAPA} signalCard={<NoticePanel report={DAPA} signal={null} />}
        maturityCard={<MaturityPanel report={DAPA} />} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Export PDF/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not be generated/i);
    expect(alert.textContent).toContain("deliberate generation failure");
    vi.doUnmock("./pdf");
    vi.resetModules();
  });

  it("Compare Evidence shows the error beside the Export Comparison PDF button", async () => {
    vi.useRealTimers();
    vi.resetModules();
    vi.doMock("./pdf", async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      buildComparisonPdf: async () => { throw new Error("deliberate comparison failure"); },
    }));
    vi.stubGlobal("fetch", vi.fn(async (url: any) => {
      if (typeof url === "string" && url.includes("/api/catalog")) {
        return { ok: true, json: async () => ({ health_areas: [{ health_area: "Cardiovascular", conditions: [{
          condition: "Heart failure", drug_classes: [{ drug_class: "SGLT2 inhibitor",
            medicines: [{ medicine: "Dapagliflozin", status: "verified", active_ingredient: "Dapagliflozin" }] }] }] }] }) } as any;
      }
      if (typeof url === "string" && url.includes("/api/critical-signals")) {
        return { ok: true, json: async () => ({ library: [] }) } as any;
      }
      return { ok: true, json: async () => DAPA } as any;
    }) as never);
    window.history.pushState({}, "", "/amira/compare-evidence?healthArea=Cardiovascular&condition=Heart+failure&medicine=Dapagliflozin");
    const { Compare } = await import("./pages/Compare");
    const { container } = render(<Compare />);
    await waitFor(() => expect(container.querySelector(".cmp-colname")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Export Comparison PDF/i }));
    await waitFor(() => {
      const err = container.querySelector(".cmp-export-err");
      expect(err).not.toBeNull();
      expect(err!.textContent).toMatch(/could not be generated/i);
      expect(err!.textContent).toContain("deliberate comparison failure");
    });
    vi.doUnmock("./pdf");
    vi.resetModules();
    window.history.pushState({}, "", "/");
  });
});
