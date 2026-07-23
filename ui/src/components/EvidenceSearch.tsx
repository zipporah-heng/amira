export interface Filters {
  healthArea: string;
  condition: string;
  drugClass: string;
  medicine: string;
  lifeStage: string;
  hormonalContext: string;
}

export interface MedicineEntry {
  medicine: string;
  // "verified" = completed, integrity-checked ingestion; "incomplete" = registered
  // but DISCOVERED / evidence review incomplete (unscored, unranked).
  status: "verified" | "incomplete";
}
export interface ClassEntry {
  drug_class: string;
  medicines: MedicineEntry[];
}
export interface ConditionEntry {
  condition: string;
  drug_classes: ClassEntry[];
}
export interface HealthAreaEntry {
  health_area: string;
  conditions: ConditionEntry[];
}

/** Scalable clinical life-stage vocabulary (+ explicit default). Age is NEVER used
 *  to infer any of these — only an explicit evidence report can support a stage. */
export const LIFE_STAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Not specified", value: "not_specified" },
  { label: "Childhood / Prepubertal", value: "childhood_prepubertal" },
  { label: "Puberty / Adolescence", value: "puberty_adolescence" },
  { label: "Reproductive Years", value: "reproductive_years" },
  { label: "Perimenopause", value: "perimenopause" },
  { label: "Menopause / Postmenopause", value: "menopause_postmenopause" },
  { label: "Older Adult", value: "older_adult" },
];

/** Hormonal Context adapts to the selected life stage. Only contexts that are
 *  meaningful for the stage are exposed; pediatric stages never surface menopause
 *  or hormone-therapy options. These are selector contexts — AMIRA still only
 *  reports what the source evidence actually states. */
export function hormonalContextOptions(lifeStage: string): string[] {
  switch (lifeStage) {
    case "childhood_prepubertal":
    case "puberty_adolescence":
      return ["Any", "Pubertal status", "Not reported", "Not applicable"];
    case "reproductive_years":
      return ["Any", "Pregnancy", "Contraceptive use", "Not reported"];
    case "perimenopause":
    case "menopause_postmenopause":
      return ["Any", "Menopause status", "Using menopausal hormone therapy",
              "Not using menopausal hormone therapy", "Not reported"];
    case "older_adult":
      return ["Any", "Menopause status", "Menopausal hormone therapy", "Not reported"];
    default:
      return ["Any", "Not specified"];
  }
}

/** Map a Hormonal Context selection to the API's hormone-therapy token. Only the
 *  explicit menopausal-hormone-therapy use/non-use choices map to yes/no; every
 *  other context is not a binary HRT-use filter, so it maps to any/not_specified. */
export function hormonalContextToApi(ctx: string): string {
  if (ctx === "Using menopausal hormone therapy") return "yes";
  if (ctx === "Not using menopausal hormone therapy") return "no";
  if (ctx === "Any") return "any";
  return "not_specified";
}

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
  catalog: HealthAreaEntry[];
}) {
  const healthAreas = catalog.map((h) => h.health_area);
  const conditionsFor = (ha: string) => catalog.find((h) => h.health_area === ha)?.conditions || [];
  const classesFor = (ha: string, cond: string) =>
    conditionsFor(ha).find((c) => c.condition === cond)?.drug_classes || [];
  const medsFor = (ha: string, cond: string, cls: string) =>
    classesFor(ha, cond).find((c) => c.drug_class === cls)?.medicines || [];

  // Prefer a VERIFIED medicine as the default; fall back to an incomplete one.
  const firstMedicine = (meds: MedicineEntry[]) =>
    meds.find((m) => m.status === "verified")?.medicine || meds[0]?.medicine || "";

  const conditions = conditionsFor(filters.healthArea).map((c) => c.condition);
  const classNames = classesFor(filters.healthArea, filters.condition).map((c) => c.drug_class);
  const medEntries = medsFor(filters.healthArea, filters.condition, filters.drugClass);
  // Clean medicine names only — incomplete status is surfaced in the result, never here.
  const medOpts = medEntries.map((m) => ({ label: m.medicine, value: m.medicine }));

  const onHealthAreaChange = (healthArea: string) => {
    const cond = conditionsFor(healthArea)[0];
    const cls = cond?.drug_classes[0];
    setFilters({
      ...filters, healthArea,
      condition: cond?.condition || "",
      drugClass: cls?.drug_class || "",
      medicine: firstMedicine(cls?.medicines || []),
    });
  };
  const onConditionChange = (condition: string) => {
    const cls = classesFor(filters.healthArea, condition)[0];
    setFilters({
      ...filters, condition,
      drugClass: cls?.drug_class || "",
      medicine: firstMedicine(cls?.medicines || []),
    });
  };
  const onClassChange = (drugClass: string) => {
    const meds = medsFor(filters.healthArea, filters.condition, drugClass);
    const medicine = meds.some((m) => m.medicine === filters.medicine) ? filters.medicine : firstMedicine(meds);
    setFilters({ ...filters, drugClass, medicine });
  };
  const onLifeStageChange = (lifeStage: string) => {
    // Reset hormonal context to a valid option for the new life stage.
    const ctxs = hormonalContextOptions(lifeStage);
    const hormonalContext = ctxs.includes(filters.hormonalContext) ? filters.hormonalContext : ctxs[0];
    setFilters({ ...filters, lifeStage, hormonalContext });
  };

  const hormonalOpts = hormonalContextOptions(filters.lifeStage);

  return (
    <div className="card filter-card">
      <div className="filter-row">
        <Field label="Health Area" icon="🩺" value={filters.healthArea}
          onChange={onHealthAreaChange}
          options={opt(healthAreas.length ? healthAreas : [filters.healthArea])} />
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
          onChange={onLifeStageChange}
          options={LIFE_STAGE_OPTIONS} />
        <Field label="Hormonal Context" icon="🧴" value={filters.hormonalContext}
          onChange={(v) => setFilters({ ...filters, hormonalContext: v })}
          options={opt(hormonalOpts)} />
        <button className="cta check-btn" onClick={onCheck}>Check Evidence</button>
      </div>
      <div className="safety-line" style={{ marginTop: 14 }}>
        <span>ℹ️</span> AMIRA reviews published research across multiple health areas. Medicines with
        completed evidence review and medicines with an explicitly incomplete evidence review may
        appear here. Incomplete evidence is clearly labelled and is not scored. It does not diagnose,
        prescribe, or recommend treatment.
      </div>
    </div>
  );
}
