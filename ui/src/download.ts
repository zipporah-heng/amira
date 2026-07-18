import { fixture } from "./fixture";
import type { BenchmarkExample, Study } from "./types";

/** Trigger a client-side file download from an in-memory string. */
export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const STUDY_COLUMNS: (keyof Study)[] = [
  "study_id", "medicine", "condition", "study_type", "year", "total_n", "female_n",
  "female_pct", "sex_specific_efficacy_reported", "sex_specific_safety_reported",
  "sex_by_treatment_interaction", "menopause_reported", "perimenopause_reported",
  "postmenopause_reported", "hormone_therapy_reported", "pregnancy_reported",
  "relevant_evidence_passage", "source", "source_url", "ai_confidence", "human_verified",
];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** All downloads are generated from the same deterministic fixture the UI reads. */
export function datasetCsv(): string {
  const header = STUDY_COLUMNS.join(",");
  const rows = fixture.studies.map((s) =>
    STUDY_COLUMNS.map((c) => csvCell(s[c])).join(",")
  );
  return [header, ...rows].join("\n") + "\n";
}

export function datasetJsonl(): string {
  return fixture.studies.map((s) => JSON.stringify(s)).join("\n") + "\n";
}

export function benchmarkJsonl(split?: BenchmarkExample["split"]): string {
  const rows = split
    ? fixture.benchmark.examples.filter((e) => e.split === split)
    : fixture.benchmark.examples;
  return rows.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

export function schemaJson(): string {
  const schema = {
    schema_version: "1.0-demo",
    title: "AMIRA Open Women's Hormonal Evidence — study record",
    disclaimer: fixture.meta.disclaimer,
    columns: STUDY_COLUMNS,
  };
  return JSON.stringify(schema, null, 2);
}
