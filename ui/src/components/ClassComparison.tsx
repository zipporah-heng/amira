import type { ClassComparison as CC } from "../api";

function conciseState(value: string): string {
  return value
    .replace("Sex-specific analysis reported, statistical comparison unclear", "Analysis by sex reported; comparison unclear")
    .replace("No statistically significant sex difference identified", "No significant sex difference identified")
    .replace("Insufficient sex-specific safety evidence", "Insufficient evidence by sex")
    .replace("Insufficient sex-specific evidence", "Insufficient evidence by sex")
    .replace("Reported by sex, no formal between-sex comparison", "Reported by sex; no formal comparison");
}

export function ClassComparison({ data, current }: { data: CC; current: string }) {
  return (
    <section id="class" className="card class-comparison">
      <div className="class-head">
        <div>
          <div className="section-title">Compare women's evidence within {data.drug_class}</div>
          <h2>Which evidence questions have been answered?</h2>
          <p>{data.ranking.summary}</p>
        </div>
        <span className="depth-only">Evidence depth only</span>
      </div>

      <div className="comparison-list" role="table" aria-label={`${data.drug_class} women's evidence comparison`}>
        <div className="comparison-row comparison-labels" role="row">
          <div role="columnheader">Medicine</div>
          <div role="columnheader">Evidence maturity</div>
          <div role="columnheader">Evidence reported by sex</div>
          <div role="columnheader">Main gap</div>
        </div>
        {data.rows.map((r) => {
          const isCurrent = r.medicine.toLowerCase() === current.toLowerCase();
          return (
            <div key={r.medicine} className={`comparison-row ${isCurrent ? "row-current" : ""}`} role="row">
              <div className="comparison-medicine" role="cell">
                <div className="td-name">
                  {r.medicine}
                  {isCurrent && <span className="you">Viewing</span>}
                </div>
                <span>{r.n_trials} reviewed {r.n_trials === 1 ? "study" : "studies"}</span>
              </div>
              <div className="comparison-maturity" role="cell">
                {r.maturity_scorable ? (
                  <>
                    <span className="mat-pill">{r.maturity_display}</span>
                    <strong>{r.maturity_label}</strong>
                  </>
                ) : (
                  <>
                    <span className="mat-pill unscored">Not established</span>
                    <span>Not ranked</span>
                  </>
                )}
              </div>
              <div className="comparison-evidence" role="cell">
                <div><span>Effectiveness</span><strong>{conciseState(r.effectiveness_state)}</strong></div>
                <div><span>Side effects</span><strong>{conciseState(r.safety_state)}</strong></div>
              </div>
              <div className="comparison-gap" role="cell">
                <span className="gap-dot" aria-hidden="true" />
                <strong>{r.key_gap}</strong>
              </div>
            </div>
          );
        })}
      </div>

      {data.class_level_findings.length > 0 && (
        <div className="class-note">
          <strong>Class-level evidence:</strong>{" "}
          {data.class_level_findings.map((f) => (
            <span key={f.finding_id}>
              {f.interpretation}{" "}
              <a href={f.source.url} target="_blank" rel="noopener noreferrer">
                {f.source.pmid ? `PMID ${f.source.pmid}` : "source"} ↗
              </a>{" "}
            </span>
          ))}
        </div>
      )}

      <p className="comparison-boundary">
        Stronger women-specific evidence does not mean greater effectiveness. AMIRA compares
        evidence maturity, not which medicine should be prescribed.
      </p>
    </section>
  );
}
