import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse } from "../api";

const DIMS = [
  { key: "female_enrollment", label: "Women counted" },
  { key: "sex_specific_efficacy_reported", label: "Sex outcomes" },
  { key: "menopause_status_reported", label: "Menopause" },
  { key: "hormone_therapy_reported", label: "Hormone therapy" },
  { key: "pregnancy_evidence_reported", label: "Pregnancy" },
];

export function ResearchMap() {
  const [report, setReport] = useState<EvidenceResponse | null>(null);

  useEffect(() => {
    checkEvidence({
      condition: "Cardiovascular disease prevention", medicine: "Rosuvastatin",
      life_stage: "not_specified", hormone_therapy: "any",
    }).then(setReport).catch(() => setReport(null));
  }, []);

  if (!report?.supported) return <p>Loading research map…</p>;

  const cell = (trialKey: string, dim: string) => {
    const t = report.trials.find((x) => x.trial_id === trialKey)!;
    if (dim === "female_enrollment") {
      return t.female_n != null ? "present" : t.female_pct != null ? "unclear" : "missing";
    }
    return (t as any)[dim] === "yes" ? "present" : "missing";
  };

  const gaps = report.dimensions.filter((d) => d.n_reporting === 0).map((d) => d.title);

  return (
    <div>
      <span className="eyebrow">Research Map</span>
      <h1 className="page-q">Where is women's hormonal evidence missing?</h1>
      <p className="page-sub">
        Coverage across the reviewed corpus for {report.query.medicine}. Scope is locked to the
        frozen corpus; additional medicines are added only after ingestion and verification.
      </p>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="section-title">Women's Evidence Coverage Matrix</div>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="row-h">Trial</th>
                {DIMS.map((d) => <th key={d.key}>{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.trials.map((t) => (
                <tr key={t.trial_id}>
                  <td className="rowlabel">
                    <a href={t.registry_url} target="_blank" rel="noopener noreferrer">
                      {t.display_name}
                    </a>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>{t.nct_id}</div>
                  </td>
                  {DIMS.map((d) => {
                    const state = cell(t.trial_id, d.key);
                    return (
                      <td key={d.key}>
                        <span className={`cell ${state}`}>
                          {state === "present" ? "● Present" : state === "unclear" ? "◐ Percentage only" : "○ Missing"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="section-title">Highest visible evidence gaps</div>
          <div className="gap-chips">
            {gaps.map((g) => <span className="gap-chip" key={g}>{g}</span>)}
          </div>
        </div>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
          Coverage is bounded to the reviewed corpus (v{report.dataset_version}, cutoff{" "}
          {report.source_cutoff}). "Missing" means not reported in the reviewed sources — never
          that a medicine does not work.
        </p>
      </div>

      <div className="callout" style={{ marginTop: 22 }}>
        This map shows evidence coverage, not clinical comparison. AMIRA does not rank medicines
        by effectiveness or safety.
      </div>
    </div>
  );
}
