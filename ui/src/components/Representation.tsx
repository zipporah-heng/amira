import type { EvidenceResponse } from "../api";
import * as M from "../evidenceModel";

/** "How were women represented?" — the canonical evidence fields at a glance.
 *
 *  Every card reads ui/src/evidenceModel.ts, the SAME derivation layer the detailed
 *  sections and the PDF export use, so this row can never report a state that
 *  contradicts the section below it. Only the wording is shortened; the state is not
 *  re-derived here. Nothing is inferred: menopause is never taken from age, and a
 *  dimension AMIRA has not reviewed stays explicitly unestablished. */

const Icon = ({ name }: { name: string }) => {
  const p: Record<string, JSX.Element> = {
    women: <><circle cx="9" cy="7" r="3" /><path d="M3 21c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17.5" cy="8" r="2.2" /><path d="M21 21c0-2.8-1.7-4.8-4-5.4" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 15l4-4 3 3 6-7" /><path d="M17 7h3v3" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    pill: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-40 12 12)" /><path d="M9 8l5 5" /></>,
    baby: <><circle cx="12" cy="9" r="4" /><path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M10 9h.01M14 9h.01" /></>,
    person: <><circle cx="12" cy="7" r="3.2" /><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7" /></>,
    group: <><circle cx="8" cy="9" r="2.4" /><circle cx="16" cy="9" r="2.4" /><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5" /><path d="M13 20c0-2.4 1.4-4.2 3.5-4.8 2.1.6 3.5 2.4 3.5 4.8" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className="rep-icon" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p[name]}</svg>
  );
};

const GLYPH: Record<M.StateTone, string> = {
  reported: "✓", limited: "!", not_reported: "✕", incomplete: "?",
};

export function Representation({ report }: { report: EvidenceResponse }) {
  const hc = M.hormonalContext(report);
  const included = M.womenIncluded(report);
  const pct = report.totals?.women_pct_of_participants;

  const cards: { title: string; icon: string; cell: M.EvidenceCell; sub?: string }[] = [
    // "Women included" keeps its percentage; the state itself is the shared one.
    { title: "Women included", icon: "women", cell: included,
      sub: included.tone === "reported" && pct != null ? `${pct}%` : undefined },
    // Sex-specific outcomes IS the women-analyzed question — same value, same wording.
    { title: "Sex-specific outcomes", icon: "chart", cell: M.sexSpecificOutcomes(report) },
    { title: "Sex-specific safety", icon: "shield", cell: M.safety(report) },
    { title: "Menopause", icon: "calendar", cell: hc.menopauseRepresentation },
    { title: "Hormone therapy", icon: "pill", cell: hc.hormoneTherapyRepresentation },
    { title: "Pregnancy", icon: "baby", cell: M.pregnancyEvidence(report) },
    { title: "Older women or age reporting", icon: "person", cell: M.ageReporting(report) },
    { title: "Race and ethnicity", icon: "group", cell: M.raceEthnicity(report) },
  ];

  return (
    <section className="card representation" id="representation" style={{ marginTop: 18 }}>
      <h2 className="rep-h">How were women represented?</h2>
      <p className="rep-sub">
        A summary of the same canonical evidence states shown in the detailed sections below.
      </p>
      <div className="rep-row">
        {cards.map((c) => {
          const short = M.shortLabel(c.cell);
          return (
            <div className={`rep-cell ${c.cell.tone}`} key={c.title}>
              <div className="rep-cell-title">{c.title}</div>
              <div className={`rep-cell-icon ${c.cell.tone}`}><Icon name={c.icon} /></div>
              <div className={`rep-pill ${c.cell.tone}`}>
                <span className="rep-pill-glyph" aria-hidden>{GLYPH[c.cell.tone]}</span>
                {short}{c.sub ? ` · ${c.sub}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <p className="ev-foot">
        Menopausal status is never inferred from age, and a dimension AMIRA has not reviewed is
        shown as not established rather than as absent from the research.
      </p>
    </section>
  );
}
