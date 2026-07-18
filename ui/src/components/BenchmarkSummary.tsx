import { Link } from "react-router-dom";
import { fixture } from "../fixture";
import { AssetBadge, DemoBadge } from "./DemoBadge";

export function BenchmarkSummary() {
  const d = fixture.dataset_summary;
  const cards = [
    { num: String(d.structured_studies), lab: "Structured studies" },
    { num: String(d.evidence_passages), lab: "Evidence passages" },
    { num: String(d.human_labeled_benchmark_examples), lab: "Human-labeled benchmark examples" },
    { num: d.extraction_accuracy, lab: "Extraction accuracy" },
    { num: String(d.hormonal_evidence_dimensions), lab: "Hormonal evidence dimensions" },
    { num: d.license, lab: "License" },
  ];

  return (
    <div className="asset-band">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow">Our reusable scientific asset</span>
        <AssetBadge />
        <DemoBadge />
      </div>
      <h2 className="page-q" style={{ fontSize: 24, margin: "10px 0 6px" }}>
        The AMIRA Open Women's Hormonal Evidence Dataset and Benchmark
      </h2>
      <p style={{ maxWidth: 720, fontSize: 15 }}>
        AMIRA turns fragmented women's health research into standardized, machine-readable
        evidence that researchers can download, extend, and use to evaluate future AI systems.
      </p>
      <div className="summary-cards">
        {cards.map((c) => (
          <div className="summary-card" key={c.lab}>
            <div className="sc-num">{c.num}</div>
            <div className="sc-lab">{c.lab}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <Link to="/amira/open-benchmark" className="cta" style={{ display: "inline-block", textDecoration: "none" }}>
          EXPLORE THE OPEN BENCHMARK →
        </Link>
      </div>
    </div>
  );
}
