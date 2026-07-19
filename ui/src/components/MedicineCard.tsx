import { Link } from "react-router-dom";
import type { EvidenceResponse } from "../api";
import { DatasetStamp } from "./DemoBadge";

export function MedicineCard({ report }: { report: EvidenceResponse }) {
  const m = report.maturity!;
  return (
    <div className="card med-card">
      <div className="med-left">
        <div className="pill-icon" aria-hidden>
          <svg viewBox="0 0 48 48" width="48" height="48">
            <rect x="7" y="18" width="34" height="14" rx="7" fill="var(--lav-200)" />
            <rect x="7" y="18" width="17" height="14" rx="7" fill="var(--lav-500)" />
            <circle cx="15.5" cy="25" r="1.6" fill="#fff" opacity="0.85" />
          </svg>
        </div>
        <div>
          <h2 className="med-name">{report.query.medicine}</h2>
          <div className="med-facts">
            <div><span className="mf-k">Drug class:</span> Statin (HMG-CoA reductase inhibitor)</div>
            <div><span className="mf-k">Evidence corpus:</span> {report.trials.map((t) => t.display_name).join(", ")}</div>
          </div>
        </div>
      </div>

      <div className="med-level">
        <div className="ml-head">
          AMIRA Evidence Level{" "}
          <span className="info" title={m.derivation_note}>ⓘ</span>
        </div>
        <div className="ml-num"><b>{m.level}</b> <span>of {m.max_level}</span></div>
        <div className="ml-name">{m.label}</div>
      </div>

      <div className="med-means">
        <div className="mm-title">What this means</div>
        <p>{m.description}</p>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
          Derived from {report.trials.length} trial(s) in the reviewed corpus — not stored in the data.
        </p>
        <Link to="/amira/methodology" className="rail-link">See levels explained →</Link>
      </div>

      <div className="med-badge">
        <DatasetStamp
          version={report.dataset_version}
          cutoff={report.source_cutoff}
          commit={report.commit_hash}
        />
      </div>
    </div>
  );
}
