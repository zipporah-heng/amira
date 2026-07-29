import { describe, expect, it } from "vitest";
import {
  buildEvidenceBriefPdf, buildComparisonPdf, buildEvidenceBriefBytes, buildComparisonBytes,
  evidenceBriefFilename, comparisonFilename,
} from "./pdf";
import type { EvidenceResponse } from "./api";

/** Evidence exports are REAL PDFs: application/pdf, a valid %PDF signature, selectable
 *  text, source identifiers, limitations and human review status — and never Markdown. */

function report(o: any): EvidenceResponse {
  const level = o.level ?? 2;
  return {
    supported: true,
    dataset_version: "3.0.0",
    source_cutoff: "2026-07-18",
    commit_hash: "abc1234",
    generated_at: "2026-07-29T00:00:00Z",
    human_verification_status: o.review ?? "pending",
    query: { condition: o.condition, medicine: o.medicine, life_stage: "not_specified", hormone_therapy: "any" },
    bounded_response: null,
    banner: {
      medicine: o.medicine, active_ingredient: o.active_ingredient, brand_note: o.brand_note ?? null,
      drug_class: o.drug_class, indication: o.condition,
      known_adverse_effects: o.aes
        ? { list: o.aes, exact_passage: "Adverse reactions reported in the prescribing information.",
            source: { source_id: "SRC-DAILYMED-X", title: "Prescribing information", url: "https://dailymed.nlm.nih.gov/dailymed/", resolved: true } }
        : null,
      maturity: { level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true },
      effectiveness: { state: o.eff, headline: o.eff },
      safety: { state: o.saf, headline: o.saf },
      class_comparison: { drug_class: o.drug_class, verified_count: 1, this_rank: "", summary: "" },
      why_this_result: "",
    },
    maturity: {
      level, max_level: 5, label: "Women Analyzed", display: `${level} / 5`, scorable: true,
      description: "", derived: true, derivation_note: "",
      rule_trace: [1, 2, 3, 4, 5].map((n) => ({
        level: n, label: `L${n}`, satisfied: n <= level, awarded: n === level, requirement: "",
      })),
    },
    effectiveness: {
      dimension: "effectiveness", state: o.eff, headline: o.eff, n_reporting: 1, n_trials: 1, caveat: "",
      derived: true,
      findings: [{
        finding_id: "F-1", scope: o.study, finding_type: "efficacy", endpoint: "Primary endpoint",
        female_estimate: null, male_estimate: null, effect_measure: null, female_ci: null, male_ci: null,
        female_rate: null, male_rate: null, comparison_test: null, comparison_p: null,
        significance: "not_tested", interpretation: "Sex-specific analysis reported.",
        exact_passage: o.passage, source_locator: "Table 2", source_verified: true, human_verified: false,
        source: { source_id: o.sourceId, title: o.sourceTitle, source_type: "publication", url: o.sourceUrl },
      }],
    } as any,
    safety: {
      dimension: "safety", state: o.saf, headline: o.saf, n_reporting: 1, n_trials: 1, caveat: "",
      derived: true, significant_findings: [], trend_findings: [], other_findings: [],
    } as any,
    evidence_gaps: [{ dimension: "menopause_status_reported", label: "Menopause", n_reporting: 0, n_trials: 1,
      statement: "No reviewed study reported menopausal status." }],
    dimensions: [],
    trials: [{ display_name: o.study, study_type: "Randomized Controlled Trial" } as any],
    studies_behind: [{ study: o.study, source_url: o.sourceUrl } as any],
    sources: [{ source_id: o.sourceId, title: o.sourceTitle, source_type: "publication", url: o.sourceUrl } as any],
    totals: {
      participants_total: o.total, women_reported_count: o.womenReported ?? 0,
      women_estimated_total: o.womenEstimated ?? o.womenReported ?? 0,
      women_pct_of_participants: o.pct,
    } as any,
  } as unknown as EvidenceResponse;
}

