import type { Source } from "./api";
import { citationLine, provenanceBadge, sourceTypeLabel } from "./labels";

export function SourceDrawer({
  title,
  subtitle,
  sources,
  onClose,
}: {
  title: string;
  subtitle?: string;
  sources: Source[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Source detail">
        <div className="dr-head">
          <div>
            <div className="section-title">Studies behind this result</div>
            <h2 style={{ fontSize: 18, marginTop: 6 }}>{title}</h2>
            {subtitle && (
              <p style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</p>
            )}
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dr-body">
          {sources.length === 0 && (
            <p>No sources were attached to this result.</p>
          )}
          {sources.map((s) => {
            const prov = provenanceBadge(s.provenance);
            return (
              <div className="src-item" key={s.source_id}>
                <div className="st">{s.source_title}</div>
                <div className="src-meta">
                  <span>{sourceTypeLabel(s.source_type)}</span>
                  {s.study_design && <span>{s.study_design}</span>}
                  {s.nct_id && <span>{s.nct_id}</span>}
                  {citationLine(s) && <span>{citationLine(s)}</span>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <span className={`badge ${prov.cls}`}>
                    <span className="dot" /> {prov.label}
                  </span>
                  {s.human_verified && (
                    <span className="badge human">
                      <span className="dot" /> Human verified
                    </span>
                  )}
                </div>

                {(s.total_n != null || s.female_n != null || s.female_pct != null) && (
                  <div className="src-meta" style={{ marginTop: 10 }}>
                    {s.total_n != null && <span>Total N: {s.total_n.toLocaleString()}</span>}
                    {s.female_n != null && <span>Female N: {s.female_n.toLocaleString()}</span>}
                    {s.female_pct != null && <span>Female: {s.female_pct}%</span>}
                  </div>
                )}

                <div className="passage">"{s.relevant_passage}"</div>

                {s.classification_rationale && (
                  <div className="rationale">
                    <strong>Why AMIRA classified this: </strong>
                    {s.classification_rationale}
                  </div>
                )}

                {s.ai_confidence != null && (
                  <div className="meterline">
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>AI confidence</span>
                    <span className="meter">
                      <span style={{ width: `${Math.round(s.ai_confidence * 100)}%` }} />
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {Math.round(s.ai_confidence * 100)}%
                    </span>
                  </div>
                )}

                {s.url && (
                  <div style={{ marginTop: 12 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      View source ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
