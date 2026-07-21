import type { EvidencePath } from "../api";

/** "Another heart-failure evidence path to review" — where other medicines for
 *  the same condition appear as SEPARATE evidence paths. Never a head-to-head
 *  comparison or a treatment recommendation. This is the only place another
 *  medicine (e.g. Dapagliflozin) is surfaced. */
export function OtherEvidencePaths({ paths, condition }: { paths: EvidencePath[]; condition: string }) {
  if (!paths.length) return null;
  const cond = (condition || "this condition").toLowerCase();
  return (
    <section className="card other-paths" id="other-paths" style={{ marginTop: 22 }}>
      <div className="op-head">
        <div className="section-title">Another {cond} evidence path to review</div>
        <span className="op-tag">Not a treatment ranking</span>
      </div>
      <div className="op-grid">
        {paths.map((p) => (
          <div className="op-card" key={p.medicine}>
            <div className="op-title">
              <span className="pill-icon sm" aria-hidden>💧</span>
              <div>
                <div className="op-med">{p.medicine}</div>
                {p.drug_class && <div className="op-class">{p.drug_class}</div>}
              </div>
            </div>
            <p className="op-headline">{p.headline}</p>
            <ul className="op-bullets">
              {p.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
            <div className="op-boundary">{p.boundary}</div>
            <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="src-link">
              View exact passage ↗
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
