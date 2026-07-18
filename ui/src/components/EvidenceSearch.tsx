import { DemoBadge } from "./DemoBadge";

export interface Filters {
  condition: string;
  medicine: string;
  lifeStage: string;
  hormoneTherapy: string;
}

export function EvidenceSearch({
  filters,
  setFilters,
  onCheck,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onCheck: () => void;
}) {
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">Check the evidence</div>
        <DemoBadge />
      </div>
      <div className="filters">
        <div className="field">
          <label>Condition</label>
          <select value={filters.condition} onChange={set("condition")} aria-label="Condition">
            <option>Heart Disease</option>
          </select>
        </div>
        <div className="field">
          <label>Medicine</label>
          <select value={filters.medicine} onChange={set("medicine")} aria-label="Medicine">
            <option>Atorvastatin</option>
            <option>Rosuvastatin</option>
            <option>Pravastatin</option>
          </select>
        </div>
        <div className="field">
          <label>Life Stage</label>
          <select value={filters.lifeStage} onChange={set("lifeStage")} aria-label="Life Stage">
            <option>Premenopause</option>
            <option>Perimenopause</option>
            <option>Postmenopause</option>
            <option>Not specified</option>
          </select>
        </div>
        <div className="field">
          <label>Hormone Therapy</label>
          <select value={filters.hormoneTherapy} onChange={set("hormoneTherapy")} aria-label="Hormone Therapy">
            <option>Any</option>
            <option>Yes</option>
            <option>No</option>
            <option>Not specified</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="cta" onClick={onCheck}>
          CHECK THE EVIDENCE
        </button>
        <span className="safety-line">
          <span>ℹ️</span> AMIRA reviews published research evidence. It does not diagnose,
          prescribe, or recommend treatment.
        </span>
      </div>
    </div>
  );
}
