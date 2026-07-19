import type { ClassComparison as CC } from "../api";

export function ClassComparison({ data, current }: { data: CC; current: string }) {
  return (
    <section id="class" className="card">
      <div className="section-title">Compared with other {data.drug_class.toLowerCase()}s in AMIRA</div>
      <p className="muted" style={{ marginTop: 4 }}>{data.ranking.summary}</p>
      <p className="muted" style={{ marginTop: 2, fontStyle: "italic" }}>{data.ranking.basis}</p>

      <div className="tbl-wrap" style={{ marginTop: 12 }}>
        <table className="studies">
          <thead>
            <tr>
              <th>Medicine</th><th>Evidence maturity</th>
              <th>Sex-specific effectiveness</th><th>Sex-specific side effects</th>
              <th>Key evidence gap</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.medicine} className={r.medicine.toLowerCase() === current.toLowerCase() ? "row-current" : ""}>
                <td className="td-name">
                  {r.medicine}
                  {r.medicine.toLowerCase() === current.toLowerCase() && <span className="you"> (viewing)</span>}
                </td>
                <td>
                  {r.maturity_scorable
                    ? <><span className="mat-pill">{r.maturity_display}</span> {r.maturity_label}</>
                    : <span title="Female enrolment evidence not located in accessible sources"
                            style={{ color: "var(--ink-3)" }}>Not yet established</span>}
                </td>
                <td>{r.effectiveness_state}</td>
                <td>{r.safety_state}</td>
                <td>{r.key_gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.class_level_findings.length > 0 && (
        <div className="class-note">
          <strong>Class-level evidence:</strong>{" "}
          {data.class_level_findings.map((f) => (
            <span key={f.finding_id}>
              {f.interpretation}{" "}
              <a href={f.source.url} target="_blank" rel="noopener noreferrer">
                {f.source.pmid ? `PMID ${f.source.pmid}` : "source"} ↗
              </a>{" "}
            </span>
          ))}
        </div>
      )}

      <p className="disclaimer" style={{ marginTop: 12 }}>{data.note}</p>
    </section>
  );
}
