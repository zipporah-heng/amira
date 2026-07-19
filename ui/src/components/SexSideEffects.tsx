import type { Finding, SafetyState } from "../api";

function SafetyFinding({ f, highlight }: { f: Finding; highlight: "sig" | "trend" | "neutral" }) {
  return (
    <div className={`safety-finding ${highlight}`}>
      <div className="sf-head">
        <span className="sf-event">{f.endpoint}</span>
        {highlight === "sig" && <span className="sf-tag sig">Significant difference</span>}
        {highlight === "trend" && <span className="sf-tag trend">Trend only · not statistically significant</span>}
        {highlight === "neutral" && <span className="sf-tag neutral">{f.scope.startsWith("class:") ? "Class-level" : "Context"}</span>}
      </div>
      {(f.female_rate || f.male_rate) && (
        <div className="sf-rates">
          <span>Women: <b>{f.female_rate || "—"}</b></span>
          <span>Men: <b>{f.male_rate || "—"}</b></span>
          {f.comparison_p != null && <span>p = {f.comparison_p}</span>}
        </div>
      )}
      <p className="fc-interp">{f.interpretation}</p>
      <blockquote className="passage">"{f.exact_passage}"</blockquote>
      <div className="fc-src">
        <a href={f.source.url} target="_blank" rel="noopener noreferrer">
          {f.source.pmid ? `PMID ${f.source.pmid}` : f.source.nct_id} ↗
        </a>
        <span className="hv">{f.human_verified ? "Human verified" : "Human review pending"}</span>
      </div>
    </div>
  );
}

export function SexSideEffects({ data }: { data: SafetyState }) {
  const nothing =
    data.significant_findings.length + data.trend_findings.length + data.other_findings.length === 0;

  return (
    <section id="safety" className="card hero-section">
      <div className="hero-head">
        <div>
          <div className="section-title">Sex-specific side effects</div>
          <h2 className="hero-state">{data.state}</h2>
          <p className="hero-headline">{data.headline}</p>
        </div>
        <div className="hero-count">
          {data.n_reporting} of {data.n_trials}
          <span>included trials reported adverse events separately by sex</span>
        </div>
      </div>

      {/* Significant findings first, visually highlighted */}
      {data.significant_findings.map((f) => (
        <SafetyFinding key={f.finding_id} f={f} highlight="sig" />
      ))}
      {/* Non-significant trends second, clearly labeled */}
      {data.trend_findings.map((f) => (
        <SafetyFinding key={f.finding_id} f={f} highlight="trend" />
      ))}
      {data.other_findings.map((f) => (
        <SafetyFinding key={f.finding_id} f={f} highlight="neutral" />
      ))}

      {nothing && (
        <p className="muted">
          No drug-specific, sex-stratified adverse-event analysis was located in the reviewed
          sources. This is an evidence gap, not a finding that side effects are the same in women.
        </p>
      )}

      <p className="disclaimer">{data.caveat}</p>
    </section>
  );
}
