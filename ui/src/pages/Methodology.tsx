import { MethodologyFlow } from "../components/MethodologyFlow";
import { HormonalFocus } from "../components/HormonalFocus";

/** Definitions of the maturity ladder. The AWARDED level is never defined here —
 *  it is derived from evidence by the API at request time. */
const MATURITY_MODEL = [
  { level: 1, name: "Women Counted", description: "Female enrollment is reported (count or percentage)." },
  { level: 2, name: "Women Analyzed", description: "Sex-specific efficacy or safety outcomes are reported." },
  { level: 3, name: "Life Stage Aware", description: "Menopausal status or life stage is reported. Age is never used to infer it." },
  { level: 4, name: "Hormone Aware", description: "Hormone therapy use and hormonal context are reported." },
  { level: 5, name: "Precision Women's Evidence", description: "Sex-specific outcomes stratified by life stage and hormonal context." },
];

export function Methodology() {
  return (
    <div className="methodology-page">
      <span className="eyebrow">Methodology</span>
      <h1 className="page-q">How AMIRA works</h1>
      <p className="page-sub">
        AMIRA turns fragmented research into standardized, machine-readable women's hormonal
        evidence, then shows what the research did and did not report.
      </p>

      <HormonalFocus />

      <MethodologyFlow />

      <h2 className="page-q" style={{ fontSize: 22, marginTop: 34 }}>The 1-to-5 Evidence Maturity Model</h2>
      <p style={{ maxWidth: 720 }}>
        AMIRA scores how completely research reports women's and hormonal context. This is an
        evidence-maturity model only — it does not imply a personalized treatment recommendation.
      </p>
      <div className="ladder" style={{ marginTop: 14 }}>
        {MATURITY_MODEL.map((m) => (
          <div className="rung" key={m.level} style={{ minWidth: 150 }}>
            <div className="rn">Level {m.level}</div>
            <div className="rt">{m.name}</div>
            <p style={{ fontSize: 12, marginTop: 6, color: "var(--ink-3)" }}>{m.description}</p>
          </div>
        ))}
      </div>

      <h2 className="page-q" style={{ fontSize: 22, marginTop: 34 }}>Two states we never confuse</h2>
      <div className="two-states">
        <div className="state-box gap">
          <h4>🔍 No evidence found</h4>
          <p>
            A search ran and returned nothing relevant in the reviewed set. This is an
            evidence gap — not a finding about whether the medicine works.
          </p>
        </div>
        <div className="state-box effect">
          <h4>⚖️ Evidence of no effect</h4>
          <p>
            A study explicitly tested an outcome and reported a null or negative result. This
            is a finding about that study, not a gap.
          </p>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 22 }}>
        AMIRA measures evidence coverage, not clinical performance. It does not diagnose,
        prescribe, recommend treatment, or rank medicines by effectiveness.
      </div>
    </div>
  );
}
