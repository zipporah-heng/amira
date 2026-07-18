import { Link } from "react-router-dom";
import { fixture } from "../fixture";
import { DemoBadge } from "./DemoBadge";

const LEVELS = ["Low", "Moderate", "High"];

export function ConfidencePanel() {
  const { level, rationale } = fixture.meta.confidence;
  const filled = LEVELS.indexOf(level) + 1;

  return (
    <div className="rail-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 className="rail-title" style={{ margin: 0 }}>How confident are we?</h3>
        <DemoBadge />
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 8 }}>
        Source confidence for this evidence:
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 750, color: "var(--green)" }}>{level}</span>
        <div className="conf-meter">
          {LEVELS.map((_, i) => (
            <span key={i} className={i < filled ? "on" : ""} />
          ))}
        </div>
      </div>
      <p style={{ fontSize: 13, marginTop: 10 }}>{rationale}</p>
      <Link to="/amira/methodology" className="rail-link">
        Learn about confidence scores →
      </Link>
    </div>
  );
}
