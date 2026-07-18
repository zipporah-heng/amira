import { benchmarkJsonl, downloadText } from "../download";
import { fixture } from "../fixture";
import { DemoBadge } from "./DemoBadge";

export function BenchmarkDownloadCard() {
  const b = fixture.benchmark;
  return (
    <div className="dl-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3>The Benchmark</h3>
        <DemoBadge />
      </div>
      <p>
        The benchmark is a human-labeled subset used to measure how accurately AI extracts
        women's hormonal evidence from research. {b.total} examples — {b.development}{" "}
        development, {b.validation} validation, {b.held_out} held-out test.
      </p>
      <div className="code-cols">
        {b.fields_evaluated.map((f) => (
          <span className="code-col" key={f}>{f}</span>
        ))}
      </div>
      <div className="dl-btns">
        <button className="dl-btn" onClick={() => downloadText("amira_benchmark.jsonl", benchmarkJsonl(), "application/x-ndjson")}>
          ⬇ Download Benchmark
        </button>
        <button className="dl-btn ghost" onClick={() => downloadText("amira_benchmark_train.jsonl", benchmarkJsonl("development"), "application/x-ndjson")}>
          ⬇ Train
        </button>
        <button className="dl-btn ghost" onClick={() => downloadText("amira_benchmark_validation.jsonl", benchmarkJsonl("validation"), "application/x-ndjson")}>
          ⬇ Validation
        </button>
        <button className="dl-btn ghost" onClick={() => downloadText("amira_benchmark_test.jsonl", benchmarkJsonl("test"), "application/x-ndjson")}>
          ⬇ Test
        </button>
      </div>
    </div>
  );
}
