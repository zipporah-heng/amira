import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { inflateSync } from "node:zlib";

/** Test-only PDF text recovery.
 *
 *  Rebuilds the drawn text from a PDF's own content streams, which proves the export
 *  holds real, selectable text rather than a rasterised image. Shared by the PDF unit
 *  tests, the women-aggregation parity test and the browser download test so all three
 *  verify the same bytes the browser receives. */

/** Every content stream in the document, inflated back to PDF operators. */
export async function pdfContentStreams(bytes: Uint8Array): Promise<string> {
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

/** The shown text recovered from those streams. pdf-lib writes standard-font text as hex
 *  strings, so both hex and literal string operands are decoded. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const body = await pdfContentStreams(bytes);
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
