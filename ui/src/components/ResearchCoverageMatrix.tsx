import { fixture } from "../fixture";
import { DemoBadge } from "./DemoBadge";

const CELL_LABEL: Record<string, string> = {
  present: "Present",
  missing: "Missing",
  unclear: "Unclear",
};
const CELL_ICON: Record<string, string> = {
  present: "●",
  missing: "○",
  unclear: "◐",
};

export function ResearchCoverageMatrix() {
  const { columns, rows, highest_gaps } = fixture.research_map;
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">Women's Evidence Coverage Matrix</div>
        <DemoBadge />
      </div>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="row-h">Medicine</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.medicine}>
                <td className="rowlabel">{r.medicine}</td>
                {r.cells.map((cell, i) => (
                  <td key={i}>
                    <span className={`cell ${cell}`}>
                      <span>{CELL_ICON[cell]}</span> {CELL_LABEL[cell]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="section-title">Highest visible evidence gaps</div>
        <div className="gap-chips">
          {highest_gaps.map((g) => (
            <span className="gap-chip" key={g}>{g}</span>
          ))}
        </div>
      </div>
      <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
        Coverage is bounded to the reviewed sample. "Missing" means not reported in the
        reviewed studies — never that a medicine does not work.
      </p>
    </div>
  );
}
