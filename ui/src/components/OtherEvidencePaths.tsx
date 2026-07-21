import type { EvidenceResponse } from "../api";

/** "Another <condition> evidence path to review" — the selected medicine and
 *  each other same-condition medicine shown as SEPARATE evidence paths (never a
 *  head-to-head comparison, similar-medicine claim, or recommendation). */

interface Card {
  medicine: string;
  drugClass: string | null;
  descriptor: string;
  bullets: string[];
  sourceUrl: string;
}

function currentCard(report: EvidenceResponse): Card | null {
  const f = (report.effectiveness?.findings || []).find((x) => x.scope.startsWith("trial:"));
  if (!f) return null;
  const trial = f.scope.split(":", 1 + 1)[1] || "";
  const isPostHoc = /post hoc/i.test(f.interpretation || "");
  const bullets = [
    `${trial} trial${isPostHoc ? " post hoc analysis" : ""}`,
    f.female_estimate ? `${f.female_estimate}${f.female_ci ? ` (${f.female_ci})` : ""}` : "",
  ].filter(Boolean);
  return {
    medicine: report.banner!.medicine,
    drugClass: report.banner!.drug_class,
    descriptor: `${isPostHoc ? "Historical post hoc mortality signal" : "Sex-specific signal"}; menopause not reported`,
    bullets,
    sourceUrl: f.source.url,
  };
}

export function OtherEvidencePaths({ report }: { report: EvidenceResponse }) {
  const others = report.other_evidence_paths || [];
  if (!others.length) return null;
  const cond = (report.query.condition || "this condition").toLowerCase();

  const cur = currentCard(report);
  const cards: Card[] = [
    ...(cur ? [cur] : []),
    ...others.map((p) => ({
      medicine: p.medicine, drugClass: p.drug_class,
      descriptor: p.headline, bullets: p.bullets, sourceUrl: p.source.url,
    })),
  ];

  return (
    <section className="card other-paths" id="other-paths" style={{ marginTop: 18 }}>
      <div className="op-head">
        <h2 className="op-h">Another {cond} evidence path to review</h2>
        <span className="op-tag">Not a treatment ranking</span>
      </div>
      <div className="op-grid">
        {cards.map((c) => (
          <div className="op-card" key={c.medicine}>
            <div className="op-title">
              <span className="op-dot" aria-hidden>◆</span>
              <div>
                <div className="op-med">{c.medicine}</div>
                {c.drugClass && <div className="op-class">{c.drugClass}</div>}
              </div>
            </div>
            <p className="op-descriptor">{c.descriptor}</p>
            <ul className="op-bullets">{c.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
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
