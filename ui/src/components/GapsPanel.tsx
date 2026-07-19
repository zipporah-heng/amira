import { type EvidenceGap, type EvidenceResponse } from "../api";

export function GapsPanel({ gaps, report }: { gaps: EvidenceGap[]; report: EvidenceResponse }) {
  return (
    <div className="card" id="gaps">
      <div className="section-title missing">What don't we know?</div>
      <ul className="rail-list missing" style={{ marginTop: 12 }}>
        {gaps.map((g) => (
          <li key={g.dimension}>
            <span className="ic x">•</span>
            <span><strong>{g.label}.</strong> {g.statement}</span>
          </li>
        ))}
        <li>
          <span className="ic x">•</span>
          <span><strong>Long-term fertility outcomes.</strong> Not assessed in the reviewed Phase 3 evidence.</span>
        </li>
        <li>
          <span className="ic x">•</span>
          <span><strong>Pregnancy.</strong> See additional clinical resources below.</span>
        </li>
      </ul>
      <p className="disclaimer" style={{ marginTop: 10 }}>
        Counts are bounded to the {report.trials.length} included trials (corpus v{report.dataset_version},
        cutoff {report.source_cutoff}). "Not reported" never means a medicine does not work or is unsafe.
      </p>
    </div>
  );
}
