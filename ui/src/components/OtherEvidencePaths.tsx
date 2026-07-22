import type { EvidenceResponse } from "../api";

/** "Another <condition> evidence path to review" — shown ONLY when the SELECTED
 *  medicine carries a significant sex-specific signal (a genuine reason to point
 *  the reader to another evidence path, e.g. Digoxin's historical mortality
 *  signal). It lists only the OTHER same-condition medicines as separate evidence
 *  paths — never the selected medicine itself, never a head-to-head comparison,
 *  similar-medicine claim, ranking, or treatment recommendation.
 *
 *  Conditional on the SELECTED MEDICINE, not merely on condition = heart failure:
 *  a medicine whose own result is already a contemporary, no-significant-difference
 *  finding (e.g. Dapagliflozin) does not surface an "other path" section at all. */

interface Card {
  medicine: string;
  drugClass: string | null;
  descriptor: string;
  bullets: string[];
  sourceUrl: string;
  tone: "warn" | "info";
  note?: string | null;
}

/** True when the selected medicine has a significant, trial-scoped sex-specific
 *  finding (effectiveness or safety) — the trigger for reviewing another path. */
function hasSignificantSignal(report: EvidenceResponse): boolean {
  const eff = (report.effectiveness?.findings || []).some(
    (f) => f.scope.startsWith("trial:") && f.significance === "significant",
  );
  const saf = (report.safety?.significant_findings || []).some(
    (f) => f.scope.startsWith("trial:"),
  );
  return eff || saf;
}

export function OtherEvidencePaths({ report }: { report: EvidenceResponse }) {
  const others = report.other_evidence_paths || [];
  // Only surface other paths when the SELECTED medicine has a significant signal,
  // and only when other same-condition medicines actually exist.
  if (!hasSignificantSignal(report) || !others.length) return null;
  const cond = (report.query.condition || "this condition").toLowerCase();

  // Never include the selected medicine's own card — only the OTHER paths.
  const cards: Card[] = others.map((p): Card => ({
    medicine: p.medicine, drugClass: p.drug_class,
    descriptor: p.headline, bullets: p.bullets, sourceUrl: p.source.url,
    tone: "info", note: p.interpretation_note,
  }));

  return (
    <section className="card other-paths" id="other-paths" style={{ marginTop: 18 }}>
      <div className="op-head">
        <h2 className="op-h">Another {cond} evidence path to review</h2>
        <span className="op-tag">Not a treatment ranking</span>
      </div>
      <div className="op-grid">
        {cards.map((c) => (
          <div className={`op-card ${c.tone}`} key={c.medicine}>
            <div className="op-title">
              <span className="op-dot" aria-hidden>{c.tone === "warn" ? "⚠" : "◆"}</span>
              <div>
                <div className="op-med">{c.medicine}</div>
                {c.drugClass && <div className="op-class">{c.drugClass}</div>}
              </div>
            </div>
            <p className="op-descriptor">{c.descriptor}</p>
            <ul className="op-bullets">{c.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            {c.note && <p className="op-note">{c.note}</p>}
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="src-link">View exact passage →</a>
          </div>
        ))}
      </div>
      <div className="op-disclaimer">
        <span aria-hidden>ⓘ</span> Evidence readiness is not clinical effectiveness. AMIRA does not choose a medicine.
      </div>
    </section>
  );
}
