import { Link } from "react-router-dom";
import { fixture } from "../fixture";
import { DemoBadge } from "./DemoBadge";

export function MedicineCard() {
  const m = fixture.meta;
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
          <h2 className="med-name">
            {m.medicine} <span className="med-brand">({m.brand})</span>
          </h2>
          <div className="med-facts">
            <div><span className="mf-k">Drug class:</span> {m.drug_class}</div>
            <div><span className="mf-k">Used for:</span> {m.used_for}</div>
          </div>
        </div>
      </div>

      <div className="med-level">
        <div className="ml-head">
          AMIRA Evidence Level <span className="info" title="An evidence-maturity model, not a treatment recommendation.">ⓘ</span>
        </div>
        <div className="ml-num"><b>{m.evidence_level}</b> <span>of 5</span></div>
        <div className="ml-name">{m.evidence_level_label}</div>
      </div>

      <div className="med-means">
        <div className="mm-title">What this means</div>
        <p>{m.what_this_means}</p>
        <Link to="/amira/methodology" className="rail-link">See levels explained →</Link>
      </div>

      <div className="med-badge"><DemoBadge /></div>
    </div>
  );
}
