import { DatasetDownloadCard } from "../components/DatasetDownloadCard";
import { BenchmarkDownloadCard } from "../components/BenchmarkDownloadCard";
import { AssetBadge, DemoBadge } from "../components/DemoBadge";
import { fixture } from "../fixture";

export function OpenBenchmark() {
  const b = fixture.benchmark;
  const evalItems = [
    { lab: "Benchmark size", val: String(b.total) },
    { lab: "Development examples", val: String(b.development) },
    { lab: "Validation examples", val: String(b.validation) },
    { lab: "Held-out examples", val: String(b.held_out) },
    { lab: "Field-level accuracy", val: b.evaluation.field_level_accuracy },
    { lab: "Macro-F1", val: b.evaluation.macro_f1 },
    { lab: "Citation support accuracy", val: b.evaluation.citation_support_accuracy },
    { lab: "Abstention accuracy", val: b.evaluation.abstention_accuracy },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow">Open AMIRA Benchmark</span>
        <AssetBadge />
        <DemoBadge />
      </div>
      <h1 className="page-q">AMIRA Open Women's Hormonal Evidence Dataset and Benchmark</h1>
      <p className="page-sub">
        A reusable, machine-readable foundation for studying how clinical research represents
        women's biological and hormonal contexts.
      </p>

      {/* Section 1: dataset + section 2: benchmark */}
      <div className="download-grid">
        <DatasetDownloadCard />
        <BenchmarkDownloadCard />
      </div>

      {/* Section 3: evaluation — no fabricated scores */}
      <div className="card" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="section-title">Evaluation</div>
          <DemoBadge />
        </div>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          Evaluation runs against the human-labeled benchmark. No scores are claimed until a
          real evaluation has been run.
        </p>
        <div className="eval-grid">
          {evalItems.map((e) => (
            <div className="eval-card" key={e.lab}>
              <div className="ev-val">{e.val}</div>
              <div className="ev-lab">{e.lab}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full package download */}
      <div className="asset-band" style={{ marginTop: 22 }}>
        <span className="eyebrow">Downloadable sample package</span>
        <h2 style={{ fontSize: 20, margin: "8px 0 6px" }}>amira-open-evidence-v1-demo</h2>
        <p style={{ maxWidth: 720, fontSize: 14.5 }}>
          One archive with the dataset (CSV + JSONL), the benchmark splits, the schema, a
          README, and dataset documentation. Every file is labeled:
          <em> "Demo data for hackathon prototype. Not validated clinical evidence."</em>
        </p>
        <div className="dl-btns" style={{ marginTop: 16 }}>
          <a className="dl-btn" href="/downloads/amira-open-evidence-v1-demo.zip" download>
            ⬇ Download full sample package (ZIP)
          </a>
          <a className="dl-btn ghost" href="/downloads/amira_evidence_dataset.csv" download>⬇ dataset.csv</a>
          <a className="dl-btn ghost" href="/downloads/amira_benchmark.jsonl" download>⬇ benchmark.jsonl</a>
          <a className="dl-btn ghost" href="/downloads/amira_evidence_schema.json" download>⬇ schema.json</a>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 22 }}>
        This is the reusable scientific asset underneath AMIRA. The Check the Evidence app
        demonstrates why the foundation matters; the dataset and benchmark are what
        researchers can download, extend, and evaluate against.
      </div>
    </div>
  );
}
