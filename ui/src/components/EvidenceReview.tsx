import { useState } from "react";
import type { EvidenceResponse } from "../api";
import * as M from "../evidenceModel";
import { buildEvidenceBriefPdf, evidenceBriefFilename, downloadBlob } from "../pdf";
import { maturityChecklist, MATURITY_ANCHOR } from "../maturityLevels";

/** The approved Check Evidence review: a section navigation beside the evidence
 *  sections, in the approved order.
 *
 *  Every value comes from ui/src/evidenceModel.ts — the same layer the PDF export
 *  reads — so the page and the brief can never disagree. Nothing here invents a
 *  medical claim: canonical states are rendered verbatim, and a missing analysis
 *  stays missing rather than becoming evidence of no difference. */

export const SECTIONS = [
  { id: "evidence-summary", label: "Evidence Summary" },
  { id: "women-in-the-evidence", label: "Women in the Evidence" },
  { id: "sex-specific-effectiveness", label: "Sex-specific Effectiveness" },
  { id: "women-specific-safety", label: "Women-specific Safety" },
  { id: "common-adverse-effects", label: "Common Adverse Effects" },
  { id: "life-stage-evidence", label: "Life-stage Evidence" },
  { id: "hormonal-context", label: "Hormonal Context" },
  { id: "exact-passages", label: "Exact Passages" },
  { id: "source-coverage", label: "Source Coverage" },
  { id: "about-this-evidence-review", label: "About This Evidence Review" },
];

const SECTION_SUB: Record<string, string> = {
  "evidence-summary": "Counts and analysis",
  "women-in-the-evidence": "Counts and analysis",
  "sex-specific-effectiveness": "What the research shows",
  "women-specific-safety": "What the research shows",
  "common-adverse-effects": "From reviewed sources",
  "life-stage-evidence": "Across the lifespan",
  "hormonal-context": "Menopause and hormone therapy",
  "exact-passages": "What the sources say",
  "source-coverage": "Studies and reviews",
  "about-this-evidence-review": "Methods and limitations",
};

/** An evidence state chip. The tone drives colour, but the text label is always
 *  present — state is never communicated by colour alone. */
export function StateChip({ cell }: { cell: M.EvidenceCell }) {
  return (
    <span className={`ev-chip ${cell.tone}`}>
      <span className="ev-chip-glyph" aria-hidden="true">
        {cell.tone === "reported" ? "✓" : cell.tone === "limited" ? "!" : cell.tone === "not_reported" ? "✕" : "?"}
      </span>
      {cell.label}
    </span>
  );
}

function Section({ id, title, sub, children }: {
  id: string; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <section className="ev-section card" id={id} aria-labelledby={`${id}-h`}>
      <h2 className="ev-section-h" id={`${id}-h`}>{title}</h2>
      {sub && <p className="ev-section-sub">{sub}</p>}
      {children}
    </section>
  );
}

function MetricCard({ label, value, tone, note }: {
  label: string; value: string; tone: M.StateTone; note?: string;
}) {
  return (
    <div className="ev-metric">
      <div className="ev-metric-k">{label}</div>
      <div className={`ev-metric-v ${tone}`}>{value}</div>
      {note && <div className="ev-metric-note">{note}</div>}
    </div>
  );
}

