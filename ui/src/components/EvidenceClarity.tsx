import type { CriticalSignal, EvidenceResponse } from "../api";

/** Compact Check Evidence additions (progressive disclosure, no dense dashboard):
 *  - CriticalSignalPanel: a verified Critical Signal card + "Why This Matters
 *    Clinically" (rendered ONLY when a verified critical signal exists).
 *  - EvidenceScope: what AMIRA actually reviewed — bounded, never a global
 *    completeness claim, numbers only from the real report.
 *  - WhatRemainsUnknown: canonical evidence-state gaps. */

export function CriticalSignalPanel({ signal }: { signal: CriticalSignal | null }) {
  if (!signal) return null;
  const isMortality = /mortal/i.test(signal.signal_type);
  const why = isMortality
    ? `A historical analysis found higher mortality among women assigned ${signal.medicine.toLowerCase()}. This signal should not be missed, but it does not by itself determine treatment for an individual patient.`
    : `A clinically important sex-specific difference was reported for ${signal.medicine.toLowerCase()}. This signal should not be missed, but it does not by itself determine treatment for an individual patient.`;
  return (
    <section className="card cs-check" id="critical-signal" style={{ marginTop: 18 }}>
      <div className="cs-check-flag warn">
        <span className="cs-type warn">{signal.signal_type} signal</span>
        <span className="cs-status">{signal.evidence_status}</span>
      </div>
      <h2 className="cs-check-headline">{signal.headline}</h2>
      {signal.summary && <div className="cs-check-summary">{signal.summary}</div>}
      {signal.cautions?.length > 0 && <div className="cs-cautions">{signal.cautions.join(" · ")}</div>}
      {signal.source_url && (
        <a className="cs-link" href={signal.source_url} target="_blank" rel="noopener noreferrer">
          View exact passage →
        </a>
      )}
      <div className="cs-why-clinical">
        <h3>Why This Matters Clinically</h3>
        <p>{why}</p>
        <p>Clinicians should consider this evidence alongside patient characteristics, current
          guidance, and the full balance of risks and benefits.</p>
      </div>
    </section>
  );
}

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
        {ss && <div><span className="es-k">Studies assessed by AMIRA</span><span className="es-v">{ss.rcts_for_selected_medicine} randomized {ss.rcts_for_selected_medicine === 1 ? "study" : "studies"} · {ss.publications_for_selected_medicine} publication{ss.publications_for_selected_medicine === 1 ? "" : "s"}</span></div>}
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
