import type { EvidenceResponse } from "../api";

/** Compact Check Evidence additions (progressive disclosure, no dense dashboard):
 *  - EvidenceScope: what AMIRA actually reviewed — bounded, never a global
 *    completeness claim, numbers only from the real report.
 *  - WhatRemainsUnknown: canonical evidence-state gaps.
 *
 *  NOTE: the medicine's headline signal (badges, statistics, cautions, exact passage
 *  and "Why does this matter?") lives in a single place — the "What should I notice?"
 *  card (see WhatToNotice). There is no separate standalone signal panel here. */

export function EvidenceScope({ report }: { report: EvidenceResponse }) {
  const ss = report.study_selection;
  const eff = report.effectiveness?.findings?.length || 0;
  const saf = (report.safety?.significant_findings?.length || 0)
    + (report.safety?.trend_findings?.length || 0) + (report.safety?.other_findings?.length || 0);
  const sexFindings = eff + saf;
  const humanReviewed = (report.human_verification_status || "pending") !== "pending";
  return (
    <section className="card evidence-scope" id="evidence-scope" style={{ marginTop: 18 }}>
      <div className="section-title">Evidence Scope</div>
      <p className="es-note">
        AMIRA reports evidence coverage within a defined source set — not a claim that every
        relevant study has been reviewed.
      </p>
      <div className="es-grid">
        <div><span className="es-k">Guideline coverage</span><span className="es-v">Guideline-level coverage review not yet completed</span></div>
        {ss && <div><span className="es-k">Evidence records reviewed by AMIRA</span><span className="es-v">{ss.rcts_for_selected_medicine} evidence record{ss.rcts_for_selected_medicine === 1 ? "" : "s"} · {ss.publications_for_selected_medicine} publication{ss.publications_for_selected_medicine === 1 ? "" : "s"}</span></div>}
        <div><span className="es-k">Sex-specific findings located</span><span className="es-v">{sexFindings}</span></div>
        <div><span className="es-k">Source cutoff</span><span className="es-v">{report.source_cutoff}</span></div>
        <div><span className="es-k">Human review status</span><span className={`es-badge ${humanReviewed ? "ok" : "pending"}`}>{humanReviewed ? "Human reviewed" : "Human review pending"}</span></div>
      </div>
    </section>
  );
}

// Canonical evidence-state label for a gap dimension.
function gapState(nReporting: number, nTrials: number): { label: string; tone: string } {
  if (nReporting > 0) return { label: `Reported in ${nReporting} of ${nTrials}`, tone: "present" };
  return { label: `Not reported in ${nTrials} reviewed ${nTrials === 1 ? "trial" : "trials"}`, tone: "missing" };
}

export function WhatRemainsUnknown({ report }: { report: EvidenceResponse }) {
  const gaps = report.evidence_gaps || [];
  if (!gaps.length) return null;
  return (
    <section className="card remains-unknown" id="remains-unknown" style={{ marginTop: 18 }}>
      <div className="section-title">What Remains Unknown</div>
      <p className="ru-note">
        Bounded to the reviewed corpus. "Not reported" reflects the reviewed sources, not confirmed
        absence in the wider literature; AMIRA never infers a gap from silence beyond its evidence-state rules.
      </p>
      <ul className="ru-list">
        {gaps.map((g) => {
          const st = gapState(g.n_reporting, g.n_trials);
          return (
            <li key={g.dimension}>
              <span className="ru-label">{g.label}</span>
              <span className={`ru-chip ${st.tone}`}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
