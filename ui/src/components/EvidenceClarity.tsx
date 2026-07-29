import type { EvidenceResponse } from "../api";

/** Compact Check Evidence additions (progressive disclosure, no dense dashboard):
 *  - WhatRemainsUnknown: canonical evidence-state gaps.
 *
 *  The standalone review-scope panel that used to live here has been deleted. What it
 *  reported is not lost: those counts are derived in evidenceModel (evidenceRecordsReviewed,
 *  sexSpecificFindingsLocated, GUIDELINE_LIMITATION) and shown inside Source coverage and
 *  About this evidence review.
 *
 *  NOTE: the medicine's headline signal (badges, statistics, cautions, exact passage
 *  and "Why does this matter?") lives in a single place — the "What should I notice?"
 *  card (see WhatToNotice). There is no separate standalone signal panel here. */

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
