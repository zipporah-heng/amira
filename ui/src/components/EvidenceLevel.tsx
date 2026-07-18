import { fixture } from "../fixture";
import { DemoBadge } from "./DemoBadge";

export function EvidenceLevel({ level }: { level: number }) {
  const model = fixture.evidence_maturity_model;
  const current = model.find((m) => m.level === level);

  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div className="section-title">AMIRA evidence level</div>
        <DemoBadge />
      </div>
      <div className="level-wrap" style={{ marginTop: 14 }}>
        <div className="level-badge">
          <span className="cap">Level {level} of 5</span>
          <span className="num">{level}</span>
        </div>
        <div>
          <div className="level-name">{current?.name}</div>
          <p style={{ marginTop: 4, maxWidth: 440, fontSize: 14 }}>{current?.description}</p>
        </div>
      </div>
      <div className="ladder">
        {model.map((m) => (
          <div key={m.level} className={`rung ${m.level === level ? "on" : m.level < level ? "" : "dim"}`}>
            <div className="rn">Level {m.level}</div>
            <div className="rt">{m.name}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
        This is an evidence-maturity model. It measures how completely research reports
        women's and hormonal context — not whether a medicine works, is safe, or is right for you.
      </p>
    </div>
  );
}
