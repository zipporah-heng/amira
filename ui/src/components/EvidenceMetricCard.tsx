import type { ReactNode } from "react";

export function EvidenceMetricCard({
  icon,
  tint,
  title,
  value,
  sub,
  zero = false,
  muted = false,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  value: string;
  sub: string;
  zero?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="metric-card" style={muted ? { opacity: 0.82 } : undefined}>
      <div className="mc-icon" style={{ background: tint }}>{icon}</div>
      <div className="mc-title">{title}</div>
      <div className={`mc-num ${zero ? "zero" : ""}`} style={muted ? { fontSize: 15 } : undefined}>{value}</div>
      <div className="mc-sub">{sub}</div>
    </div>
  );
}
