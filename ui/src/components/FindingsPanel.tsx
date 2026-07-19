import { Link } from "react-router-dom";
import type { EvidenceResponse } from "../api";

/** Only citation-backed positive findings, computed from the API response. */
export function FindingsPanel({ report }: { report: EvidenceResponse }) {
  const t = report.totals!;
  const items: string[] = [];

  items.push(`Women were included in ${t.trials} of ${t.trials} trials in the reviewed corpus.`);
  if (t.women_reported_count > 0) {
    items.push(
      `${t.women_reported_count.toLocaleString()} women have an exact reported count ` +
      `(${t.trials_with_reported_female_count.join(", ")}).`
    );
  }
  for (const c of t.women_estimate_components) {
    items.push(`${c.trial_id} reports ${c.reported_pct}% women of ${c.total_enrollment.toLocaleString()} participants.`);
  }
  for (const d of report.dimensions) {
    if (d.n_reporting > 0) {
      items.push(`${d.title} reported in ${d.n_reporting} of ${d.n_trials} trials.`);
    }
  }

  return (
    <div className="rail-card">
      <h3 className="rail-title">What we found</h3>
      <ul className="rail-list found">
        {items.map((x) => (
          <li key={x}><span className="ic ok">✓</span><span>{x}</span></li>
        ))}
      </ul>
      <Link to="/amira/methodology" className="rail-link">See all findings →</Link>
    </div>
  );
}
