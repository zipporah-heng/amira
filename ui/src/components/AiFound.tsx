/** Compact "How AMIRA's AI found this evidence" — five-stage pipeline + five
 *  trace cards on the left, the Women's Evidence Schema table on the right.
 *  The full interactive extraction lives in the evidence-trace drawer. */

const STAGES = [
  { icon: "📄", label: "Published sources" },
  { icon: "🧠", label: "AMIRA-Extract (AI)" },
  { icon: "🗂️", label: "Women's Evidence Schema" },
  { icon: "🔍", label: "Exact passage check" },
  { icon: "👤", label: "Human review" },
];

const SCHEMA_ROWS: [string, string][] = [
  ["women_represented", "Were women included"],
  ["sex_specific_effectiveness", "Effectiveness by sex"],
  ["sex_specific_safety", "Safety by sex"],
  ["menopause", "Menopause reported"],
  ["pregnancy", "Pregnancy reported"],
  ["hormone_therapy", "Hormone therapy reported"],
  ["race_ethnicity", "Race/ethnicity reported"],
  ["age", "Age distribution reported"],
  ["evidence_passage", "Exact passage text"],
  ["source_id", "Unique source identifier"],
];

export function AiFound({ onOpenTrace }: { onOpenTrace: () => void }) {
  const traceCards = [
    { n: 1, k: "Source", v: "PubMed + ClinicalTrials.gov" },
    { n: 2, k: "AI extraction", v: "Sex-specific mortality signal" },
    { n: 3, k: "Structured field", v: "sex_specific_effectiveness", mono: true },
    { n: 4, k: "Passage validation", v: "Stored excerpt matched", tone: "present" },
    { n: 5, k: "Review state", v: "Human review pending", tone: "unclear" },
  ];

  return (
    <section className="card ai-found" id="ai-found" style={{ marginTop: 18 }}>
      <div className="ai-found-grid">
        <div className="ai-found-left">
          <h2 className="ai-h">How AMIRA's AI found this evidence</h2>
          <div className="pipe5">
            {STAGES.map((s, i) => (
              <div className="pipe5-step" key={s.label}>
                <div className="pipe5-ic" aria-hidden>{s.icon}</div>
                <div className="pipe5-lab">{s.label}</div>
                {i < STAGES.length - 1 && <div className="pipe5-arrow" aria-hidden>→</div>}
              </div>
            ))}
          </div>
          <div className="trace5">
            {traceCards.map((c) => (
              <div className="trace5-card" key={c.n}>
                <div className="trace5-n">{c.n}</div>
                <div className="trace5-k">{c.k}</div>
                <div className={`trace5-v ${c.mono ? "mono" : ""} ${c.tone || ""}`}>{c.v}</div>
              </div>
            ))}
          </div>
          <button className="cta ghost trace-open" onClick={onOpenTrace}>Open evidence trace ↗</button>
          <p className="ai-found-note">The AI extracts evidence. Deterministic rules calculate readiness.</p>
        </div>

        <div className="ai-found-right">
          <div className="schema-title">Women's Evidence Schema</div>
          <table className="schema-table">
            <tbody>
              {SCHEMA_ROWS.map(([field, meaning]) => (
                <tr key={field}><td className="schema-field">{field}</td><td className="schema-meaning">{meaning}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
