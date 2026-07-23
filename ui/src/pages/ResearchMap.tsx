import { Fragment, useEffect, useState } from "react";
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
  health_area?: string | null;
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

  // Every cell resolves to one of the canonical evidence states — never collapsed.
  // When a numeric female count/percentage exists, the state comes from its OWN
  // basis: a reported percentage stays Reported, but a DERIVED percentage renders
  // Derived (not automatically "Reported" just because a number is present).
  const cell = (t: any, dim: string): EvidenceState => {
    if (dim === "female_enrollment") {
      if (t.female_n !== "" && t.female_n != null)
        return toEvidenceState(t.female_n_basis);      // reported / derived per its basis
      if (t.female_pct !== "" && t.female_pct != null)
        return toEvidenceState(t.female_pct_basis);    // reported OR derived percentage
      return toEvidenceState(t.female_n_basis);         // not_located / not_reported / absent / conflict / unverified
    }
    return toEvidenceState(t[dim]);
  };

  // Group HEALTH AREA -> CONDITION -> TRIAL. Only verified, ingested trials appear
  // here (drug class + medicine stay as secondary per-row metadata). New health
  // areas with no ingested trials do not appear on the map until a trial is verified.
  const HEALTH_AREA_ORDER = ["Cardiovascular", "Metabolic Health", "Bone Health",
    "Hormone-related Cancer", "Neurology", "Neurodevelopmental Health"];
  const CONDITION_ORDER = ["Cardiovascular disease prevention", "Heart failure", "Hypertension"];
  const byArea: Record<string, Record<string, TrialWithMeta[]>> = {};
  for (const t of trials) {
    const ha = t.health_area || "Other";
    ((byArea[ha] ||= {})[t.condition] ||= []).push(t);
  }
  const areas = Object.keys(byArea).sort((a, b) => {
    const ia = HEALTH_AREA_ORDER.indexOf(a), ib = HEALTH_AREA_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const conditionsIn = (ha: string) => Object.keys(byArea[ha]).sort((a, b) => {
    const ia = CONDITION_ORDER.indexOf(a), ib = CONDITION_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  return (
    <div>
      <span className="eyebrow">Research Map</span>
      <h1 className="page-q">Where is women's evidence present or missing?</h1>
      <p className="page-sub">
        Coverage across every verified trial in AMIRA, grouped by health area and clinical
        condition. Each row links to the real trial record and notes its drug class and medicine.
        Additional health areas and medicines are added only after ingestion and verification.
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
              {areas.map((area) => (
                <Fragment key={area}>
                  <tr>
                    <td colSpan={DIMS.length + 1} style={{
                      background: "var(--lav-50)", fontWeight: 800, fontSize: 12.5,
                      textTransform: "uppercase", letterSpacing: ".05em", color: "var(--lav-700)",
                    }}>{area}</td>
                  </tr>
                  {conditionsIn(area).map((condition) => (
                    <Fragment key={area + "|" + condition}>
                      <tr>
                        <td colSpan={DIMS.length + 1} style={{
                          background: "var(--surface-2)", fontWeight: 700, fontSize: 12,
                          letterSpacing: ".02em", color: "var(--ink-3)", paddingLeft: 18,
                        }}>{condition}</td>
                      </tr>
                      {byArea[area][condition].map((t) => (
                        <tr key={t.trial_id}>
                          <td className="rowlabel">
                            <a href={t.registry_url} target="_blank" rel="noopener noreferrer">
                              {t.display_name} — {t.medicine}
                            </a>
                            <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>{t.drug_class} · {t.nct_id}</div>
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
                    </Fragment>
                  ))}
                </Fragment>
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
