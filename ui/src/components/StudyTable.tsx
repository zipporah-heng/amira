import type { StudyRecord } from "../api";

const KIND_LABEL: Record<string, string> = {
  trial_registry_record: "Trial",
  analysis_publication: "Analysis",
  primary_publication: "Publication",
};

/** Short, readable source label from the URL (keeps the table within the
 *  container without truncation). */
function shortSource(url: string, fallback: string): string {
  if (/clinicaltrials\.gov/i.test(url)) return "ClinicalTrials.gov";
  if (/pubmed\.ncbi/i.test(url)) return "PubMed";
  if (/ncbi\.nlm\.nih\.gov\/pmc|pmc\.ncbi/i.test(url)) return "PubMed Central";
  if (/nature\.com/i.test(url)) return "Nature";
  return fallback.length > 20 ? fallback.slice(0, 18) + "…" : fallback;
}

/** Section 9 — Studies behind this result. One row per source DOCUMENT
 *  (registry record, linked analysis publication, or primary report). Every
 *  value is source-local to that row's own trial; each row links to its correct
 *  original source. */
export function StudyTable({ records }: { records: StudyRecord[] }) {
  return (
    <section className="card" id="studies" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">Studies behind this result ({records.length})</div>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Each row links to its original source</span>
      </div>
      <div className="tbl-wrap">
        <table className="studies">
          <thead>
            <tr>
              <th>Study</th><th>Year</th><th>Women</th>
              <th>Sex-specific outcomes</th><th>Menopause</th><th>Hormone therapy</th>
              <th>Study type</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.trial_id + r.record_kind + i}
                  onClick={() => window.open(r.source_url, "_blank", "noopener,noreferrer")}>
                <td className="td-name">
                  {r.study}
                  <span className="kind-chip">{KIND_LABEL[r.record_kind] || "Source"}</span>
                </td>
                <td>{r.year ?? "—"}</td>
                <td className={r.women_basis === "reported" ? "" : "muted-cell"}>{r.women}</td>
                <td>{r.sex_outcomes}</td>
                <td className="muted-cell">{r.menopause}</td>
                <td className="muted-cell">{r.hormone_therapy}</td>
                <td>{r.study_type}</td>
                <td>
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()} className="src-link">
                    {shortSource(r.source_url, r.source_label)} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 14, color: "var(--ink-3)", fontStyle: "italic" }}>
        Studies are assessed based on available reporting. Absence of evidence is not evidence of absence.
      </p>
    </section>
  );
}
