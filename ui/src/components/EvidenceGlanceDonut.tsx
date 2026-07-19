import { studyTypeBuckets, type EvidenceResponse } from "../api";

export function EvidenceGlanceDonut({ report }: { report: EvidenceResponse }) {
  const buckets = studyTypeBuckets(report.trials);
  const total = report.trials.length;
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segments = buckets.map((t) => {
    const frac = total ? t.count / total : 0;
    const seg = { ...t, dash: frac * C, offset };
    offset += frac * C;
    return seg;
  });

  return (
    <div className="rail-card">
      <h3 className="rail-title">Evidence at a glance</h3>
      <div className="donut-wrap">
        <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`${total} studies reviewed`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
          {segments.map((s) => (
            <circle key={s.type} cx="70" cy="70" r={R} fill="none" stroke={s.color}
              strokeWidth="16" strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={-s.offset} transform="rotate(-90 70 70)" />
          ))}
          <text x="70" y="66" textAnchor="middle" className="donut-num">{total}</text>
          <text x="70" y="84" textAnchor="middle" className="donut-lab">Studies</text>
          <text x="70" y="97" textAnchor="middle" className="donut-lab">reviewed</text>
        </svg>
        <div className="donut-legend">
          {buckets.map((t) => (
            <div className="legend-row" key={t.type}>
              <span className="legend-dot" style={{ background: t.color }} />
              <span className="legend-lab">{t.type}</span>
              <span className="legend-val">{t.count}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 10 }}>
        Frozen corpus: {report.trials.map((t) => t.nct_id).join(", ")}
      </p>
    </div>
  );
}
