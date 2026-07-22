import { useEffect, useState } from "react";
import { getBenchmark } from "../api";
import { AssetBadge } from "../components/DemoBadge";

const DATASET_COLUMNS = [
  "assertion_id", "trial_id", "dimension", "value", "value_basis", "source_id",
  "source_type", "nct_id", "pmid", "pmcid", "source_url", "exact_passage",
  "source_locator", "source_verified", "human_verified", "verifier", "retrieved_at",
];

export function OpenBenchmark() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getBenchmark().then(setData).catch((e) => setErr(e.message));
  }, []);

  const evaluation = data?.evaluation;
  const pending = !evaluation || evaluation.status === "EVALUATION PENDING";

  return (
    <div className="open-benchmark-page">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="eyebrow">Open AMIRA Benchmark</span>
        <AssetBadge />
      </div>
      <h1 className="page-q">AMIRA Open Women's Hormonal Evidence Dataset and Benchmark</h1>
      <p className="page-sub">
        A reusable, machine-readable foundation for studying how clinical research represents
        women's biological and hormonal contexts. Every record traces to ClinicalTrials.gov,
        PubMed or PubMed Central.
      </p>

      {err && <div className="callout" style={{ marginTop: 18 }}>Could not load the benchmark: {err}</div>}

      <div className="download-grid">
        <div className="dl-card">
          <h3>The Dataset</h3>
          <p>
            Normalized trials and evidence assertions, exported from the same normalized records
            the API serves through one canonical verified-evidence gate. A value appears only when
            its assertion is conflict-free, carries a supported basis, and resolves to a verified
            authoritative source; otherwise its evidence state (not reported / not located /
            unavailable / conflicting / unverified) is shown instead. A value in one surface is
            never stronger than the evidence behind it.
          </p>
          <div className="code-cols">
            {DATASET_COLUMNS.map((c) => <span className="code-col" key={c}>{c}</span>)}
          </div>
          <div className="dl-btns">
            <a className="dl-btn" href="/api/download/evidence_assertions.csv">⬇ Download CSV</a>
            <a className="dl-btn" href="/api/download/evidence_assertions.jsonl">⬇ Download JSONL</a>
            <a className="dl-btn ghost" href="/api/download/trials.csv">⬇ Trials CSV</a>
            <a className="dl-btn ghost" href="/api/download/trials.jsonl">⬇ Trials JSONL</a>
          </div>
        </div>

        <div className="dl-card">
          <h3>The Benchmark</h3>
          <p>
            {data
              ? `${data.total ?? (data.items?.length ?? 0)} verbatim source passages — ` +
                `${data.development ?? 0} development, ${data.validation ?? 0} validation, ` +
                `${data.held_out ?? 0} frozen held-out test.`
              : "Loading…"}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 8 }}>
            Each item carries a benchmark ID, source ID, NCT/PMID/PMCID where applicable, the
            exact passage, <strong>draft label</strong>, split, annotation status and verifier.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--amber)", marginTop: 8 }}>
            Draft labels are rule-drafted from the retrieved passage and are{" "}
            <strong>awaiting independent human review</strong> ({data?.human_verified_items ?? 0} of{" "}
            {data?.total ?? 0} human-verified). They are provisional, not gold labels or ground truth.
          </p>
          <div className="dl-btns">
            <a className="dl-btn" href="/api/download/benchmark.jsonl">⬇ Download Benchmark</a>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="section-title">Evaluation</div>
        {pending ? (
          <>
            <p style={{ marginTop: 10, fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>
              EVALUATION PENDING
            </p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              {evaluation?.note ||
                "No extractor run has been executed against the frozen held-out split yet. " +
                "AMIRA publishes no accuracy figures until a real evaluation exists."}
            </p>
            <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
              When published, results will identify: model, prompt version, dataset version,
              source cutoff, test split and commit hash.
            </p>
          </>
        ) : (
          <div className="eval-grid">
            {Object.entries(evaluation.metrics || {}).map(([k, v]) => (
              <div className="eval-card" key={k}>
                <div className="ev-val">{String(v)}</div>
                <div className="ev-lab">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="section-title">Benchmark completion protocol</div>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          The benchmark is <strong>prepared for human validation</strong>; it has not yet been
          validated. Before any evaluation result may be published:
        </p>
        <ol style={{ marginTop: 8, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          <li>Two independent reviewers label each passage against the schema.</li>
          <li>Disagreements are adjudicated and resolved.</li>
          <li>Reviewer identities and review dates are recorded on each item.</li>
          <li>Only then is the extractor evaluated against the reviewed labels and results published.</li>
        </ol>
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-3)" }}>
          Current status: draft labels only · no reviewers assigned · no dates recorded ·
          no agreement or accuracy scores exist yet.
        </p>
      </div>

      {data?.items?.length > 0 && (
        <div className="card" style={{ marginTop: 22 }}>
          <div className="section-title">Sample benchmark passages</div>
          <div className="tbl-wrap">
            <table className="studies">
              <thead>
                <tr><th>ID</th><th>Split</th><th>Source</th><th>Draft label</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.items.slice(0, 8).map((it: any) => (
                  <tr key={it.benchmark_id}>
                    <td className="td-name">{it.benchmark_id}</td>
                    <td>{it.split}</td>
                    <td>
                      <a href={it.source_url} target="_blank" rel="noopener noreferrer" className="src-link">
                        {it.pmid ? `PMID ${it.pmid}` : it.nct_id} ↗
                      </a>
                    </td>
                    <td>
                      {Object.entries(it.draft_label || it.gold_label || {})
                        .filter(([, v]) => v !== null && v !== "not_reported" && v !== false)
                        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                        .join("; ") || "no women's-evidence signal"}
                    </td>
                    <td>{it.annotation_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <p className="disclaimer" style={{ marginTop: 18 }}>
          Dataset v{data.dataset_version} · source cutoff {data.source_cutoff} ·
          commit {String(data.commit_hash || "").slice(0, 7)}
        </p>
      )}
    </div>
  );
}