export function EvidenceReview({ report, signalCard }: {
  report: EvidenceResponse;
  /** The verified critical-signal presentation for this medicine, when one exists. */
  signalCard?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const mat = M.maturity(report);
  const pop = M.evidencePopulation(report);
  const ae = M.commonAdverseEffects(report);
  const hc = M.hormonalContext(report);
  const passages = M.exactPassages(report);
  const sources = M.sourceRecords(report);
  const checklist = mat.scorable ? maturityChecklist(mat.level) : [];

  const jump = (id: string) => {
    const el = document.getElementById(id);
    // Instant, not smooth: programmatic smooth scrolling is a no-op in some embedded
    // browsers, which would silently break every section link.
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
  };

  const exportPdf = async () => {
    setBusy(true); setPdfError(null);
    try {
      const blob = await buildEvidenceBriefPdf(report);
      downloadBlob(blob, evidenceBriefFilename(report));
    } catch {
      setPdfError("The evidence brief could not be generated. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="ev-layout">
      {/* ---- Section navigation ---- */}
      <nav className="ev-nav" aria-label="Evidence sections">
        <ul className="ev-nav-list">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a className="ev-nav-link" href={`#${s.id}`}
                 onClick={(e) => { e.preventDefault(); jump(s.id); }}>
                <span className="ev-nav-label">{s.label}</span>
                <span className="ev-nav-sub">{SECTION_SUB[s.id]}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="ev-nav-export">
          <div className="ev-nav-export-h">Export Evidence Brief PDF</div>
          <p className="ev-nav-export-sub">Download a PDF summary of this evidence.</p>
          <button className="cta ev-export-btn" onClick={exportPdf} disabled={busy}>
            {busy ? "Preparing PDF…" : "⭳ Export PDF"}
          </button>
          {pdfError && <p className="ev-nav-export-err" role="alert">{pdfError}</p>}
        </div>
      </nav>

      {/* ---- Evidence sections ---- */}
      <div className="ev-main">
        <Section id="evidence-summary" title="Evidence summary">
          <div className="ev-med-card">
            <div className="ev-med-head">
              <div>
                <div className="ev-med-name">{M.medicineName(report)}</div>
                {M.activeIngredient(report) && (
                  <div className="ev-med-ing">Active ingredient: {M.activeIngredient(report)!.toLowerCase()}</div>
                )}
                <div className="ev-med-meta">Drug class: {M.drugClass(report)}</div>
                <div className="ev-med-meta">Condition: {M.condition(report)}</div>
                {M.brandNote(report) && <p className="ev-med-note">{M.brandNote(report)}</p>}
                <span className="ev-selected-badge">Selected medicine</span>
              </div>
              <div className="ev-mat">
                <div className="ev-mat-k">Evidence maturity</div>
                <div className="ev-mat-v">
                  {mat.scorable ? <>{mat.level}<span className="ev-mat-den"> / {mat.maxLevel}</span></> : "—"}
                </div>
                <div className="ev-mat-label">{mat.scorable ? mat.label : "Not yet established"}</div>
              </div>
            </div>
            {checklist.length > 0 && (
              <div className="ev-mat-check">
                <div className="ev-mat-check-h">How this level was reached</div>
                <ul className="ev-mat-list">
                  {checklist.map((c) => (
                    <li key={c.level} className={c.isReached ? "on" : "off"}>
                      <span className="ev-mat-ic" aria-hidden="true">{c.isReached ? "✓" : "○"}</span>
                      <span className="sr-only">{c.isReached ? "level reached" : "level not reached"}</span>
                      <span className="ev-mat-lv">Level {c.level} · {c.label}</span>
                      <span className="ev-mat-desc">{c.description}</span>
                    </li>
                  ))}
                </ul>
                <a className="ev-mat-more" href={`/amira/methodology#${MATURITY_ANCHOR}`}>
                  About evidence maturity levels →
                </a>
              </div>
            )}
            <p className="ev-mat-note">
              Evidence maturity reflects the depth and specificity of women's health reporting in the
              research. It is not a quality rating and is not intended to compare this medicine to others.
            </p>
          </div>
          {signalCard}
        </Section>

        <Section id="women-in-the-evidence" title="Women in the evidence" sub="Counts and analysis">
          <div className="ev-metrics">
            <MetricCard label="Women included" value={M.womenIncluded(report).label}
              tone={M.womenIncluded(report).tone} note="In the studies" />
            <MetricCard label="Women counted" value={M.womenCounted(report).label}
              tone={M.womenCounted(report).tone} note="Who took part in the studies" />
            <MetricCard label="Women analyzed" value={M.womenAnalyzed(report).label}
              tone={M.womenAnalyzed(report).tone} note="Whether results were analysed separately by sex" />
            <MetricCard label="Evidence population" value={pop.label} tone={pop.tone} note={pop.detail} />
          </div>
          <p className="ev-foot">
            Women counted and women analyzed are separate questions. A study can report how many women
            took part without analysing their outcomes separately.
          </p>
        </Section>

        <Section id="sex-specific-effectiveness" title="Sex-specific effectiveness" sub="What the research shows">
          <StateChip cell={M.effectiveness(report)} />
          {report.effectiveness?.headline && (
            <p className="ev-body">{report.effectiveness.headline}</p>
          )}
          {report.effectiveness?.caveat && <p className="ev-foot">{report.effectiveness.caveat}</p>}
          {passages.length > 0 && (
            <a className="ev-link" href={`#exact-passages`}
               onClick={(e) => { e.preventDefault(); jump("exact-passages"); }}>
              View exact passages ({passages.length}) →
            </a>
          )}
        </Section>

        <Section id="women-specific-safety" title="Women-specific safety" sub="What the research shows">
          <StateChip cell={M.safety(report)} />
          {report.safety?.headline && <p className="ev-body">{report.safety.headline}</p>}
          {report.safety?.caveat && <p className="ev-foot">{report.safety.caveat}</p>}
          <p className="ev-foot">
            Women-specific safety is a separate question from the overall adverse effects listed below.
          </p>
        </Section>

        <Section id="common-adverse-effects" title="Common adverse effects" sub="From reviewed sources">
          {ae ? (
            <>
              <ul className="ev-ae">
                {ae.list.map((a) => <li key={a} className="ev-ae-item">{a}</li>)}
              </ul>
              <p className="ev-foot">
                From the reviewed prescribing information. These are overall adverse effects — they are
                not, on their own, evidence of a sex-specific effect.
              </p>
              {ae.source?.url && (
                <a className="ev-link" href={ae.source.url} target="_blank" rel="noopener noreferrer">
                  {ae.source.title || "Prescribing information"} →
                </a>
              )}
            </>
          ) : (
            <p className="ev-body">Not recorded in the reviewed sources.</p>
          )}
        </Section>

        <Section id="life-stage-evidence" title="Life-stage evidence" sub="Across the lifespan">
          <StateChip cell={M.lifeStageEvidence(report)} />
          <p className="ev-foot">
            AMIRA reports a life stage only when the source records it. Menopausal status is never
            inferred from age.
          </p>
        </Section>

        <Section id="hormonal-context" title="Hormonal context" sub="Menopause and hormone therapy">
          <div className="ev-rows">
            <div className="ev-row">
              <span className="ev-row-k">Menopause representation</span>
              <StateChip cell={hc.menopauseRepresentation} />
            </div>
            <div className="ev-row">
              <span className="ev-row-k">Hormone therapy representation</span>
              <StateChip cell={hc.hormoneTherapyRepresentation} />
            </div>
            <div className="ev-row">
              <span className="ev-row-k">Hormonal-context analysis</span>
              <StateChip cell={hc.hormonalContextAnalysis} />
            </div>
          </div>
        </Section>

        <Section id="exact-passages" title="Exact passages from the evidence" sub="What the sources say">
          {passages.length === 0 ? (
            <p className="ev-body">No source-linked passage is recorded for this medicine.</p>
          ) : (
            <ul className="ev-passages">
              {passages.map((p) => (
                <li className="ev-passage" key={`${p.sourceId}-${p.passage.slice(0, 24)}`}>
                  <div className="ev-passage-scope">{p.study}</div>
                  <blockquote className="ev-passage-q">{p.passage}</blockquote>
                  <div className="ev-passage-src">
                    <span>{p.sourceTitle} · {p.sourceId}{p.locator ? ` · ${p.locator}` : ""}</span>
                    <a className="ev-link" href={p.url} target="_blank" rel="noopener noreferrer">
                      View source record →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="source-coverage" title="Source coverage" sub="Studies and reviews">
          <div className="ev-metrics">
            <MetricCard label="Sources reviewed" value={String(sources.length)} tone="reported" />
            <MetricCard label="Studies behind this result"
              value={String(report.studies_behind?.length ?? report.trials?.length ?? 0)} tone="reported" />
            <MetricCard label="Evidence cutoff date" value={M.evidenceCutoff(report)} tone="reported" />
          </div>
          <ul className="ev-sources">
            {sources.map((s) => (
              <li key={s.sourceId}>
                <a className="ev-link" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                <span className="ev-source-id"> · {s.sourceId}</span>
              </li>
            ))}
          </ul>
          <p className="ev-foot">
            AMIRA reports what is known from the reviewed sources. It does not claim that every relevant
            study has been reviewed.
          </p>
        </Section>

        <Section id="about-this-evidence-review" title="About this evidence review" sub="Methods and limitations">
          <div className="ev-metrics">
            <MetricCard label="Human review status" value={M.humanReviewStatus(report)}
              tone={M.humanReviewStatus(report) === "Completed" ? "reported" : "limited"} />
            <MetricCard label="Evidence cutoff date" value={M.evidenceCutoff(report)} tone="reported"
              note="Sources published on or before this date" />
            <MetricCard label="Source coverage" value={String(sources.length)} tone="reported"
              note="Clinical trials and reviews" />
          </div>
          <div className="ev-about-links">
            <a className="ev-link" href="/amira/methodology">See full methodology →</a>
          </div>
          <div className="ev-limits">
            <div className="ev-limits-h">Limitations</div>
            <ul>{M.limitations(report).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
          <p className="ev-foot">{M.NON_RECOMMENDATION}</p>
        </Section>
      </div>
    </div>
  );
}
