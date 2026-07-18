import { Link } from "react-router-dom";
import { fixture } from "../fixture";
import { AssetBadge, DemoBadge } from "./DemoBadge";

export function BenchmarkSummary() {
  const d = fixture.dataset_summary;
  const items = [
    { icon: "🗄️", num: String(d.structured_studies), lab: "structured studies", note: "processed" },
    { icon: "📄", num: String(d.evidence_passages), lab: "evidence passages", note: "human-labeled" },
    { icon: "🎯", num: d.extraction_accuracy, lab: "extraction accuracy", note: "evaluation" },
    { icon: "🧬", num: String(d.hormonal_evidence_dimensions), lab: "hormonal dimensions", note: "standardized schema" },
    { icon: "🔓", num: d.license, lab: "open license", note: "reuse terms" },
  ];

  return (
    <div className="asset-band">
      <div className="asset-head">
        <h2 className="asset-title">The AMIRA Open Women's Hormonal Evidence Benchmark</h2>
        <AssetBadge label="Our reusable asset" />
        <DemoBadge />
      </div>
      <div className="asset-grid">
        {items.map((it) => (
          <div className="asset-item" key={it.lab}>
            <span className="asset-ic">{it.icon}</span>
            <div>
              <div className="asset-num">{it.num}</div>
              <div className="asset-lab">{it.lab}</div>
            </div>
          </div>
        ))}
        <div className="asset-copy">
          <p>
            AMIRA turns fragmented research into a standardized, machine-readable evidence
            foundation so researchers worldwide can build better studies and better care for
            women.
          </p>
          <Link to="/amira/open-benchmark" className="rail-link">Explore the Benchmark →</Link>
        </div>
      </div>
      <p className="disclaimer" style={{ marginTop: 12 }}>
        Demo scope: values reflect the current prototype dataset. Extraction accuracy is pending
        evaluation and the license is to be determined — no benchmark scores are claimed yet.
      </p>
    </div>
  );
}
