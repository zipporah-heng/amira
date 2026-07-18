import type { Study } from "../types";
import { DemoBadge } from "./DemoBadge";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

export function SourceDrawer({ study, onClose }: { study: Study; onClose: () => void }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Study source detail">
        <div className="dr-head">
          <div>
            <div className="section-title">Study source</div>
            <h2 style={{ fontSize: 18, marginTop: 6, maxWidth: 420 }}>{study.title}</h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dr-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DemoBadge label="Evidence status: Demo data" />
            <span className="badge demo"><span className="dot" /> Human verified: No</span>
          </div>

          <div className="dr-meta">
            <Row k="Study ID" v={study.study_id} />
            <Row k="Source type" v={study.study_type} />
            <Row k="Publication year" v={study.year} />
            <Row k="Study design" v={study.study_type} />
            <Row k="Total participants" v={study.total_n.toLocaleString()} />
            <Row k="Female participants" v={study.female_n.toLocaleString()} />
            <Row k="Female %" v={`${study.female_pct}%`} />
            <Row k="Sex-specific outcomes" v={study.sex_specific_efficacy_reported.replace("_", " ")} />
            <Row k="Menopause" v={study.menopause_reported.replace("_", " ")} />
            <Row k="Hormone therapy" v={study.hormone_therapy_reported.replace("_", " ")} />
            <Row k="Confidence" v={`${Math.round(study.ai_confidence * 100)}% (demo)`} />
            <Row k="Human verified" v="No" />
          </div>

          <div className="passage">"{study.relevant_evidence_passage}"</div>

          <div style={{ marginTop: 16 }}>
            <div className="k" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)", fontWeight: 650 }}>
              Source URL
            </div>
            <a href={study.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5 }}>
              {study.source_url}
            </a>
            <p style={{ marginTop: 6, fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>
              Demo source pointer — no live document is attached in this prototype.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
