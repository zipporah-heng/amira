import { Link } from "react-router-dom";
import type { EvidenceResponse } from "../api";

/** Measurable gap statements, always bounded to the reviewed corpus. */
export function MissingEvidencePanel({ report }: { report: EvidenceResponse }) {
  const t = report.totals!;
  const items: string[] = [];

  for (const d of report.dimensions) {
    const missing = d.n_trials - d.n_reporting;
    if (missing > 0) {
      items.push(`${missing} of ${d.n_trials} trials did not report ${d.title.toLowerCase()}.`);
    }
  }
  if (t.trials_with_percentage_only.length) {
    items.push(
      `${t.trials_with_percentage_only.length} of ${t.trials} trials publish no exact female ` +
      `participant count (${t.trials_with_percentage_only.join(", ")} reports a percentage only).`
    );
  }
  if (report.life_stage_context && !report.life_stage_context.supported) {
    items.push("Menopausal status is not reported, so no life stage can be evidenced.");
  }

  return (
    <div className="rail-card">
      <h3 className="rail-title missing">What's still missing</h3>
      <ul className="rail-list missing">
        {items.map((x) => (
          <li key={x}><span className="ic x">✕</span><span>{x}</span></li>
        ))}
      </ul>
      <p className="disclaimer" style={{ marginTop: 10 }}>
        In the sources reviewed (corpus {report.dataset_version}, cutoff {report.source_cutoff}).
        Absence of evidence is not evidence of absence.
      </p>
      <Link to="/amira/research-map" className="rail-link missing">See research gaps →</Link>
    </div>
  );
}
