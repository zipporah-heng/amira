import type { ReportedStatus, Source } from "./api";

export const STATUS_LABEL: Record<ReportedStatus, string> = {
  yes: "Yes",
  no: "No",
  uncertain: "Uncertain",
  not_reported: "Not reported in reviewed sources",
  unknown: "Not assessed",
};

export const CLASSIFICATION_CAPTION =
  "This describes evidence completeness — not whether the medicine works or is safe.";

export function clsKey(classification: string): string {
  const map: Record<string, string> = {
    STRONG: "cls-STRONG",
    MODERATE: "cls-MODERATE",
    LIMITED: "cls-LIMITED",
    INSUFFICIENT: "cls-INSUFFICIENT",
    "NO RELEVANT EVIDENCE FOUND": "cls-NONE",
  };
  return map[classification] || "cls-NONE";
}

export function provenanceBadge(p: string) {
  const map: Record<string, { cls: string; label: string }> = {
    LIVE_SOURCE: { cls: "live", label: "Live source" },
    VERIFIED_DEMO_DATA: { cls: "verified", label: "Verified demo data" },
    AI_EXTRACTED: { cls: "ai", label: "AI extracted" },
    HUMAN_VERIFIED: { cls: "human", label: "Human verified" },
  };
  return map[p] || { cls: "demo", label: p };
}

export function sourceTypeLabel(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function lifeStageLabel(s: string): string {
  const map: Record<string, string> = {
    premenopause: "Premenopause",
    perimenopause: "Perimenopause",
    postmenopause: "Postmenopause",
    not_specified: "Not specified",
  };
  return map[s] || s;
}

export function hormoneLabel(s: string): string {
  const map: Record<string, string> = {
    yes: "Menopausal hormone therapy: Yes",
    no: "Menopausal hormone therapy: No",
    not_specified: "Hormonal context: Not specified",
  };
  return map[s] || s;
}

/** Human-readable source citation line. */
export function citationLine(s: Source): string {
  const bits = [s.source_location, s.publication_year ? String(s.publication_year) : null].filter(
    Boolean
  );
  return bits.join(" · ");
}
