import { useEffect, useState } from "react";
import {
  getAiPipeline, getAiPassages, runExtraction,
  type AiPipeline as Pipeline, type AiPassage, type ExtractResponse,
} from "../api";

/** Sections 7 & 8 — "How AMIRA found this evidence" + the controlled
 *  "Analyze an evidence passage" demonstration.
 *
 *  Honesty rules (correction mission):
 *   - The default provider is the offline RECORDED provider. It is labelled a
 *     "Recorded AMIRA-Extract demonstration" — never "AI is analyzing now" or
 *     "Live AI". The button says "Run recorded extraction".
 *   - Provider, model, and "Live model call: No/Yes" are shown prominently.
 *   - "Stored evidence excerpt matched" is shown (not "Exact passage verified"),
 *     because AMIRA validates against its stored excerpt, not the full original
 *     publication.
 *   - No fake confidence percentages. */

const MATCH_META: Record<string, { label: string; tone: string }> = {
  source_passage_matched: { label: "Source passage matched", tone: "present" },
  stored_excerpt_matched: { label: "Stored evidence excerpt matched", tone: "present" },
  source_match_unavailable: { label: "Source match unavailable", tone: "unclear" },
  quarantined: { label: "Quarantined — rejected", tone: "missing" },
  human_reviewed: { label: "Human reviewed", tone: "present" },
};

const HUMAN_STATE_META: Record<string, { label: string; tone: string }> = {
  not_reviewed: { label: "Human verification pending", tone: "unclear" },
  in_review: { label: "In human review", tone: "unclear" },
  human_verified: { label: "Human verified", tone: "present" },
};

const FIELD_ORDER: [keyof ExtractResponse["extraction"], string][] = [
  ["women_represented", "Women represented"],
  ["women_count", "Women count"],
  ["women_percentage", "Women %"],
  ["sex_specific_effectiveness", "Sex-specific effectiveness"],
  ["formal_sex_comparison", "Formal sex comparison"],
  ["interaction_statistic", "Interaction statistic"],
  ["sex_specific_safety", "Sex-specific safety"],
  ["menopause", "Menopause"],
  ["hormone_therapy", "Hormone therapy"],
  ["pregnancy", "Pregnancy"],
  ["age", "Age (fact only)"],
  ["evidence_state", "Evidence state"],
];

function Badge({ meta }: { meta: { label: string; tone: string } }) {
  return <span className={`wf-badge ${meta.tone}`}>{meta.label}</span>;
}

