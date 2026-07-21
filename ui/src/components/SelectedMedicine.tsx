import type { EvidenceResponse } from "../api";

/** Section 2 — Selected medicine. Every value comes from the API; nothing is
 *  hard-coded in React. */
export function SelectedMedicine({ report, onSources }: {
  report: EvidenceResponse;
  onSources: () => void;
}) {
  const b = report.banner!;
  const t = report.totals!;
  const studies = report.trials.length;
  const womenReported = t.women_reported_count;
  const womenCoverage = (t.trials_without_female_count_or_percentage?.length || 0) === 0;

  return (
    <section className="card selected-medicine" id="selected-medicine" style={{ marginTop: 22 }}>
      <div className="section-title">Selected medicine</div>
      <div className="sm-grid">
        <div className="sm-id">
          <div className="pill-icon" aria-hidden>💊</div>
          <div>
            <div className="med-name">{b.medicine}</div>
            <div className="med-brand">{b.drug_class}</div>
            <div className="med-facts">
              <span><span className="mf-k">Represented use:</span> {b.indication || "—"}</span>
              <span><span className="mf-k">Condition:</span> {report.query.condition}</span>
            </div>
          </div>
        </div>
        <div className="sm-stats">
          <div className="sm-stat">
            <div className="sm-num">{studies}</div>
            <div className="sm-lab">stud{studies === 1 ? "y" : "ies"} reviewed</div>
          </div>
          <div className="sm-stat">
            <div className="sm-num">{womenReported > 0 ? womenReported.toLocaleString() : "—"}</div>
            <div className="sm-lab">
              women explicitly reported
              {!womenCoverage && womenReported > 0 && (
                <span title="Exact count available for a subset of studies"> (subtotal)</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="sm-foot">
        <button className="linkbtn" onClick={onSources}>View original sources ↗</button>
        <span className="muted" style={{ fontSize: 12 }}>
          AMIRA reviews published research. It does not diagnose, prescribe, or recommend treatment.
        </span>
      </div>
    </section>
  );
}
