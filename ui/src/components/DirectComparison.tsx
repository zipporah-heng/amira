import type { DirectComparison as DirectComparisonData } from "../api";

function OutcomeCard({ comparison, outcome }: {
  comparison: DirectComparisonData;
  outcome: DirectComparisonData["outcomes"][number];
}) {
  const isSafety = outcome.outcome_type === "safety";
  return (
    <div className={`direct-outcome ${isSafety ? "safety" : "effectiveness"}`}>
      <div className="direct-outcome-type">{isSafety ? "Side effects" : "Effectiveness"}</div>
      <h3>{outcome.endpoint}</h3>
      <div className="arm-values">
        <div>
          <span>{comparison.medicine}</span>
          <strong>{outcome.medicine_value}</strong>
        </div>
        <div className="versus">vs</div>
        <div>
          <span>{comparison.comparator}</span>
          <strong>{outcome.comparator_value}</strong>
        </div>
      </div>
      <div className="direct-test">
        <span>{outcome.comparison_test}</span>
        <strong>{outcome.comparison_p}</strong>
      </div>
      <p>{outcome.interpretation}</p>
    </div>
  );
}

export function DirectComparison({ data }: { data: DirectComparisonData }) {
  return (
    <section className="card direct-comparison" aria-labelledby={`comparison-${data.comparison_id}`}>
      <div className="direct-head">
        <div>
          <div className="section-title">Direct study comparison</div>
          <h2 id={`comparison-${data.comparison_id}`}>{data.population}</h2>
          <p>{data.headline}</p>
        </div>
        <span className="population-badge">Life stage reported</span>
      </div>

      <div className="direct-outcomes">
        {data.outcomes.map((outcome) => (
          <OutcomeCard key={`${outcome.outcome_type}-${outcome.endpoint}`} comparison={data} outcome={outcome} />
        ))}
      </div>

      <div className="direct-foot">
        <p><strong>Study context:</strong> {data.regimen_note}</p>
        <a href={data.source.url} target="_blank" rel="noopener noreferrer">
          Open primary source ↗
        </a>
      </div>
      <p className="comparison-boundary">
        {data.clinical_boundary}
      </p>
    </section>
  );
}