export function AiPipeline({ initialMedicine }: { initialMedicine?: string }) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [passages, setPassages] = useState<AiPassage[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    getAiPipeline().then(setPipeline).catch(() => setPipeline(null));
    getAiPassages()
      .then((d) => {
        setPassages(d.passages);
        const pref = d.passages.find((p) => p.medicine === initialMedicine) || d.passages[0];
        if (pref) {
          setSelected(pref.passage_id);
          runExtraction(pref.passage_id).then(setResult).catch(() => setResult(null));
        }
      })
      .catch(() => setPassages([]));
  }, [initialMedicine]);

  const analyze = async (id: string) => {
    setSelected(id);
    setRunning(true);
    try { setResult(await runExtraction(id)); }
    catch { setResult(null); }
    finally { setRunning(false); }
  };

  if (!pipeline) return null;
  const ex = result?.extraction;
  const chosen = passages.find((p) => p.passage_id === selected);
  const recorded = pipeline.provider.is_recorded;
  const buttonLabel = running
    ? (recorded ? "Running recorded extraction…" : "Calling live model…")
    : (recorded ? "Run recorded extraction" : "Run live extraction");

  return (
    <section className="card ai-pipeline" id="ai-pipeline" style={{ marginTop: 22 }}>
      <div className="section-title">How AMIRA found this evidence</div>
      <p className="muted" style={{ marginTop: 6, maxWidth: 700 }}>
        Public sources in, structured and validated evidence out. The model extracts per passage; a
        deterministic engine scores. Every claim is quote-checked against its stored source excerpt.
      </p>

      <div className="pipe-flow">
        {pipeline.stages.map((s, i) => (
          <div className="pipe-step" key={s.key}>
            <div className="pipe-n">{i + 1}</div>
            <div>
              <div className="pipe-label">{s.label}</div>
              <div className="pipe-detail">{s.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="pipe-safety">
        <div className="section-title">Hallucination &amp; inference safeguards</div>
        <ul>{pipeline.safety.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>

      {/* Section 8 — controlled demonstration */}
      <div className="demo" id="ai-demo">
        <div className="section-title">
          {recorded ? "Recorded AMIRA-Extract demonstration" : "Live AMIRA-Extract"}
        </div>
        <p className="muted" style={{ marginTop: 6 }}>{pipeline.recorded_note}</p>

        <div className="provider-panel">
          <div><span className="pp-k">Provider</span> {pipeline.provider.provider_label}</div>
          <div><span className="pp-k">Model</span> {pipeline.provider.model || "n/a"}</div>
          <div><span className="pp-k">Live model call</span> {recorded ? "No" : (pipeline.provider.live_capable ? "Yes (when run)" : "Not configured")}</div>
          <div><span className="pp-k">Schema</span> v{pipeline.provider.schema_version} · prompt {pipeline.provider.prompt_version}</div>
        </div>

        <div className="demo-controls">
          <select value={selected} onChange={(e) => analyze(e.target.value)} aria-label="Choose a passage to analyze">
            {passages.map((p) => <option key={p.passage_id} value={p.passage_id}>{p.label}</option>)}
          </select>
          <button className="cta" disabled={running || !selected} onClick={() => analyze(selected)}>
            {buttonLabel}
          </button>
        </div>

        {chosen && (
          <div className="demo-input">
            <div className="demo-k">Input passage · {chosen.study_identifier} · {chosen.source_document_id}</div>
            <blockquote className="passage">"{chosen.passage}"</blockquote>
          </div>
        )}

        {ex && result && (
          <div className="trace">
            <div className="trace-head">
              <div className="trace-q"><b>Question:</b> {result.question}</div>
              <div className="trace-badges">
                <Badge meta={MATCH_META[ex.source_match_state] || { label: ex.source_match_state, tone: "neutral" }} />
                <Badge meta={HUMAN_STATE_META[ex.human_review_state] || { label: ex.human_review_state, tone: "unclear" }} />
              </div>
            </div>

            <div className="trace-fields">
              {FIELD_ORDER.map(([k, label]) => {
                const v = ex[k];
                const shown = (v === null || v === undefined || v === "") ? "null / not reported" : String(v).replace(/_/g, " ");
                return (
                  <div className="trace-field" key={String(k)}>
                    <span className="tf-k">{label}</span>
                    <span className="tf-v">{shown}</span>
                  </div>
                );
              })}
            </div>

            <div className="trace-meta">
              <span>Trial: <b>{ex.trial_id}</b></span>
              <span>Source doc: <b>{ex.source_document_id}</b></span>
              <span>Model: <b>{ex.extraction_model}</b></span>
              <span>Live call: <b>{ex.live_model_call ? "Yes" : "No"}</b></span>
              <span>Passage hash: <b>{ex.provenance.content_hash.slice(0, 16)}…</b></span>
            </div>
            {ex.validation_notes && <div className="trace-notes">{ex.validation_notes}</div>}

            {result.score_impact?.scored && (
              <div className="trace-impact">
                <span className="section-title">Deterministic score impact</span>
                <p className="muted" style={{ marginTop: 4 }}>
                  This medicine's pilot readiness score is <b>{result.score_impact.score}/100</b>, computed by
                  the deterministic engine from validated evidence like this — not from the model's opinion.
                </p>
              </div>
            )}

            <button className="rd-toggle" onClick={() => setShowJson((v) => !v)}>
              {showJson ? "Hide" : "Show"} structured JSON output
            </button>
            {showJson && <pre className="json-block">{JSON.stringify(ex, null, 2)}</pre>}

            <div className="if-src" style={{ marginTop: 12 }}>
              <span className="muted">Source: {ex.source_document_id} · matched against AMIRA's stored excerpt (not the full publication)</span>
              <a href={ex.source_url} target="_blank" rel="noopener noreferrer">Open source ↗</a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
