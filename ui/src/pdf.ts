import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { EvidenceResponse } from "./api";
import * as M from "./evidenceModel";
import { REVIEWED_THROUGH_LABEL, freshness } from "./criticalSignal";

/** REAL PDF EXPORTS (application/pdf, %PDF signature, selectable text).
 *
 *  Both exports read ui/src/evidenceModel.ts — the same derivation layer the pages
 *  render — so an export can never disagree with the screen. No Markdown is produced
 *  anywhere: the output is a genuine PDF built with pdf-lib and standard Helvetica,
 *  which keeps the text selectable and searchable in any reader. */

const PAGE_W = 595.28;   // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 48;
const INK = rgb(0.07, 0.086, 0.2);        // #121633
const MUTED = rgb(0.384, 0.404, 0.498);   // #62677F
const PURPLE = rgb(0.427, 0.235, 0.922);  // #6D3CEB
const RULE = rgb(0.871, 0.835, 0.961);    // #DED5F5

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

/** Wrap text to the content width using real font metrics. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
    if (line) lines.push(line);
    // A single word longer than the line: hard-split it so nothing overflows.
    if (font.widthOfTextAtSize(w, size) > width) {
      let chunk = "";
      for (const ch of w) {
        if (font.widthOfTextAtSize(chunk + ch, size) > width) { lines.push(chunk); chunk = ch; }
        else chunk += ch;
      }
      line = chunk;
    } else line = w;
  }
  if (line) lines.push(line);
  return lines;
}

function text(ctx: Ctx, s: string, opts: { size?: number; bold?: boolean; color?: any; gap?: number; indent?: number } = {}) {
  const size = opts.size ?? 10.5;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const indent = opts.indent ?? 0;
  const width = PAGE_W - MARGIN * 2 - indent;
  const lines = wrap(s, font, size, width);
  for (const line of lines) {
    ensure(ctx, size + 4);
    ctx.page.drawText(line, { x: MARGIN + indent, y: ctx.y - size, size, font, color: opts.color ?? INK });
    ctx.y -= size * 1.35;
  }
  ctx.y -= opts.gap ?? 0;
}

function heading(ctx: Ctx, s: string) {
  ensure(ctx, 40);
  ctx.y -= 10;
  text(ctx, s, { size: 13, bold: true, color: PURPLE });
  ensure(ctx, 12);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 3 }, end: { x: PAGE_W - MARGIN, y: ctx.y + 3 },
    thickness: 1, color: RULE,
  });
  ctx.y -= 8;
}

/** A label / value row. Long values wrap under the label rather than being clipped. */
function row(ctx: Ctx, label: string, value: string) {
  if (!value) return;
  text(ctx, label, { size: 9, bold: true, color: MUTED });
  text(ctx, value, { size: 10.5, gap: 4 });
}

function bullet(ctx: Ctx, s: string) {
  text(ctx, `- ${s}`, { size: 10, indent: 8 });
}

function footerNote(ctx: Ctx) {
  heading(ctx, "Important");
  text(ctx, M.NON_RECOMMENDATION, { size: 9.5, color: MUTED, gap: 4 });
}

/** ISO date for filenames; the caller supplies it so nothing depends on hidden clocks. */
export const today = () => new Date().toISOString().slice(0, 10);

export const safeName = (s: string) => (s || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Filename-only title casing (e.g. "Type 2 diabetes" → "Type_2_Diabetes"). The
 *  canonical condition string itself is never altered — only the download name. */
const titleCaseName = (s: string) =>
  safeName(s).split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join("_");

async function startDoc(): Promise<Ctx> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, regular, bold };
  return ctx;
}

function brandHeader(ctx: Ctx, title: string, subtitle: string) {
  text(ctx, "AMIRA", { size: 20, bold: true, color: PURPLE });
  text(ctx, "Evidence Intelligence Platform", { size: 9, color: MUTED, gap: 10 });
  text(ctx, title, { size: 15, bold: true });
  if (subtitle) text(ctx, subtitle, { size: 10, color: MUTED, gap: 2 });
}

/** The evidence body for ONE medicine — shared by the single brief and the
 *  per-medicine detail sections of the comparison PDF. */
