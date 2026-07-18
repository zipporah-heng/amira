export interface Filters {
  condition: string;
  medicine: string;
  lifeStage: string;
  hormoneTherapy: string;
}

function Field({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        <span className="field-icon" aria-hidden>{icon}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
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
  return (
    <div className="card filter-card">
      <div className="filter-row">
        <Field
          label="Condition" icon="❤" value={filters.condition}
          onChange={(v) => setFilters({ ...filters, condition: v })}
          options={["Heart Disease"]}
        />
        <Field
          label="Medicine" icon="💊" value={filters.medicine}
          onChange={(v) => setFilters({ ...filters, medicine: v })}
          options={["Atorvastatin (Lipitor)", "Rosuvastatin (Crestor)", "Pravastatin (Pravachol)"]}
        />
        <Field
          label="Life Stage" icon="♀" value={filters.lifeStage}
          onChange={(v) => setFilters({ ...filters, lifeStage: v })}
          options={["Premenopause", "Perimenopause", "Postmenopause", "Not specified"]}
        />
        <Field
          label="Hormone Therapy" icon="🧴" value={filters.hormoneTherapy}
          onChange={(v) => setFilters({ ...filters, hormoneTherapy: v })}
          options={["Any", "Yes", "No", "Not specified"]}
        />
        <button className="cta check-btn" onClick={onCheck}>Check Evidence</button>
      </div>
      <div className="safety-line" style={{ marginTop: 14 }}>
        <span>ℹ️</span> AMIRA reviews published research. It does not diagnose, prescribe, or
        recommend treatment.
      </div>
    </div>
  );
}
