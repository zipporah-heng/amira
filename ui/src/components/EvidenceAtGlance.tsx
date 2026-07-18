import { stats } from "../fixture";
import { DemoBadge } from "./DemoBadge";

export function EvidenceAtGlance() {
  const max = Math.max(...stats.studyTypes.map((t) => t.count), 1);
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">Evidence at a glance</div>
        <DemoBadge />
      </div>
      <div className="glance">
        {stats.studyTypes.map((t) => (
          <div className="glance-row" key={t.type}>
            <span className="gl-label">{t.type}</span>
            <span className="gl-bar">
              <span style={{ width: `${(t.count / max) * 100}%` }} />
            </span>
            <span className="gl-val">{t.count}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-2)" }}>
        <b>{stats.studyCount}</b> studies reviewed in this sample.
      </p>
    </div>
  );
}
