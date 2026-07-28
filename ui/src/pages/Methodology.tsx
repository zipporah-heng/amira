import { useEffect } from "react";
import { MethodologyFlow } from "../components/MethodologyFlow";
import { HormonalFocus } from "../components/HormonalFocus";
import { MATURITY_ANCHOR } from "../maturityLevels";

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
  // Scroll to the requested section (e.g. #evidence-maturity-model from the Evidence
  // Maturity card's "About evidence maturity levels" link). Retry briefly so the jump
  // lands after the page below has finished laying out (the anchor sits mid-page).
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    // Re-pin across the settle window: late images/fonts render AFTER the first jump
    // and push the anchor down, so we must keep re-scrolling for a while (not stop as
    // soon as one scroll lands). Instant (not smooth) — some embedded browsers ignore
    // programmatic smooth scrolling and would leave the jump at the top of the page.
    const jump = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: "start" });
      if (tries++ < 14) timer = setTimeout(jump, 200);
    };
    timer = setTimeout(jump, 80);
    window.addEventListener("load", jump);
    return () => { clearTimeout(timer); window.removeEventListener("load", jump); };
  }, []);

  return (
    <div className="methodology-page">
      <span className="eyebrow">Methodology</span>
      <h1 className="page-q">How AMIRA works</h1>
      <p className="page-sub">
        AMIRA turns fragmented research into standardized, machine-readable women's hormonal
        evidence, then shows what the research did and did not report.
      </p>

      <div className="method-positioning">
        <p>AMIRA is designed as a trusted women's evidence layer for clinical, research, and
          life-sciences platforms.</p>
        <p>AMIRA reports evidence coverage within defined source sets, guidelines, conditions, and
          review dates. It does not claim global completeness, is not FDA-approved, and does not
          provide autonomous medical guidance.</p>
      </div>

      <HormonalFocus />

      <MethodologyFlow />

      <h2 id={MATURITY_ANCHOR} className="page-q" style={{ fontSize: 22, marginTop: 34 }}>The 1-to-5 Evidence Maturity Model</h2>
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
