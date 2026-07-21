import { useEffect, useState } from "react";
import { getAiPipeline, getAiPassages, runExtraction,
  type AiPipeline as Pipeline, type AiPassage, type ExtractResponse } from "../api";

/** The full interactive "Analyze an evidence passage" demonstration, moved off
 *  the main page into a drawer. Honest recorded-provider labels; source-match and
 *  human-review states shown verbatim. */

const MATCH_META: Record<string, { label: string; tone: string }> = {
  source_passage_matched: { label: "Source passage matched", tone: "present" },
  stored_excerpt_matched: { label: "Stored evidence excerpt matched", tone: "present" },
  source_match_unavailable: { label: "Source match unavailable", tone: "unclear" },
  quarantined: { label: "Quarantined — rejected", tone: "missing" },
  human_reviewed: { label: "Human reviewed", tone: "present" },
};
const HUMAN_META: Record<string, { label: string; tone: string }> = {
  not_reviewed: { label: "Human verification pending", tone: "unclear" },
  in_review: { label: "In human review", tone: "unclear" },
  human_verified: { label: "Human verified", tone: "present" },
};
const FIELDS: [keyof ExtractResponse["extraction"], string][] = [
  ["women_represented", "Women represented"], ["women_count", "Women count"], ["women_percentage", "Women %"],
  ["sex_specific_effectiveness", "Sex-specific effectiveness"], ["formal_sex_comparison", "Formal sex comparison"],
  ["interaction_statistic", "Interaction statistic"], ["sex_specific_safety", "Sex-specific safety"],
  ["menopause", "Menopause"], ["hormone_therapy", "Hormone therapy"], ["evidence_state", "Evidence state"],
];

export function EvidenceTraceDrawer({ medicine, onClose }: { medicine: string; onClose: () => void }) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [passages, setPassages] = useState<AiPassage[]>([]);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    getAiPipeline().then(setPipeline).catch(() => {});
    getAiPassages().then((d) => {
      setPassages(d.passages);
      const pref = d.passages.find((p) => p.medicine === medicine) || d.passages[0];
      if (pref) { setSelected(pref.passage_id); runExtraction(pref.passage_id).then(setResult).catch(() => {}); }
    }).catch(() => {});
  }, [medicine]);

  const analyze = async (id: string) => {
    setSelected(id); setRunning(true);
    try { setResult(await runExtraction(id)); } catch { setResult(null); } finally { setRunning(false); }
  };

  const ex = result?.extraction;
  const chosen = passages.find((p) => p.passage_id === selected);
  const recorded = pipeline?.provider.is_recorded ?? true;

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer wide" role="dialog" aria-label="Evidence trace">
        <div className="dr-head">
          <div>
            <div className="section-title">Evidence trace</div>
            <h2 style={{ fontSize: 18, marginTop: 6 }}>
              {recorded ? "Recorded AMIRA-Extract demonstration" : "Live AMIRA-Extract"}
            </h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dr-body">
          {pipeline && <p className="muted" style={{ marginTop: 0 }}>{pipeline.recorded_note}</p>}
          {pipeline && (
            <div className="provider-panel">
              <div><span className="pp-k">Provider</span> {pipeline.provider.provider_label}</div>
              <div><span className="pp-k">Model</span> {pipeline.provider.model || "n/a"}</div>
              <div><span className="pp-k">Live model call</span> {recorded ? "No" : "Yes (when run)"}</div>
              <div><span className="pp-k">Schema</span> v{pipeline.provider.schema_version}</div>
            </div>
          )}

          <div className="demo-controls" style={{ marginTop: 14 }}>
            <select value={selected} onChange={(e) => analyze(e.target.value)} aria-label="Choose a passage">
              {passages.map((p) => <option key={p.passage_id} value={p.passage_id}>{p.label}</option>)}
            </select>
            <button className="cta" disabled={running || !selected} onClick={() => analyze(selected)}>
              {running ? (recorded ? "Running recorded extraction…" : "Calling live model…")
                       : (recorded ? "Run recorded extraction" : "Run live extraction")}
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
                  <span className={`wf-badge ${(MATCH_META[ex.source_match_state] || {}).tone || "neutral"}`}>
                    {(MATCH_META[ex.source_match_state] || {}).label || ex.source_match_state}</span>
                  <span className={`wf-badge ${(HUMAN_META[ex.human_review_state] || {}).tone || "unclear"}`}>
                    {(HUMAN_META[ex.human_review_state] || {}).label || ex.human_review_state}</span>
                </div>
              </div>
              <div className="trace-fields">
                {FIELDS.map(([k, label]) => {
                  const v = ex[k];
                  const shown = (v === null || v === undefined || v === "") ? "null / not reported" : String(v).replace(/_/g, " ");
                  return <div className="trace-field" key={String(k)}><span className="tf-k">{label}</span><span className="tf-v">{shown}</span></div>;
                })}
              </div>
              <div className="trace-meta">
                <span>Trial: <b>{ex.trial_id}</b></span>
                <span>Source doc: <b>{ex.source_document_id}</b></span>
                <span>Live call: <b>{ex.live_model_call ? "Yes" : "No"}</b></span>
                <span>Hash: <b>{ex.provenance.content_hash.slice(0, 16)}…</b></span>
              </div>
              {ex.validation_notes && <div className="trace-notes">{ex.validation_notes}</div>}
              <button className="rd-toggle" onClick={() => setShowJson((v) => !v)}>
                {showJson ? "Hide" : "Show"} structured JSON output</button>
              {showJson && <pre className="json-block">{JSON.stringify(ex, null, 2)}</pre>}
              <div className="if-src" style={{ marginTop: 12 }}>
                <span className="muted">Matched against AMIRA's stored excerpt (not the full publication)</span>
                <a href={ex.source_url} target="_blank" rel="noopener noreferrer">Open source ↗</a>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
