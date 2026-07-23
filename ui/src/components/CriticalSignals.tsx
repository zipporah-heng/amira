import { useEffect, useMemo, useState } from "react";
import { getCriticalSignals, type CriticalSignal, type CriticalSignalsResponse } from "../api";

/** Critical Signals — AMIRA's intelligence layer. Featured cards (capped, priority
 *  ordered) surface the most consequential trusted signals; the Critical Evidence
 *  Library is the scalable, filterable/searchable catalogue. Every row resolves back
 *  to a canonical finding/source/passage — nothing here is a second truth system. */

const ANY = "Any";

function uniq(xs: (string | null | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => !!x))].sort();
}

function FeaturedCard({ s }: { s: CriticalSignal }) {
  // Pink accent only for a genuine adverse signal (mortality / serious safety).
  const tone = /mortal|safety/i.test(s.signal_type) ? "warn" : "calm";
  return (
    <div className={`cs-card ${tone}`}>
      <div className="cs-card-head">
        <span className={`cs-type ${tone}`}>{s.signal_type}</span>
        <span className="cs-status">{s.evidence_status}</span>
      </div>
      <div className="cs-med">{s.medicine}</div>
      <div className="cs-headline">{s.headline}</div>
      {s.summary && <div className="cs-summary">{s.summary}</div>}
      {s.clinical_significance && <p className="cs-expl">{s.clinical_significance}</p>}
      {s.cautions?.length > 0 && (
        <div className="cs-cautions">{s.cautions.join(" · ")}</div>
      )}
      {s.source_url
        ? <a className="cs-link" href={s.source_url} target="_blank" rel="noopener noreferrer">View exact passage →</a>
        : <span className="cs-link muted">Source unresolved</span>}
    </div>
  );
}

export function CriticalSignals() {
  const [data, setData] = useState<CriticalSignalsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [healthArea, setHealthArea] = useState(ANY);
  const [condition, setCondition] = useState(ANY);
  const [signalType, setSignalType] = useState(ANY);
  const [lifeStage, setLifeStage] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [q, setQ] = useState("");

  useEffect(() => { getCriticalSignals().then(setData).catch((e) => setErr(e.message)); }, []);

  const lib = data?.library || [];
  const areas = useMemo(() => uniq(lib.map((s) => s.health_area)), [lib]);
  const conditions = useMemo(() => uniq(lib.map((s) => s.condition)), [lib]);
  const lifeStages = useMemo(() => uniq(lib.map((s) => s.life_stage)), [lib]);

  const filtered = lib.filter((s) => {
    if (healthArea !== ANY && s.health_area !== healthArea) return false;
    if (condition !== ANY && s.condition !== condition) return false;
    if (signalType !== ANY && s.signal_type !== signalType) return false;
    if (lifeStage !== ANY && s.life_stage !== lifeStage) return false;
    if (status !== ANY && s.evidence_status !== status) return false;
    if (q.trim()) {
      const hay = `${s.medicine} ${s.headline} ${s.clinical_significance} ${s.condition}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  if (err) return <div className="callout" style={{ marginTop: 18 }}>Could not load Critical Signals: {err}</div>;
  if (!data) return <p>Loading critical signals…</p>;

  const sel = (label: string, value: string, set: (v: string) => void, options: string[]) => (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        <select aria-label={label} value={value} onChange={(e) => set(e.target.value)}>
          {[ANY, ...options].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="critical-signals">
      <h2 className="page-q" style={{ fontSize: 28 }}>Evidence That Changed the Story for Women</h2>
      <p className="page-sub">
        Important findings where studying women revealed clinically meaningful differences in safety,
        dosing, effectiveness, or outcomes.
      </p>

      {/* A. Featured Critical Signals */}
      <div className="section-title" style={{ marginTop: 20 }}>Featured Critical Signals</div>
      {data.featured.length === 0
        ? <p className="cs-empty">No featured signals yet — a signal is featured only when its underlying
            finding is significant, source-verified, and passage-backed.</p>
        : <div className="cs-grid">{data.featured.map((s) => <FeaturedCard key={s.signal_id} s={s} />)}</div>}

      {/* B. Critical Evidence Library */}
      <div className="section-title" style={{ marginTop: 28 }}>Critical Evidence Library</div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
        The scalable catalogue of verified sex-specific findings. A medicine is not featured merely
        because it appears here.
      </p>
      <div className="cs-filters">
        {sel("Health Area", healthArea, setHealthArea, areas)}
        {sel("Condition", condition, setCondition, conditions)}
        {sel("Signal Type", signalType, setSignalType, data.signal_types)}
        {sel("Life Stage", lifeStage, setLifeStage, lifeStages)}
        {sel("Evidence Status", status, setStatus, data.evidence_statuses)}
        <div className="field cs-search">
          <label>Search</label>
          <div className="field-wrap">
            <input aria-label="Search" placeholder="Medicine or finding text"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="matrix-wrap" style={{ marginTop: 12 }}>
        <table className="matrix cs-table">
          <thead>
            <tr>
              <th>Medicine</th><th>Health Area</th><th>Condition</th><th>Critical Finding</th>
              <th>Signal Type</th><th>Why It Matters</th><th>Evidence Status</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ color: "var(--ink-3)", padding: 16 }}>No signals match these filters.</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.signal_id}>
                <td><b>{s.medicine}</b></td>
                <td>{s.health_area}</td>
                <td>{s.condition}</td>
                <td>{s.headline}</td>
                <td>{s.signal_type}</td>
                <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{s.clinical_significance}</td>
                <td><span className="cs-status">{s.evidence_status}</span></td>
                <td>{s.source_url
                  ? <a href={s.source_url} target="_blank" rel="noopener noreferrer">Passage →</a>
                  : <span className="muted">unresolved</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* C. Why This Section Exists */}
      <div className="cs-why">
        <div className="section-title">Why This Section Exists</div>
        <ul>
          <li><strong>Counted is not the same as studied.</strong></li>
          <li>Some sex-specific findings change how medicines should be understood.</li>
          <li>AMIRA surfaces the source, the signal, and what remains unknown.</li>
        </ul>
        <p className="cs-guardrail">
          AMIRA highlights clinically important evidence for women. It does not diagnose, prescribe,
          or recommend treatment.
        </p>
      </div>
    </div>
  );
}