function medicineBody(ctx: Ctx, r: EvidenceResponse) {
  const mat = M.maturity(r);
  const pop = M.evidencePopulation(r);

  heading(ctx, "Evidence scope");
  row(ctx, "Medicine", M.medicineName(r));
  row(ctx, "Active ingredient", M.activeIngredient(r) || "Not recorded");
  row(ctx, "Condition", M.condition(r));
  row(ctx, "Drug class", M.drugClass(r));
  row(ctx, "Primary evidence", [pop.label, pop.detail].filter(Boolean).join(" — "));
  if (M.brandNote(r)) row(ctx, "Brand note", M.brandNote(r)!);
  row(ctx, "Evidence maturity", `${mat.display}${mat.label ? ` (${mat.label})` : ""}`);

  heading(ctx, "Women in the evidence");
  row(ctx, "Women included", M.womenIncluded(r).label);
  row(ctx, "Women counted (who took part)", M.womenCounted(r).label);
  row(ctx, "Women analyzed (outcomes analysed separately by sex)", M.womenAnalyzed(r).label);

  heading(ctx, "Sex-specific effectiveness");
  text(ctx, M.effectiveness(r).label, { gap: 2 });
  const effHead = r.effectiveness?.headline;
  if (effHead && effHead !== M.effectiveness(r).label) text(ctx, effHead, { size: 10, color: MUTED });

  heading(ctx, "Women-specific safety");
  text(ctx, M.safety(r).label, { gap: 2 });
  const safHead = r.safety?.headline;
  if (safHead && safHead !== M.safety(r).label) text(ctx, safHead, { size: 10, color: MUTED });

  const ae = M.commonAdverseEffects(r);
  heading(ctx, "Common adverse effects (from reviewed sources)");
  if (ae) {
    text(ctx, ae.list.join(", "), { gap: 2 });
    text(ctx, "These are overall adverse effects from the reviewed prescribing information. They are not, on their own, evidence of a sex-specific effect.",
      { size: 9, color: MUTED });
    if (ae.source?.title) row(ctx, "Source", `${ae.source.title}${ae.source.url ? ` — ${ae.source.url}` : ""}`);
  } else {
    text(ctx, "Not recorded in the reviewed sources.", { color: MUTED });
  }

  heading(ctx, "Life-stage evidence");
  text(ctx, M.lifeStageEvidence(r).label, { gap: 2 });
  text(ctx, "Menopausal status is never inferred from age.", { size: 9, color: MUTED });

  const hc = M.hormonalContext(r);
  heading(ctx, "Hormonal context");
  row(ctx, "Menopause representation", hc.menopauseRepresentation.label);
  row(ctx, "Hormone therapy representation", hc.hormoneTherapyRepresentation.label);
  row(ctx, "Hormonal-context analysis", hc.hormonalContextAnalysis.label);

  const passages = M.exactPassages(r);
  heading(ctx, "Exact passages from the evidence");
  if (passages.length === 0) {
    text(ctx, "No source-linked passage is recorded for this medicine.", { color: MUTED });
  } else {
    for (const p of passages) {
      text(ctx, p.study, { size: 10, bold: true });
      text(ctx, `"${p.passage}"`, { size: 10, gap: 2 });
      text(ctx, `${p.sourceTitle} (${p.sourceId})${p.locator ? ` — ${p.locator}` : ""}`, { size: 9, color: MUTED });
      text(ctx, p.url, { size: 9, color: PURPLE, gap: 6 });
    }
  }

  heading(ctx, "Source records reviewed");
  for (const s of M.sourceRecords(r)) text(ctx, `${s.sourceId} — ${s.title} — ${s.url}`, { size: 9, indent: 8 });

  heading(ctx, "About this evidence review");
  row(ctx, "Human review status", M.humanReviewStatus(r));
  const fresh = freshness(M.evidenceCutoff(r));
  row(ctx, REVIEWED_THROUGH_LABEL,
    `${M.evidenceCutoff(r)}${fresh ? ` (${fresh.label})` : ""}`);
  row(ctx, "Sources reviewed", String(M.sourceRecords(r).length));
  row(ctx, "Dataset version", r.dataset_version || "");

  heading(ctx, "Limitations");
  for (const l of M.limitations(r)) bullet(ctx, l);
}

/** The raw PDF byte stream — begins with the %PDF signature.
 *  Object streams are disabled so the document structure (fonts, page tree) stays
 *  directly inspectable by readers and verification tooling. */
async function finishBytes(ctx: Ctx): Promise<Uint8Array> {
  return ctx.doc.save({ useObjectStreams: false });
}

/** Wrap PDF bytes as an application/pdf blob (copied into a plain ArrayBuffer so the
 *  Blob part type is unambiguous). */
export function pdfBlob(bytes: Uint8Array): Blob {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf], { type: "application/pdf" });
}

