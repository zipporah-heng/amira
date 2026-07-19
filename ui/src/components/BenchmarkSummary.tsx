import { Link } from "react-router-dom";
import type { EvidenceResponse } from "../api";
import { AssetBadge } from "./DemoBadge";

export function BenchmarkSummary({ report }: { report: EvidenceResponse }) {
  const assertions = report.trials.flatMap((t) => t.assertions).length;
  const items = [
    { icon: "🗄️", num: String(report.trials.length), lab: "trials ingested" },
    { icon: "📄", num: String(assertions), lab: "evidence assertions" },
    { icon: "🔗", num: String(report.sources.length), lab: "primary sources" },
    { icon: "🎯", num: report.evaluation_status || "EVALUATION PENDING", lab: "model evaluation" },
    { icon: "🔓", num: "Open", lab: "registry data public domain" },
  ];

  return (
    <div className="asset-band">
      <div className="asset-head">
        <h2 className="asset-title">The AMIRA Open Women's Hormonal Evidence Benchmark</h2>
        <AssetBadge label="Our reusable asset" />
      </div>
      <div className="asset-grid">
        {items.map((it) => (
          <div className="asset-item" key={it.lab}>
            <span className="asset-ic">{it.icon}</span>
            <div>
              <div className="asset-num" style={{ fontSize: it.num.length > 6 ? 13 : 22 }}>{it.num}</div>
              <div className="asset-lab">{it.lab}</div>
            </div>
          </div>
        ))}
        <div className="asset-copy">
          <p>
            AMIRA turns fragmented research into a standardized, machine-readable evidence
            foundation so researchers can build better studies and better care for women.
          </p>
          <Link to="/amira/open-benchmark" className="rail-link">Explore the Benchmark →</Link>
        </div>
      </div>
      <p className="disclaimer" style={{ marginTop: 12 }}>
        Dataset v{report.dataset_version} · source cutoff {report.source_cutoff} ·
        commit {report.commit_hash.slice(0, 7)}. Every figure is reproducible from the
        published dataset.
      </p>
    </div>
  );
}
