import { DemoBadge } from "./DemoBadge";

export function EvidenceMetricCard({
  title,
  value,
  sub,
  zero = false,
}: {
  title: string;
  value: string;
  sub: string;
  zero?: boolean;
}) {
  return (
    <div className="metric-card">
      <div className="mc-title">{title}</div>
      <div className={`mc-num ${zero ? "zero" : ""}`}>{value}</div>
      <div className="mc-sub">{sub}</div>
      <DemoBadge />
    </div>
  );
}
