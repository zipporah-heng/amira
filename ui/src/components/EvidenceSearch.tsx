export interface Filters {
  condition: string;
  drugClass: string;
  medicine: string;
  lifeStage: string;
  hormoneTherapy: string;
}

export interface DrugClassCatalog {
  drug_class: string;
  medicines: string[];
}

/** The five agreed clinical life stages (+ an explicit default). Labels map to
 *  clean API tokens. Age is never used to infer any of these. */
export const LIFE_STAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Not specified", value: "not_specified" },
  { label: "Childhood / Prepubertal", value: "childhood_prepubertal" },
  { label: "Puberty / Adolescence", value: "puberty_adolescence" },
  { label: "Reproductive Years", value: "reproductive_years" },
  { label: "Perimenopause", value: "perimenopause" },
  { label: "Menopause / Postmenopause", value: "menopause_postmenopause" },
];

function Field({ label, icon, value, onChange, options }: {
  label: string; icon: string; value: string;
  onChange: (v: string) => void; options: { label: string; value: string }[];
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        <span className="field-icon" aria-hidden>{icon}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

const opt = (xs: string[]) => xs.map((x) => ({ label: x, value: x }));

export function EvidenceSearch({ filters, setFilters, onCheck, catalog }: {
  filters: Filters; setFilters: (f: Filters) => void; onCheck: () => void;
  catalog: DrugClassCatalog[];
}) {
  const classes = catalog.map((c) => c.drug_class);
  const medicinesForClass =
    catalog.find((c) => c.drug_class === filters.drugClass)?.medicines || [];

  const onClassChange = (drugClass: string) => {
    const meds = catalog.find((c) => c.drug_class === drugClass)?.medicines || [];
    // Keep the current medicine if it belongs to the new class, else pick the first.
    const medicine = meds.includes(filters.medicine) ? filters.medicine : (meds[0] || "");
    setFilters({ ...filters, drugClass, medicine });
  };

  return (
    <div className="card filter-card">
      <div className="filter-row">
        <Field label="Condition" icon="❤" value={filters.condition}
          onChange={(v) => setFilters({ ...filters, condition: v })}
          options={opt(["Cardiovascular disease prevention"])} />
        <Field label="Drug Class" icon="🧬" value={filters.drugClass}
          onChange={onClassChange}
          options={opt(classes.length ? classes : [filters.drugClass])} />
        <Field label="Medicine" icon="💊" value={filters.medicine}
          onChange={(v) => setFilters({ ...filters, medicine: v })}
          options={opt(medicinesForClass.length ? medicinesForClass : [filters.medicine])} />
        <Field label="Life Stage" icon="♀" value={filters.lifeStage}
          onChange={(v) => setFilters({ ...filters, lifeStage: v })}
          options={LIFE_STAGE_OPTIONS} />
        <Field label="Hormone Therapy" icon="🧴" value={filters.hormoneTherapy}
          onChange={(v) => setFilters({ ...filters, hormoneTherapy: v })}
          options={opt(["Any", "Yes", "No", "Not specified"])} />
        <button className="cta check-btn" onClick={onCheck}>Check Evidence</button>
      </div>
      <div className="safety-line" style={{ marginTop: 14 }}>
        <span>ℹ️</span> AMIRA reviews published research. It does not diagnose, prescribe, or
        recommend treatment. Only medicines with verified evidence in AMIRA are selectable.
      </div>
    </div>
  );
}
