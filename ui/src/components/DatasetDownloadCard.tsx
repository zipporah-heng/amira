import { datasetCsv, datasetJsonl, downloadText, schemaJson } from "../download";
import { fixture } from "../fixture";
import { DemoBadge } from "./DemoBadge";

const SCHEMA_COLUMNS = [
  "study_id", "medicine", "condition", "study_type", "total_n", "female_n", "female_pct",
  "sex_specific_efficacy_reported", "sex_specific_safety_reported", "menopause_reported",
  "perimenopause_reported", "postmenopause_reported", "hormone_therapy_reported",
  "pregnancy_reported", "relevant_evidence_passage", "source", "source_url",
  "ai_confidence", "human_verified",
];

export function DatasetDownloadCard() {
  return (
    <div className="dl-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3>The Dataset</h3>
        <DemoBadge />
      </div>
      <p>
        The AMIRA dataset standardizes study-level evidence into a common schema across{" "}
        {fixture.dataset_summary.hormonal_evidence_dimensions} hormonal and sex evidence
        dimensions. Downloads are generated from the same deterministic sample data shown in
        the app.
      </p>
      <div className="code-cols">
        {SCHEMA_COLUMNS.map((c) => (
          <span className="code-col" key={c}>{c}</span>
        ))}
      </div>
      <div className="dl-btns">
        <button className="dl-btn" onClick={() => downloadText("amira_evidence_dataset.csv", datasetCsv(), "text/csv")}>
          ⬇ Download CSV
        </button>
        <button className="dl-btn" onClick={() => downloadText("amira_evidence_dataset.jsonl", datasetJsonl(), "application/x-ndjson")}>
          ⬇ Download JSONL
        </button>
        <button className="dl-btn ghost" onClick={() => downloadText("amira_evidence_schema.json", schemaJson(), "application/json")}>
          ⬇ Schema
        </button>
      </div>
    </div>
  );
}
