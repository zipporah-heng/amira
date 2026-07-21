const GH = "https://github.com/zipporah-heng/amira/blob/main/";

const ASSETS = [
  { icon: "🧩", title: "Women's Evidence Schema", sub: "Versioned JSON Schema (v0.2)", href: GH + "schema/womens_evidence_schema_v0.2.json" },
  { icon: "📝", title: "Prompt Library", sub: "Provider-agnostic extraction prompt", href: GH + "prompts/evidence_extraction_v0.1.md" },
  { icon: "🗂️", title: "Source-linked Dataset", sub: "Trials, sources, assertions, findings", href: GH + "dataset" },
  { icon: "🌐", title: "Benchmark Passages", sub: "Pending human review", href: GH + "benchmark/amira_benchmark.jsonl", badge: "pending review" },
  { icon: "⚙️", title: "Evaluation Runner", sub: "Process metrics; no accuracy claimed", href: GH + "evaluation/run_extraction_evaluation.py" },
  { icon: "📚", title: "API + Documentation", sub: "Model card, data card, methodology", href: GH + "docs/open-science-assets.md" },
];

const ARCH = ["Clinical research", "AI extraction", "Evidence schema", "Validation", "Readiness engine", "Dashboard + Research Map + Open Assets"];

/** "Reusable Scientific Assets" — six primary cards in one row + architecture
 *  strip. Secondary assets remain reachable via methodology and downloads. No
 *  validated/gold-benchmark or open-license claim is made. */
export function ReusableAssets() {
  return (
    <section className="card assets-section" id="assets" style={{ marginTop: 18 }}>
      <h2 className="assets-h">Reusable Scientific Assets</h2>
      <div className="assets6">
        {ASSETS.map((a) => (
          <a className="asset6" key={a.title} href={a.href} target="_blank" rel="noopener noreferrer">
            <div className="asset6-ic" aria-hidden>{a.icon}</div>
            <div className="asset6-title">{a.title}</div>
            <div className="asset6-sub">{a.sub}</div>
            {a.badge && <span className="asset6-badge">{a.badge}</span>}
          </a>
        ))}
      </div>
      <div className="arch-strip">
        {ARCH.map((s, i) => (
          <span className="arch-node" key={s}>
            <span className="arch-ic" aria-hidden>{["🧪", "🧠", "🗂️", "✓", "⚙️", "🖥️"][i]}</span>
            <span className="arch-lab">{s}</span>
            {i < ARCH.length - 1 && <span className="arch-arrow" aria-hidden>→</span>}
          </span>
        ))}
      </div>
    </section>
  );
}
