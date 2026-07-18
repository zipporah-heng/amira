import type { ReportedStatus, Study } from "../types";
import { DemoBadge } from "./DemoBadge";

function Pill({ v }: { v: ReportedStatus }) {
  const label = v === "not_reported" ? "not reported" : v;
  return <span className={`pill ${v}`}>{label}</span>;
}

export function StudyTable({ studies, onOpen }: { studies: Study[]; onOpen: (s: Study) => void }) {
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="section-title">Studies behind this result</div>
          <p style={{ marginTop: 6, fontSize: 13.5 }}>
            {studies.length} sample studies. Click any row to open the source.
          </p>
        </div>
        <DemoBadge />
      </div>
      <div className="tbl-wrap">
        <table className="studies">
          <thead>
            <tr>
              <th>Study</th>
              <th>Year</th>
              <th>Women N</th>
              <th>Women %</th>
              <th>Sex-specific outcomes</th>
              <th>Menopause reported</th>
              <th>Hormone therapy reported</th>
              <th>Study type</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {studies.map((s) => (
              <tr key={s.study_id} onClick={() => onOpen(s)}>
                <td>{s.study_id}</td>
                <td>{s.year}</td>
                <td>{s.female_n.toLocaleString()}</td>
                <td>{s.female_pct}%</td>
                <td><Pill v={s.sex_specific_efficacy_reported} /></td>
                <td><Pill v={s.menopause_reported} /></td>
                <td><Pill v={s.hormone_therapy_reported} /></td>
                <td>{s.study_type}</td>
                <td><span className="badge demo"><span className="dot" /> Demo</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