const OZEMPIC = report({
  medicine: "Ozempic", active_ingredient: "Semaglutide", condition: "Type 2 diabetes",
  drug_class: "GLP-1 receptor agonist", study: "SUSTAIN-6 trial", total: 3297, womenReported: 1295, pct: 39.3,
  eff: "No statistically significant sex difference identified", saf: "Sex-specific safety signal reported",
  aes: ["Nausea", "Vomiting", "Diarrhea"],
  passage: "Women comprised 1295 of the 3297 randomised participants.",
  sourceId: "SRC-PMID-31167654", sourceTitle: "Sex-based SUSTAIN-6 analysis",
  sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6551895/",
});

const PIOGLITAZONE = report({
  medicine: "Pioglitazone", active_ingredient: "Pioglitazone", condition: "Type 2 diabetes",
  drug_class: "Thiazolidinedione", study: "PROactive trial", total: 5238, womenReported: 1775, pct: 33.9,
  level: 1, eff: "Sex-specific effectiveness not reported", saf: "Sex-specific safety signal reported",
  passage: "Fracture occurred in 44 of 870 women receiving pioglitazone.",
  sourceId: "SRC-DAILYMED-PIOGLITAZONE", sourceTitle: "Pioglitazone prescribing information",
  sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/",
});

const asLatin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("Evidence brief PDF", () => {
  it("21+22. Uses the application/pdf MIME type and begins with a valid PDF signature", async () => {
    const blob = await buildEvidenceBriefPdf(OZEMPIC);
    expect(blob.type).toBe("application/pdf");
    const bytes = await buildEvidenceBriefBytes(OZEMPIC);
    expect(asLatin1(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("23. Contains selectable text (real fonts and text operators, not a rasterised image)", async () => {
    const bytes = await buildEvidenceBriefBytes(OZEMPIC);
    const raw = asLatin1(bytes);
    expect(raw).toContain("/Type /Font");
    expect(raw).toContain("Helvetica");
    expect(raw).not.toContain("/Subtype /Image");
    // begin-text … show-text … end-text inside the (compressed) content streams
    expect(await contentStreams(bytes)).toMatch(/BT[\s\S]*Tj[\s\S]*ET/);
  });

  it("24+25+26. Contains source identifiers, limitations and the human review status", async () => {
    const raw = asLatin1(await buildEvidenceBriefBytes(OZEMPIC));
    // pdf-lib compresses page content, so assert on the extractable text stream.
    const text = await extractText(OZEMPIC);
    expect(text).toContain("SRC-PMID-31167654");
    expect(text).toContain("pmc.ncbi.nlm.nih.gov");
    expect(text).toContain("Limitations");
    expect(text).toContain("Human review status");
    expect(text).toContain("Pending");
    expect(text).toContain("Evidence reviewed through");
    expect(text).toContain("2026-07-18");
    expect(raw.slice(0, 5)).toBe("%PDF-");
  });

  it("27. Contains no raw Markdown formatting", async () => {
    const text = await extractText(OZEMPIC);
    expect(text).not.toMatch(/^#{1,6}\s/m);
    expect(text).not.toContain("**");
    expect(text).not.toMatch(/\]\(http/);
  });

  it("Carries the canonical evidence values and the non-recommendation statement", async () => {
    const text = await extractText(OZEMPIC);
    expect(text).toContain("Ozempic");
    expect(text).toContain("Semaglutide");
    expect(text).toContain("Type 2 diabetes");
    expect(text).toContain("GLP-1 receptor agonist");
    expect(text).toContain("SUSTAIN-6 trial");
    expect(text).toContain("2 / 5");
    expect(text).toContain("1,295 of 3,297");
    expect(text).toContain("Nausea");
    expect(flat(text)).toMatch(/does not diagnose, prescribe, recommend treatment/i);
  });

  it("10. Produces a .pdf filename — never a Markdown download", () => {
    const name = evidenceBriefFilename(OZEMPIC, "2026-07-29");
    expect(name).toBe("AMIRA_Ozempic_Evidence_Brief_2026-07-29.pdf");
    expect(name.endsWith(".md")).toBe(false);
  });

  it("Keeps women counted and women analyzed as separate lines", async () => {
    const text = await extractText(PIOGLITAZONE);
    expect(text).toContain("Women counted");
    expect(text).toContain("Women analyzed");
    // Level 1: counted yes, analyzed not established — never silently upgraded.
    const counted = text.indexOf("Women counted");
    const analyzed = text.indexOf("Women analyzed");
    expect(text.slice(counted, analyzed)).toContain("Yes");
    expect(text.slice(analyzed, analyzed + 120)).toContain("Not established");
  });
});

describe("Comparison PDF", () => {
  it("20+21+22. Is a valid PDF containing every medicine currently selected", async () => {
    const blob = await buildComparisonPdf([OZEMPIC, PIOGLITAZONE], "Type 2 diabetes");
    expect(blob.type).toBe("application/pdf");
    expect(asLatin1((await buildComparisonBytes([OZEMPIC, PIOGLITAZONE], "Type 2 diabetes")).slice(0, 5))).toBe("%PDF-");
    const text = await extractComparisonText([OZEMPIC, PIOGLITAZONE], "Type 2 diabetes");
    expect(text).toContain("Type 2 diabetes");
    expect(text).toContain("Ozempic");
    expect(text).toContain("Pioglitazone");
    expect(text).toContain("(selected medicine)");
    expect(text).toContain("Aligned evidence comparison");
  });

  it("Scales to a one-medicine comparison without claiming a fixed number of briefs", async () => {
    const text = await extractComparisonText([OZEMPIC], "Type 2 diabetes");
    expect(text).toContain("1 medicine");
    expect(text).not.toContain("All 3");
    expect(comparisonFilename("Type 2 diabetes", "2026-07-29"))
      .toBe("AMIRA_Type_2_Diabetes_Evidence_Comparison_2026-07-29.pdf");
  });

  it("Carries passages, source identifiers, review status, cutoff and limitations", async () => {
    const text = await extractComparisonText([OZEMPIC, PIOGLITAZONE], "Type 2 diabetes");
    expect(text).toContain("SRC-PMID-31167654");
    expect(text).toContain("SRC-DAILYMED-PIOGLITAZONE");
    expect(flat(text)).toContain("Women comprised 1295 of the 3297 randomised participants.");
    expect(text).toContain("Human review status");
    expect(text).toContain("2026-07-18");
    expect(text).toContain("Limitations");
    expect(flat(text)).toMatch(/does not .*recommend one medicine over another/i);
  });
});

/* ------------------------------------------------------------------------- *
 * Text extraction: rebuild the drawn text from the PDF's own content streams,
 * proving the output is real, selectable text rather than an image.
 * ------------------------------------------------------------------------- */
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { inflateSync } from "node:zlib";

/** Every content stream in the document, inflated back to PDF operators. */
async function contentStreams(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const parts: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    let raw = Buffer.from(obj.getContents());
    const filter = obj.dict.get(PDFName.of("Filter"));
    if (filter && String(filter).includes("FlateDecode")) {
      try { raw = Buffer.from(inflateSync(raw)); } catch { continue; }
    }
    parts.push(raw.toString("latin1"));
  }
  return parts.join("\n");
}

/** The shown text recovered from those streams. pdf-lib writes standard-font text as
 *  hex strings, so both hex and literal string operands are decoded. Output is only
 *  non-empty when the PDF really holds text objects (not a rasterised image). */
async function textFromBytes(bytes: Uint8Array): Promise<string> {
  const body = await contentStreams(bytes);
  const out: string[] = [];
  for (const m of body.matchAll(/(?:<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^()\\])*)\))\s*Tj/g)) {
    if (m[1] !== undefined) {
      const hex = m[1].replace(/\s+/g, "");
      let s = "";
      for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      out.push(s);
    } else {
      out.push((m[2] || "").replace(/\\([()\\])/g, "$1"));
    }
  }
  return out.join("\n");
}

const extractText = async (r: EvidenceResponse) => textFromBytes(await buildEvidenceBriefBytes(r));
/** Line wrapping is a layout detail — flatten it before matching sentences. */
const flat = (s: string) => s.replace(/\s+/g, " ");
const extractComparisonText = async (rs: EvidenceResponse[], c: string) =>
  textFromBytes(await buildComparisonBytes(rs, c));
