import { useEffect, useState } from "react";
import type { TrialRow } from "../api";

const DIMS = [
  { key: "female_enrollment", label: "Women counted" },
  { key: "sex_specific_efficacy_reported", label: "Sex outcomes" },
  { key: "sex_specific_safety_reported", label: "Sex-specific safety" },
  { key: "menopause_status_reported", label: "Menopause" },
  { key: "hormone_therapy_reported", label: "Hormone therapy" },
  { key: "pregnancy_evidence_reported", label: "Pregnancy" },
];

interface TrialWithMeta extends TrialRow {
  medicine: string;
  drug_class: string;
  condition: string;
}

export function ResearchMap() {
  const [trials, setTrials] = useState<TrialWithMeta[]>([]);
  const [meta, setMeta] = useState<{ v?: string; cutoff?: string }>({});

  useEffect(() => {
    fetch("/api/trials")
      .then((r) => r.json())
      .then((d) => { setTrials(d.trials || []); setMeta({ v: d.dataset_version, cutoff: d.source_cutoff }); })
      .catch(() => setTrials([]));
  }, []);

  if (!trials.length) return <p>Loading research map…</p>;

  // Evidence states are kept distinct and are never collapsed:
  //   present      - reported in the reviewed sources
  //   unclear      - not_located: AMIRA did not locate sufficient evidence
  //   missing      - not_reported: a reviewed source was checked and does not report it
  const cell = (t: any, dim: string) => {
    if (dim === "female_enrollment") {
      if (t.female_n !== "" && t.female_n != null) return "present";
      if (t.female_pct !== "" && t.female_pct != null) return "unclear";
      return t.female_n_basis === "not_located" ? "unclear" : "missing";
    }
    if (t[dim] === "yes") return "present";
    if (t[dim] === "not_located") return "unclear";
    return "missing";
  };

  // Group by condition -> drug class for readability across classes.
  const byGroup: Record<string, TrialWithMeta[]> = {};
  for (const t of trials) {
    const k = `${t.condition} · ${t.drug_class}`;
    (byGroup[k] ||= []).push(t);
  }

  return (
    <div>
      <span className="eyebrow">Research Map</span>
      <h1 className="page-q">Where is women's evidence present or missing?</h1>
      <p className="page-sub">
        Coverage across every verified trial in AMIRA, grouped by condition and drug class.
        Each row links to the real trial record. Additional medicines are added only after
        ingestion and verification.
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
              {Object.entries(byGroup).map(([group, rows]) => (
                <>
                  <tr key={group}>
                    <td colSpan={DIMS.length + 1} style={{
                      background: "var(--surface-2)", fontWeight: 700, fontSize: 12,
                      textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ink-3)",
                    }}>{group}</td>
                  </tr>
                  {rows.map((t) => (
                    <tr key={t.trial_id}>
                      <td className="rowlabel">
                        <a href={t.registry_url} target="_blank" rel="noopener noreferrer">
                          {t.display_name} — {t.medicine}
                        </a>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>{t.nct_id}</div>
                      </td>
                      {DIMS.map((d) => {
                        const state = cell(t, d.key);
                        return (
                          <td key={d.key}>
                            <span className={`cell ${state}`} title={
                              state === "present" ? "Reported in the reviewed sources"
                                : state === "unclear"
                                  ? "AMIRA did not locate sufficient evidence in the reviewed sources."
                                  : "A reviewed source was checked and does not report this."}>
                              {state === "present" ? "● Present"
                                : state === "unclear" ? "◐ Unclear / not located"
                                : "○ Not reported"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
          <div><strong>● Present</strong> — reported in the reviewed sources.</div>
          <div>
            <strong>◐ Unclear / not located</strong> — AMIRA did not locate sufficient evidence in
            the reviewed sources. This reflects incomplete source coverage, not confirmed absence.
          </div>
          <div>
            <strong>○ Not reported</strong> — a reviewed source was checked and does not report it.
          </div>
          <p style={{ marginTop: 8, fontStyle: "italic" }}>
            Coverage is bounded to the reviewed corpus (v{meta.v}, cutoff {meta.cutoff}). These are
            distinct evidence states and are never collapsed. None of them means a medicine does
            not work — that would be a finding of no effect, which AMIRA reports separately.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 22 }}>
        This map shows evidence coverage, not clinical comparison. AMIRA does not rank medicines
        by effectiveness or safety.
      </div>
    </div>
  );
}