/** Trigger a browser download of a blob under an explicit filename. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Individual Evidence Brief — one medicine. */
export async function buildEvidenceBriefBytes(r: EvidenceResponse): Promise<Uint8Array> {
  const ctx = await startDoc();
  brandHeader(
    ctx,
    `Evidence brief: ${M.medicineName(r)}`,
    `What the reviewed evidence shows about ${M.medicineName(r)} in women`,
  );
  medicineBody(ctx, r);
  footerNote(ctx);
  return finishBytes(ctx);
}

export async function buildEvidenceBriefPdf(r: EvidenceResponse): Promise<Blob> {
  return pdfBlob(await buildEvidenceBriefBytes(r));
}

export function evidenceBriefFilename(r: EvidenceResponse, date = today()) {
  return `AMIRA_${safeName(M.medicineName(r))}_Evidence_Brief_${date}.pdf`;
}

/** Comparison PDF — every medicine currently displayed in the comparison. */
export async function buildComparisonBytes(reports: EvidenceResponse[], conditionName: string): Promise<Uint8Array> {
  const ctx = await startDoc();
  brandHeader(
    ctx,
    `Evidence comparison: ${conditionName}`,
    `Comparing the completeness and visibility of evidence about women across ${reports.length} medicine${reports.length === 1 ? "" : "s"}`,
  );
  text(ctx, M.NON_RECOMMENDATION, { size: 9.5, color: MUTED, gap: 6 });

  heading(ctx, "Medicines in this comparison");
  reports.forEach((r, i) => {
    const mat = M.maturity(r);
    text(ctx, `${i + 1}. ${M.medicineName(r)}${i === 0 ? " (selected medicine)" : ""}`, { size: 10.5, bold: true });
    text(ctx, `Active ingredient: ${M.activeIngredient(r) || "Not recorded"} · Drug class: ${M.drugClass(r)} · Evidence maturity: ${mat.display}`,
      { size: 9.5, color: MUTED, indent: 8, gap: 4 });
  });

  // Aligned comparison — the same rows, in the same order, for every medicine.
  heading(ctx, "Aligned evidence comparison");
  const rows: { label: string; value: (r: EvidenceResponse) => string }[] = [
    { label: "Evidence maturity", value: (r) => M.maturity(r).display },
    { label: "Active ingredient", value: (r) => M.activeIngredient(r) || "Not recorded" },
    { label: "Condition", value: (r) => M.condition(r) },
    { label: "Drug class", value: (r) => M.drugClass(r) },
    { label: "Primary evidence", value: (r) => M.evidencePopulation(r).label },
    { label: "Women included", value: (r) => M.womenIncluded(r).label },
    { label: "Women counted", value: (r) => M.womenCounted(r).label },
    { label: "Women analyzed", value: (r) => M.womenAnalyzed(r).label },
    { label: "Sex-specific effectiveness", value: (r) => M.effectiveness(r).label },
    { label: "Women-specific safety", value: (r) => M.safety(r).label },
    { label: "Common adverse effects", value: (r) => M.commonAdverseEffects(r)?.list.join(", ") || "Not recorded" },
    { label: "Life-stage evidence", value: (r) => M.lifeStageEvidence(r).label },
    { label: "Hormonal context", value: (r) => M.hormonalContext(r).hormonalContextAnalysis.label },
    { label: "Human review status", value: (r) => M.humanReviewStatus(r) },
    { label: REVIEWED_THROUGH_LABEL, value: (r) => M.evidenceCutoff(r) },
    { label: "Exact passages", value: (r) => String(M.exactPassages(r).length) },
  ];
  for (const row_ of rows) {
    text(ctx, row_.label, { size: 9.5, bold: true, color: MUTED });
    for (const r of reports) text(ctx, `${M.medicineName(r)}: ${row_.value(r)}`, { size: 10, indent: 8 });
    ctx.y -= 4;
  }

  for (const r of reports) {
    newPage(ctx);
    text(ctx, `${M.medicineName(r)} — evidence detail`, { size: 14, bold: true, gap: 2 });
    medicineBody(ctx, r);
  }

  footerNote(ctx);
  return finishBytes(ctx);
}

export async function buildComparisonPdf(reports: EvidenceResponse[], conditionName: string): Promise<Blob> {
  return pdfBlob(await buildComparisonBytes(reports, conditionName));
}

export function comparisonFilename(conditionName: string, date = today()) {
  return `AMIRA_${titleCaseName(conditionName)}_Evidence_Comparison_${date}.pdf`;
}
