import { useState } from "react";
import type { ReportedStatus, Study } from "../types";
import { DemoBadge } from "./DemoBadge";

function Mark({ v }: { v: ReportedStatus }) {
  return v === "yes" ? (
    <span className="mark ok" title="Reported">✓</span>
  ) : (
    <span className="mark x" title="Not reported">✕</span>
  );
}

export function StudyTable({ studies, onOpen }: { studies: Study[]; onOpen: (s: Study) => void }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? studies : studies.slice(0, 5);

  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">Studies behind this result ({studies.length})</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <DemoBadge />
          <button className="linkbtn" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show fewer ↑" : "View all studies →"}
          </button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="studies">
          <thead>
            <tr>
              <th>Study</th>
              <th>Year</th>
              <th>Women (N)</th>
              <th>% Women</th>
              <th style={{ textAlign: "center" }}>Sex-specific outcomes</th>
              <th style={{ textAlign: "center" }}>Menopause reported</th>
              <th style={{ textAlign: "center" }}>Hormone therapy reported</th>
              <th>Study type</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.study_id} onClick={() => onOpen(s)}>
                <td className="td-name">{s.title.split(" — ")[0]}</td>
                <td>{s.year}</td>
                <td>{s.female_n.toLocaleString()}</td>
                <td>{Math.round(s.female_pct)}%</td>
                <td style={{ textAlign: "center" }}><Mark v={s.sex_specific_efficacy_reported} /></td>
                <td style={{ textAlign: "center" }}><Mark v={s.menopause_reported} /></td>
                <td style={{ textAlign: "center" }}><Mark v={s.hormone_therapy_reported} /></td>
                <td>{s.study_type}</td>
                <td>
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="src-link"
                  >
                    {s.source} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
        Studies are assessed based on available reporting. Absence of evidence is not evidence
        of absence. All rows are demo data.
      </p>
    </div>
  );
}
