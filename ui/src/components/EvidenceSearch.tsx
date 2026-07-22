export interface Filters {
  condition: string;
  drugClass: string;
  medicine: string;
  lifeStage: string;
  hormoneTherapy: string;
}

export interface ClassEntry {
  drug_class: string;
  medicines: string[];
  // Medicines known to AMIRA whose evidence review is incomplete (unscored). They
  // are selectable with a CLEAN name; their incomplete status is shown separately
  // in the result (never appended to the medicine name).
  incomplete_medicines?: string[];
}

export interface ConditionEntry {
  condition: string;
  drug_classes: ClassEntry[];
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
  catalog: ConditionEntry[];
}) {
  const conditions = catalog.map((c) => c.condition);
  const classesForCondition =
    catalog.find((c) => c.condition === filters.condition)?.drug_classes || [];
  const classNames = classesForCondition.map((c) => c.drug_class);

  // Medicine options for a class = verified medicines followed by incomplete-review
  // medicines. EVERY option shows a CLEAN name (label == value == plain medicine
  // name); the incomplete status is surfaced separately in the result, never in the
  // option label or the selected field.
  const medicineOptions = (cls: ClassEntry | undefined) => {
    const names = [...(cls?.medicines || []), ...(cls?.incomplete_medicines || [])];
    return names.map((m) => ({ label: m, value: m }));
  };
  // Prefer a verified medicine as the default; fall back to an incomplete one only
  // when a class has no verified medicine.
  const firstMedicine = (cls: ClassEntry | undefined) =>
    cls?.medicines?.[0] || cls?.incomplete_medicines?.[0] || "";

  const currentClass = classesForCondition.find((c) => c.drug_class === filters.drugClass);
  const medOpts = medicineOptions(currentClass);

  // Cascade: changing condition resets class + medicine to that condition's first valid pair.
  const onConditionChange = (condition: string) => {
    const classes = catalog.find((c) => c.condition === condition)?.drug_classes || [];
    setFilters({ ...filters, condition, drugClass: classes[0]?.drug_class || "", medicine: firstMedicine(classes[0]) });
  };
  const onClassChange = (drugClass: string) => {
    const cls = classesForCondition.find((c) => c.drug_class === drugClass);
    const values = medicineOptions(cls).map((o) => o.value);
    const medicine = values.includes(filters.medicine) ? filters.medicine : firstMedicine(cls);
    setFilters({ ...filters, drugClass, medicine });
  };

  return (
    <div className="card filter-card">
      <div className="filter-row">
        <Field label="Condition" icon="❤" value={filters.condition}
          onChange={onConditionChange}
          options={opt(conditions.length ? conditions : [filters.condition])} />
        <Field label="Drug Class" icon="🧬" value={filters.drugClass}
          onChange={onClassChange}
          options={opt(classNames.length ? classNames : [filters.drugClass])} />
        <Field label="Medicine" icon="💊" value={filters.medicine}
          onChange={(v) => setFilters({ ...filters, medicine: v })}
          options={medOpts.length ? medOpts : [{ label: filters.medicine, value: filters.medicine }]} />
        <Field label="Life Stage" icon="♀" value={filters.lifeStage}
          onChange={(v) => setFilters({ ...filters, lifeStage: v })}
          options={LIFE_STAGE_OPTIONS} />
        <Field label="Hormone Therapy" icon="🧴" value={filters.hormoneTherapy}
          onChange={(v) => setFilters({ ...filters, hormoneTherapy: v })}
          options={opt(["Any", "Yes", "No", "Not specified"])} />
        <button className="cta check-btn" onClick={onCheck}>Check Evidence</button>
      </div>
      <div className="safety-line" style={{ marginTop: 14 }}>
        <span>ℹ️</span> AMIRA reviews published research. Medicines with completed evidence review
        and medicines with an explicitly incomplete evidence review may appear here. Incomplete
        evidence is clearly labelled and is not scored. It does not diagnose, prescribe, or
        recommend treatment.
      </div>
    </div>
  );
}
