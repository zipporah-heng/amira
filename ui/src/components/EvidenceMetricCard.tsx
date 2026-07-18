import type { ReactNode } from "react";

export function EvidenceMetricCard({
  icon,
  tint,
  title,
  value,
  sub,
  zero = false,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  value: string;
  sub: string;
  zero?: boolean;
}) {
  return (
    <div className="metric-card">
      <div className="mc-icon" style={{ background: tint }}>{icon}</div>
      <div className="mc-title">{title}</div>
      <div className={`mc-num ${zero ? "zero" : ""}`}>{value}</div>
      <div className="mc-sub">{sub}</div>
    </div>
  );
}
