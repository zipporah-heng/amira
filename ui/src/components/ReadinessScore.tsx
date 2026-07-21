import { useState } from "react";
import type { Maturity, Readiness, ReadinessDimension } from "../api";

/** Sections 4 & 5 — AMIRA Evidence Readiness.
 *  The scientifically implemented 1-5 maturity level and the feature-flagged
 *  pilot 0-100 score sit side by side. The pilot score is computed from real
 *  structured evidence by a deterministic engine (never an LLM opinion), and is
 *  clearly labelled provisional. */

const STATE_TONE: Record<string, string> = {
  complete: "ok",
  partial: "trend",
  insufficient: "missing",
  not_reported: "missing",
  not_located: "neutral",
  excluded: "neutral",
  not_applicable: "neutral",
};

const STATE_LABEL: Record<string, string> = {
  complete: "Complete",
  partial: "Partial",
  insufficient: "Insufficient",
  not_reported: "Not reported",
  not_located: "Not located",
  excluded: "Excluded",
  not_applicable: "Not applicable",
};

function ScoreGauge({ score }: { score: number }) {
  // Semicircular gauge; the arc fills proportionally to the 0-100 score.
  const r = 52;
  const circ = Math.PI * r; // half circumference
  const filled = (score / 100) * circ;
  return (
    <svg className="score-gauge" viewBox="0 0 130 74" role="img"
         aria-label={`Pilot readiness score ${score} out of 100`}>
      <path d="M 9 65 A 52 52 0 0 1 121 65" fill="none" stroke="var(--surface-2)" strokeWidth="12" strokeLinecap="round" />
      <path d="M 9 65 A 52 52 0 0 1 121 65" fill="none" stroke="var(--lav-600)" strokeWidth="12"
            strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} />
      <text x="65" y="58" textAnchor="middle" className="gauge-num">{score}</text>
      <text x="65" y="70" textAnchor="middle" className="gauge-den">/ 100</text>
    </svg>
  );
}

function DimensionRow({ d }: { d: ReadinessDimension }) {
  const [open, setOpen] = useState(false);
  const tone = STATE_TONE[d.state] || "neutral";
  const eligible = d.max_eligible > 0;
  return (
    <div className={`rd-dim ${tone}`}>
      <div className="rd-dim-head" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}
           onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((v) => !v)}
           aria-expanded={open}>
        <div className="rd-dim-title">
          <span className="rd-dim-name">{d.title}</span>
          <span className={`rd-state ${tone}`}>{STATE_LABEL[d.state] || d.state}</span>
        </div>
        <div className="rd-dim-points">
          {eligible ? <><b>{d.points}</b> / {d.max_eligible} pts</> : <span className="rd-na">excluded from denominator</span>}
        </div>
      </div>
      <div className="rd-q">{d.question}</div>
      <div className="rd-reason">{d.reason}</div>
      {d.source_records.length > 0 && (
        <button className="rd-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"} {d.source_records.length} source record{d.source_records.length === 1 ? "" : "s"}
        </button>
      )}
      {open && (
        <div className="rd-records">
          {d.source_records.map((r, i) => (
            <div className="rd-record" key={(r.assertion_id || r.finding_id || "") + i}>
              <div className="rd-record-meta">
                <span className="badge asset"><span className="dot" /> {r.value_basis || "finding"}</span>
                {r.nct_id && <span className="muted">{r.nct_id}</span>}
                {r.pmid && <span className="muted">PMID {r.pmid}</span>}
              </div>
              {r.exact_passage && <blockquote className="passage">"{r.exact_passage}"</blockquote>}
              <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="src-link">Open source ↗</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReadinessScore({ readiness, maturity, onJumpMaturity }: {
  readiness: Readiness;
  maturity: Maturity | null;
  onJumpMaturity: () => void;
}) {
  return (
    <section className="card readiness" id="readiness" style={{ marginTop: 22 }}>
      <div className="rd-head">
        <div>
          <div className="section-title">AMIRA Evidence Readiness</div>
          <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>
            Two views of how completely this medicine's evidence covers women. The 1–5 maturity level is
            the scientifically implemented measure; the 0–100 pilot score is a provisional completeness lens.
          </p>
        </div>
        {maturity && (
          <button className="rd-maturity" onClick={onJumpMaturity}>
            <div className="rd-maturity-lab">Evidence maturity</div>
            <div className="rd-maturity-val">{maturity.display || `${maturity.level} / ${maturity.max_level}`}</div>
            <div className="rd-maturity-name">{maturity.label}</div>
          </button>
        )}
      </div>

      {!readiness.scored ? (
        <div className="callout" style={{ marginTop: 16 }}>
          <strong>{readiness.label || "Pilot readiness"} — not established.</strong> {readiness.reason}
        </div>
      ) : (
        <>
          <div className="rd-score-row">
            <ScoreGauge score={readiness.score!} />
            <div className="rd-score-meta">
              <div className="rd-score-label">{readiness.label}</div>
              <div className="rd-pilot-badge">{readiness.pilot_note}</div>
              <div className="rd-score-sub">
                {readiness.points_earned} of {readiness.max_eligible_points} eligible points. {readiness.denominator_note}
              </div>
            </div>
          </div>

          <div className="rd-disclaimer">{readiness.disclaimer}</div>

          <div className="section-title" style={{ marginTop: 20 }}>Transparent score breakdown</div>
          <p className="muted" style={{ marginTop: 4 }}>
            Five equally weighted dimensions (up to 20 points each). Each shows its evidence state, the
            plain-language reason, and the source records behind it. Rules version {readiness.rules_version}.
          </p>
          <div className="rd-dims">
            {readiness.dimensions!.map((d) => <DimensionRow key={d.key} d={d} />)}
          </div>
        </>
      )}
    </section>
  );
}
