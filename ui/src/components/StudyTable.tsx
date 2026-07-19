import type { TrialRow } from "../api";

function Mark({ v }: { v: string }) {
  return v === "yes" ? (
    <span className="mark ok" title="Reported">✓</span>
  ) : (
    <span className="mark x" title="Not reported in the reviewed sources">✕</span>
  );
}

export function StudyTable({
  trials, onOpen,
}: { trials: TrialRow[]; onOpen: (t: TrialRow) => void }) {
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">Studies behind this result ({trials.length})</div>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Click a row to open its source</span>
      </div>
      <div className="tbl-wrap">
        <table className="studies">
          <thead>
            <tr>
              <th>Study</th><th>NCT ID</th><th>Year</th><th>Women (N)</th><th>% Women</th>
              <th style={{ textAlign: "center" }}>Sex-specific outcomes</th>
              <th style={{ textAlign: "center" }}>Menopause reported</th>
              <th style={{ textAlign: "center" }}>Hormone therapy reported</th>
              <th>Study type</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => (
              <tr key={t.trial_id} onClick={() => onOpen(t)}>
                <td className="td-name">{t.display_name}</td>
                <td>{t.nct_id}</td>
                <td>{t.year ?? "—"}</td>
                <td>
                  {t.female_n != null ? t.female_n.toLocaleString() : (
                    <span title="No exact female count is published for this trial"
                          style={{ color: "var(--ink-3)" }}>not reported</span>
                  )}
                </td>
                <td>
                  {t.female_pct != null ? `${t.female_pct}%` : "—"}
                  {t.female_pct_basis === "derived" && (
                    <span title="Derived by AMIRA from reported counts"
                          style={{ color: "var(--ink-3)", fontSize: 11 }}> (derived)</span>
                  )}
                </td>
                <td style={{ textAlign: "center" }}><Mark v={t.sex_specific_efficacy_reported} /></td>
                <td style={{ textAlign: "center" }}><Mark v={t.menopause_status_reported} /></td>
                <td style={{ textAlign: "center" }}><Mark v={t.hormone_therapy_reported} /></td>
                <td>{t.study_type}</td>
                <td>
                  <a href={t.registry_url} target="_blank" rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()} className="src-link">
                    ClinicalTrials.gov ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
        Studies are assessed based on available reporting. Absence of evidence is not evidence
        of absence.
      </p>
    </div>
  );
}
