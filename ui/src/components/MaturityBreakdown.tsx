import { useState } from "react";
import type { Maturity } from "../api";

export function MaturityBreakdown({ maturity }: { maturity: Maturity }) {
  const [open, setOpen] = useState(true);
  return (
    <section id="maturity" className="card">
      <div className="mb-head" onClick={() => setOpen(!open)}>
        <div>
          <div className="section-title">Evidence maturity — how well was this studied in women?</div>
          {maturity.scorable === false ? (
            <div className="mb-score" style={{ fontSize: 18, fontWeight: 650, color: "var(--ink-2)" }}>
              Not yet established
            </div>
          ) : (
            <div className="mb-score"><b>{maturity.level}</b> / {maturity.max_level} · {maturity.label}</div>
          )}
        </div>
        <button className="mb-toggle" aria-expanded={open}>{open ? "Hide" : "Show"} breakdown</button>
      </div>

      {maturity.scorable === false && maturity.unscored_reason && (
        <div className="callout" style={{ marginTop: 12 }}>{maturity.unscored_reason}</div>
      )}

      {open && (
        <div className="mb-levels">
          {maturity.rule_trace.map((r) => (
            <div className={`mb-level ${r.satisfied ? "pass" : "fail"}`} key={r.level}>
              <div className="mb-num">{r.level}</div>
              <div className="mb-body">
                <div className="mb-name">
                  {r.label}
                  <span className={`mb-flag ${r.satisfied ? "pass" : "fail"}`}>
                    {r.satisfied ? "PASS" : "FAIL"}
                  </span>
                </div>
                <div className="mb-req">{r.requirement}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="disclaimer" style={{ marginTop: 10 }}>{maturity.derivation_note}</p>
    </section>
  );
}
