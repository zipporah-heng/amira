import { ResearchCoverageMatrix } from "../components/ResearchCoverageMatrix";
import { DemoBadge } from "../components/DemoBadge";

export function ResearchMap() {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow">Research Map</span>
        <DemoBadge />
      </div>
      <h1 className="page-q">Where is women's hormonal evidence missing?</h1>
      <p className="page-sub">
        A researcher-facing view of how completely a set of medicines reports women's and
        hormonal evidence, across the dimensions AMIRA tracks.
      </p>

      <ResearchCoverageMatrix />

      <div className="callout" style={{ marginTop: 22 }}>
        This map shows evidence coverage, not clinical comparison. AMIRA does not rank
        medicines by effectiveness or safety.
      </div>
    </div>
  );
}
