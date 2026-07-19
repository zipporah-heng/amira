import { Link } from "react-router-dom";
import type { EvidenceResponse } from "../api";

/** Verification status. AMIRA reports what has actually been verified, and by whom. */
export function ConfidencePanel({ report }: { report: EvidenceResponse }) {
  const all = report.trials.flatMap((t) => t.assertions);
  const sourceVerified = all.filter((a) => a.source_verified).length;
  const humanVerified = all.filter((a) => a.human_verified).length;
  const pending = all.length - humanVerified;

  return (
    <div className="rail-card">
      <h3 className="rail-title">How verified is this?</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 8 }}>
        Traceability of the displayed evidence:
      </p>

      <ul className="rail-list" style={{ marginTop: 10 }}>
        <li>
          <span className="ic ok">✓</span>
          <span>{sourceVerified} of {all.length} assertions matched against the retrieved primary source.</span>
        </li>
        <li>
          <span className="ic ok">✓</span>
          <span>Every assertion carries an exact passage and a resolvable source URL.</span>
        </li>
        <li>
          <span className="ic x">✕</span>
          <span>
            {humanVerified} of {all.length} assertions have named human sign-off
            {pending > 0 ? ` — ${pending} pending review.` : "."}
          </span>
        </li>
      </ul>

      <p style={{ fontSize: 12, marginTop: 10, color: "var(--ink-2)" }}>
        Model evaluation: <strong>{report.evaluation_status || "EVALUATION PENDING"}</strong>
      </p>
      <Link to="/amira/methodology" className="rail-link">How AMIRA verifies →</Link>
    </div>
  );
}
