import type { EffectivenessState, Finding } from "../api";

function FindingCard({ f }: { f: Finding }) {
  const classLevel = f.scope.startsWith("class:");
  const womenOnly = f.population_scope === "women_only_life_stage";
  return (
    <div className="finding-card">
      <div className="fc-head">
        <span className="fc-endpoint">{f.endpoint}</span>
        <span className={`fc-scope ${classLevel ? "class" : "trial"}`}>
          {classLevel ? "Class-level" : f.scope.replace("trial:", "")}
        </span>
      </div>
      {(f.female_estimate || f.male_estimate) && (
        <div className="fc-estimates">
          <div className="est"><span className="est-k">Women</span>
            <span className="est-v">{f.female_estimate || "—"}</span>
            <span className="est-ci">{f.female_ci}</span></div>
          {!womenOnly && (
            <div className="est"><span className="est-k">Men</span>
              <span className="est-v">{f.male_estimate || "—"}</span>
              <span className="est-ci">{f.male_ci}</span></div>
          )}
        </div>
      )}
      <div className="fc-test">
        {womenOnly ? (
          <span className="test-badge neutral">Women-only study; no between-sex test</span>
        ) : f.comparison_p != null ? (
          <span className="test-badge ok">
            {classLevel ? "Class-level" : "Drug-specific"} sex comparison p = {f.comparison_p}
          </span>
        ) : (
          <span className="test-badge neutral">No formal drug-specific interaction test located</span>
        )}
        {f.comparison_test && <span className="test-note">{f.comparison_test}</span>}
      </div>
      <p className="fc-interp">{f.interpretation}</p>
      <blockquote className="passage">"{f.exact_passage}"</blockquote>
      <div className="fc-src">
        <a href={f.source.url} target="_blank" rel="noopener noreferrer">
          {f.source.pmid ? `PMID ${f.source.pmid}` : f.source.nct_id} — {f.source.title.slice(0, 60)}… ↗
        </a>
        <span className="hv">{f.human_verified ? "Human verified" : "Human review pending"}</span>
      </div>
    </div>
  );
}

export function SexEffectiveness({ data }: { data: EffectivenessState }) {
  return (
    <section id="effectiveness" className="card hero-section">
      <div className="hero-head">
        <div>
          <div className="section-title">Sex-specific effectiveness</div>
          <h2 className="hero-state">{data.state}</h2>
          <p className="hero-headline">{data.headline}</p>
        </div>
        <div className="hero-count">
          {data.n_reporting} of {data.n_trials}
          <span>included trials reported outcomes for women or an analysis by sex</span>
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 6, fontSize: 11, fontWeight: 800,
        letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        Drug-specific evidence
      </div>
      {data.findings.length > 0 ? (
        <div className="findings-grid">
          {data.findings.map((f) => <FindingCard key={f.finding_id} f={f} />)}
        </div>
      ) : (
        <p className="muted">
          No drug-specific sex-specific effectiveness finding was located in the reviewed sources.
        </p>
      )}

      {data.class_level_findings && data.class_level_findings.length > 0 && (
        <>
          <div style={{ marginTop: 22, marginBottom: 6, fontSize: 11, fontWeight: 800,
            letterSpacing: ".06em", textTransform: "uppercase", color: "var(--lav-700)" }}>
            Class-level evidence
          </div>
          {data.class_level_note && <p className="muted" style={{ marginBottom: 10 }}>{data.class_level_note}</p>}
          <div className="findings-grid">
            {data.class_level_findings.map((f) => <FindingCard key={f.finding_id} f={f} />)}
          </div>
        </>
      )}

      <p className="disclaimer">{data.caveat}</p>
    </section>
  );
}
