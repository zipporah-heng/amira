import { useEffect, useMemo, useState } from "react";
import { getBenchmark, getAssets, getSchema, type AssetsResponse, type SchemaResponse } from "../api";
import { AssetBadge } from "../components/DemoBadge";
import { ReusableAssets } from "../components/ReusableAssets";
import * as CS from "../criticalSignal";

/** OPEN BENCHMARK — the home for AMIRA's reusable scientific assets.
 *
 *  Every figure on this page is computed from the benchmark records the API actually
 *  serves, the schema file in the repository, and the asset manifest. Nothing is
 *  estimated, and the benchmark's real maturity is stated plainly: draft labels are
 *  pending human review and no evaluation scores are claimed until reviewed labels
 *  exist. Human-reviewed and pending records are counted separately, never merged. */

const REPO_URL = "https://github.com/zipporah-heng/amira";

/** A prefilled GitHub issue for a source-linked correction. Suggestions are proposals
 *  only — canonical records are never editable from this page, and nothing changes
 *  until a suggestion is reviewed and accepted. */
function correctionUrl(ctx: {
  benchmarkVersion?: string; datasetVersion?: string; record?: any;
}) {
  const r = ctx.record;
  const field = r?.draft_label
    ? Object.keys(r.draft_label).find((k) => k !== "expected_abstention") || ""
    : "";
  const value = field && r?.draft_label ? String(r.draft_label[field] ?? "not stated") : "";
  const body = [
    "<!-- A correction is a proposal. It does not change the benchmark until reviewed and accepted. -->",
    "",
    `**Benchmark version:** ${ctx.benchmarkVersion || ""}`,
    `**Dataset version:** ${ctx.datasetVersion || ""}`,
    `**Source ID:** ${r?.source_id || ""}`,
    `**Passage ID:** ${r?.benchmark_id || ""}`,
    `**Medicine:** ${r?.medicine || ""}`,
    `**Condition:** ${r?.condition || ""}`,
    `**Evidence field:** ${field}`,
    `**Current extracted value:** ${value}`,
    "",
    "**Proposed correction:**",
    "",
    "**Supporting source or citation:** <!-- URL, PMID, NCT id or document locator -->",
    "",
    "**Explanation:**",
    "",
    "**Reviewer name or relevant expertise (optional):**",
    "",
    r?.exact_passage ? `> Quoted passage: ${r.exact_passage}` : "",
  ].filter((l) => l !== undefined).join("\n");
  const title = r?.benchmark_id
    ? `Benchmark correction: ${r.benchmark_id}`
    : "Benchmark correction";
  return `${REPO_URL}/issues/new?labels=${encodeURIComponent("benchmark-correction")}` +
    `&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function Metric({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="ob-metric">
      <div className="ob-metric-k">{k}</div>
      <div className="ob-metric-v">{v}</div>
      {note && <div className="ob-metric-note">{note}</div>}
    </div>
  );
}

function Section({ id, letter, title, sub, children }: {
  id: string; letter: string; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <section className="ob-section" id={id} aria-labelledby={`${id}-h`}>
      <div className="ob-section-head">
        <span className="ob-letter" aria-hidden="true">{letter}</span>
        <div>
          <h2 className="ob-h" id={`${id}-h`}>{title}</h2>
          {sub && <p className="ob-sub">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function OpenBenchmark() {
  const [data, setData] = useState<any>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [assets, setAssets] = useState<AssetsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getBenchmark().then(setData).catch((e) => setErr(e.message));
    getSchema().then(setSchema).catch(() => setSchema(null));
    getAssets().then(setAssets).catch(() => setAssets(null));
  }, []);

  const items: any[] = data?.items || [];

  /** Counts derived from the records themselves — never a stored headline number. */
  const stats = useMemo(() => {
    const reviewed = items.filter((i) => i.human_verified === true);
    const pendingRecs = items.filter((i) => i.human_verified !== true);
    const sourceDocs = new Set(items.map((i) => i.source_id).filter(Boolean));
    const studies = new Set(items.map((i) => i.nct_id || i.pmid || i.source_id).filter(Boolean));
    const medicines = [...new Set(items.map((i) => i.medicine).filter(Boolean))].sort();
    return {
      passages: items.length,
      sourceDocuments: sourceDocs.size,
      studies: studies.size,
      reviewed: reviewed.length,
      pending: pendingRecs.length,
      medicines,
    };
  }, [items]);

  /** What this benchmark release actually covers, written from the records above so it
   *  can never drift from them. AMIRA reviews evidence for more medicines than the
   *  benchmark currently includes, and the difference is stated rather than implied. */
  const scopeStatement = useMemo(() => {
    if (!items.length) return null;
    const { medicines, passages, sourceDocuments, studies } = stats;
    const list = medicines.length
      ? medicines.join(", ")
      : "the medicines represented in these records";
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    return `Current published benchmark scope: ${list}. This pilot contains ` +
      `${plural(passages, "passage", "passages")} from ` +
      `${plural(sourceDocuments, "source document", "source documents")} representing ` +
      `${plural(studies, "study", "studies")}. Evidence for other medicines is available ` +
      `elsewhere in AMIRA but is not yet included in this benchmark release.`;
  }, [items, stats]);

  const evaluation = data?.evaluation;
  const evaluationPending = !evaluation || evaluation.status === "EVALUATION PENDING"
    || evaluation.clinical_accuracy == null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    // Searches every column the table actually shows.
    return items.filter((i) =>
      [i.benchmark_id, i.source_id, i.nct_id, i.pmid, i.medicine, i.condition, i.exact_passage, i.split]
        .filter(Boolean).some((f: string) => String(f).toLowerCase().includes(q)),
    ).slice(0, 30);
  }, [items, query]);

  /** Only files the asset manifest reports as genuinely present are offered. */
  const asset = (key: string) => assets?.assets.find((a) => a.key === key);
  const downloads = [
    { key: "schema", label: "Schema JSON", href: schema?.available ? "/api/schema" : null },
    { key: "benchmark", label: "Benchmark JSONL", href: asset("benchmark")?.present ? "/api/download/benchmark.jsonl" : null },
    { key: "dataset", label: "Evidence assertions CSV", href: asset("dataset")?.present ? "/api/download/evidence_assertions.csv" : null },
    { key: "dataset2", label: "Trials CSV", href: asset("dataset")?.present ? "/api/download/trials.csv" : null },
    { key: "model_card", label: "Data dictionary / model card", href: asset("model_card")?.present ? `${REPO_URL}/blob/main/docs/ai-model-card.md` : null },
    { key: "methodology", label: "Methodology document", href: asset("methodology")?.present ? `${REPO_URL}/blob/main/docs/methodology.md` : null },
  ];

  const licenseLabel = assets
    ? (assets.license_present
        ? "Apache-2.0 (code) · CC BY 4.0 (schema, docs, annotations)"
        : "License not yet specified")
    : "Loading…";

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
        PubMed, PubMed Central or a regulatory document.
      </p>
      <p className="ob-status-banner">
        Source-linked benchmark scaffold pending human review.
      </p>

      {err && <div className="callout" style={{ marginTop: 18 }}>Could not load the benchmark: {err}</div>}

      {/* ------------------------------ A. Schema ------------------------------ */}
      <Section id="ob-schema" letter="A" title="Women's Evidence Schema"
        sub={schema?.available
          ? `Version ${schema.schema_version} · ${schema.field_count} fields (${schema.required_count} required) · served from ${schema.schema_path}`
          : "Loading the canonical schema…"}>
        {schema?.available ? (
          <div className="ob-schema-table">
            <div className="ob-schema-head"><span>Field</span><span>Definition</span></div>
            {schema.fields.map((f) => (
              <div className="ob-schema-row" key={f.field}>
                <span className="ob-schema-field">
                  {f.field}
                  {f.required && <span className="ob-req" title="Required field">required</span>}
                </span>
                <span className="ob-schema-desc">{f.description || "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ob-note">The schema file could not be read from the repository.</p>
        )}
        <p className="ob-note">
          This is the same schema the extraction pipeline validates against — the interface does
          not keep a second copy.
        </p>
      </Section>

      {/* -------------------------- B. Dataset status -------------------------- */}
      <Section id="ob-status" letter="B" title="Benchmark dataset status"
        sub="Counted from the benchmark records themselves.">
        <div className="ob-metrics">
          <Metric k="Passages" v={String(stats.passages)} note="Verbatim source passages" />
          <Metric k="Source documents" v={String(stats.sourceDocuments)} note="Unique source identifiers" />
          <Metric k="Studies represented" v={String(stats.studies)} note="Distinct registry or publication records" />
          <Metric k="Human-reviewed records" v={String(stats.reviewed)} note="Named reviewer recorded" />
          <Metric k="Pending human review" v={String(stats.pending)} note="Draft labels awaiting review" />
          <Metric k="Benchmark version" v={data?.benchmark_version || "—"} />
          <Metric k={CS.REVIEWED_THROUGH_LABEL} v={data?.source_cutoff || "—"}
                  note={CS.freshness(data?.source_cutoff)?.label} />
        </div>
        {scopeStatement && <p className="ob-scope" id="ob-scope">{scopeStatement}</p>}
        <p className="ob-warn">
          Source-linked benchmark scaffold pending human review. Draft labels are rule-drafted from
          the retrieved passage; they are not gold labels, ground truth or a validated standard.
        </p>
        {data && (
          <p className="ob-note">
            Splits: {data.development ?? 0} development · {data.validation ?? 0} validation ·{" "}
            {data.held_out ?? 0} frozen held-out. Label field: <code>{data.label_field}</code>.
          </p>
        )}
      </Section>

      {/* --------------------------- C. Records list --------------------------- */}
      <Section id="ob-records" letter="C" title="Benchmark records"
        sub="Each record links back to the source document it was quoted from.">
        <input className="ob-search" type="search" value={query} placeholder="Search by id, source, passage or split…"
               onChange={(e) => setQuery(e.target.value)} aria-label="Search benchmark records" />
        <p className="ob-note">
          Showing {filtered.length} of {items.length} records.
        </p>
        <div className="ob-table-wrap">
          <table className="ob-table">
            <thead>
              <tr>
                <th>Source</th><th>Medicine</th><th>Condition</th><th>Evidence field</th>
                <th>Exact passage</th><th>Extracted value</th><th>Extraction</th><th>Human review</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const label = i.draft_label || {};
                const field = Object.keys(label).find((k) => k !== "expected_abstention") || "—";
                const value = label[field];
                return (
                  <tr key={i.benchmark_id}>
                    <td>
                      {i.source_url
                        ? <a className="ob-link" href={i.source_url} target="_blank" rel="noopener noreferrer">{i.source_id}</a>
                        : i.source_id}
                    </td>
                    <td>{i.medicine || "—"}</td>
                    <td>{i.condition || "—"}</td>
                    <td><code>{field}</code></td>
                    <td className="ob-passage">{i.exact_passage}</td>
                    <td>{value === null || value === undefined ? "not stated" : String(value)}</td>
                    <td>{i.label_provenance === "rule_drafted_from_retrieved_passage" ? "Rule-drafted" : (i.label_provenance || "—")}</td>
                    <td>
                      <span className={`ob-pill ${i.human_verified ? "ok" : "pending"}`}>
                        {i.human_verified ? `Reviewed${i.human_verifier ? ` · ${i.human_verifier}` : ""}` : "Pending"}
                      </span>
                      <a className="ob-suggest" target="_blank" rel="noopener noreferrer"
                         href={correctionUrl({ benchmarkVersion: data?.benchmark_version, datasetVersion: data?.dataset_version, record: i })}>
                        Suggest correction
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------------------- D. Methodology --------------------------- */}
      <Section id="ob-methodology" letter="D" title="Methodology"
        sub="How a published source becomes a structured, reviewable record.">
        <ol className="ob-pipeline">
          <li><span className="ob-step-n">1</span>Published source</li>
          <li><span className="ob-step-n">2</span>AMIRA Extract AI</li>
          <li><span className="ob-step-n">3</span>Women's Evidence Schema</li>
          <li><span className="ob-step-n">4</span>Exact passage validation</li>
          <li><span className="ob-step-n">5</span>Human review</li>
        </ol>
        <p className="ob-note">
          The pipeline extracts and structures what a source states and checks the quoted passage
          against the stored document. It does not perform autonomous clinical validation, and a
          record is only "reviewed" once a named human reviewer is recorded against it.
        </p>
        <a className="ob-link" href="/amira/methodology">Read the full methodology →</a>
      </Section>

      {/* ----------------------------- E. Evaluation --------------------------- */}
      <Section id="ob-evaluation" letter="E" title="Evaluation"
        sub="Only measurements that have actually been run are shown.">
        {evaluationPending ? (
          <>
            <p className="ob-warn">Formal benchmark evaluation is pending.</p>
            <p className="ob-note">
              No accuracy, precision, recall, F1 or inter-rater agreement figure is reported,
              because evaluation requires reviewed labels that do not exist yet.
            </p>
          </>
        ) : null}
        {evaluation && (
          <div className="ob-metrics" style={{ marginTop: 14 }}>
            <Metric k="Status" v={String(evaluation.status)} />
            <Metric k="Measurement type" v={String(evaluation.evaluation_type || "—")}
                    note="Process metrics describe the pipeline, not clinical correctness" />
            <Metric k="Passages checked" v={String(evaluation.corpus_passages_evaluated ?? "—")} />
            <Metric k="Schema validity rate"
                    v={evaluation.schema_validity_rate != null ? `${Math.round(evaluation.schema_validity_rate * 100)}%` : "—"}
                    note="Extractions conforming to the schema" />
            <Metric k="Quote verification rate"
                    v={evaluation.quote_verification_rate != null ? `${Math.round(evaluation.quote_verification_rate * 100)}%` : "—"}
                    note="Passages matched against the stored document" />
            <Metric k="Clinical accuracy" v={evaluation.clinical_accuracy == null ? "Not measured" : String(evaluation.clinical_accuracy)} />
            <Metric k="Macro F1" v={evaluation.macro_f1 == null ? "Not measured" : String(evaluation.macro_f1)} />
          </div>
        )}
      </Section>

      {/* ----------------------------- F. Downloads ---------------------------- */}
      <Section id="ob-downloads" letter="F" title="Downloadable assets"
        sub="Generated from canonical repository data. Anything not yet published says so.">
        <div className="ob-downloads">
          {downloads.map((d) => (
            <div className="ob-dl" key={d.key}>
              <span className="ob-dl-label">{d.label}</span>
              {d.href
                ? <a className="ob-dl-btn" href={d.href}>⬇ Download</a>
                : <span className="ob-dl-none">Not yet published</span>}
            </div>
          ))}
        </div>
        <p className="ob-note">
          Downloads are produced from the same records this page reports — benchmark
          version {data?.benchmark_version || "—"}, dataset {data?.dataset_version || "—"}.
        </p>
      </Section>

      {/* --------------------- G. Versioning + reproducibility ------------------ */}
      <Section id="ob-versioning" letter="G" title="Versioning and reproducibility"
        sub="What exactly you are looking at, and how to reproduce it.">
        <div className="ob-metrics">
          <Metric k="Benchmark version" v={data?.benchmark_version || "—"} />
          <Metric k="Dataset version" v={data?.dataset_version || "—"} />
          <Metric k={CS.REVIEWED_THROUGH_LABEL} v={data?.source_cutoff || "—"}
                  note={CS.freshness(data?.source_cutoff)?.label} />
          <Metric k="Repository commit" v={String(data?.commit_hash || "—").slice(0, 10)} />
          <Metric k="Last updated" v={data?.generated_at ? String(data.generated_at).slice(0, 10) : "—"} />
          <Metric k="Human-review status"
                  v={stats.reviewed > 0 ? `${stats.reviewed} of ${stats.passages} reviewed` : "Pending"} />
        </div>
        <p className="ob-note">License: {licenseLabel}</p>
        {assets?.honest_status?.length ? (
          <ul className="ob-honest">
            {assets.honest_status.map((s) => <li key={s}>{s}</li>)}
          </ul>
        ) : null}
      </Section>

      {/* -------------------------- H. Researcher actions ---------------------- */}
      <Section id="ob-actions" letter="H" title="For researchers"
        sub="Inspect, reproduce and reuse the assets. These actions are separate from clinical evidence checking.">
        <div className="ob-actions">
          <a className="cmp-btn" href={REPO_URL} target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
          <a className="cmp-btn" href="/amira/methodology">Review methodology</a>
          <a className="cmp-btn" href="#ob-downloads">Download available assets</a>
          <a className="cmp-btn" href="#ob-records">Inspect evidence records</a>
          <a className="cmp-btn primary" target="_blank" rel="noopener noreferrer"
             href={correctionUrl({ benchmarkVersion: data?.benchmark_version, datasetVersion: data?.dataset_version })}>
            Suggest a correction ↗
          </a>
        </div>
        <p className="ob-note">
          Researchers can inspect a record and submit a source-linked correction for review.
          Suggested changes do not alter the benchmark until they are reviewed and accepted.
        </p>
      </Section>

      <ReusableAssets />

      {data && (
        <p className="disclaimer" style={{ marginTop: 18 }}>
          Dataset v{data.dataset_version} · benchmark v{data.benchmark_version} · source cutoff{" "}
          {data.source_cutoff} · commit {String(data.commit_hash || "").slice(0, 7)}
        </p>
      )}
    </div>
  );
}
