import { useEffect, useState } from "react";
import type { TrialRow } from "../api";
import { EVIDENCE_STATE, toEvidenceState, type EvidenceState } from "../evidenceState";

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

  // Every cell resolves to one of the five canonical evidence states — never
  // collapsed. A reported female PERCENTAGE counts as reported (not "not located"),
  // and a wholly missing assertion is "absent", not "not reported".
  const cell = (t: any, dim: string): EvidenceState => {
    if (dim === "female_enrollment") {
      if ((t.female_n !== "" && t.female_n != null) || (t.female_pct !== "" && t.female_pct != null))
        return "reported";
      return toEvidenceState(t.female_n_basis);   // not_located / not_reported / absent preserved
    }
    return toEvidenceState(t[dim]);
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
                        const meta = EVIDENCE_STATE[cell(t, d.key)];
                        return (
                          <td key={d.key}>
                            <span className={`cell ${meta.tone}`} title={meta.help}>
                              {meta.glyph} {meta.label}
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
          <div>
            <strong>⊘ Evidence status unavailable</strong> — AMIRA holds no assertion for this
            dimension (absent). Distinct from "not reported".
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
