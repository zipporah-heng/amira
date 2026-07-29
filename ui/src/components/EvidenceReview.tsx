import { useEffect, useRef, useState } from "react";
import type { EvidenceResponse } from "../api";
import * as M from "../evidenceModel";
import { buildEvidenceBriefPdf, evidenceBriefFilename, downloadBlob } from "../pdf";
import * as CS from "../criticalSignal";
import type { CriticalSignal } from "../api";

/** The approved Check Evidence review: a section navigation beside the evidence
 *  sections, in the approved order.
 *
 *  Every value comes from ui/src/evidenceModel.ts — the same layer the PDF export
 *  reads — so the page and the brief can never disagree. Nothing here invents a
 *  medical claim: canonical states are rendered verbatim, and a missing analysis
 *  stays missing rather than becoming evidence of no difference. */

/** The section navigation. The approved detailed sections, plus links to the original
 *  scientific summary components that sit above them — quick understanding first,
 *  detailed inspection second. */
export const SECTIONS = [
  { id: "evidence-summary", label: "Evidence Summary" },
  { id: "representation", label: "How were women represented?" },
  { id: "women-in-the-evidence", label: "Women in the Evidence" },
  { id: "remains-unknown", label: "What remains unknown" },
  { id: "sex-specific-effectiveness", label: "Sex-specific Effectiveness" },
  { id: "women-specific-safety", label: "Women-specific Safety" },
  { id: "common-adverse-effects", label: "Common Adverse Effects" },
  { id: "life-stage-evidence", label: "Life-stage Evidence" },
  { id: "hormonal-context", label: "Hormonal Context" },
  { id: "exact-passages", label: "Exact Passages" },
  { id: "source-coverage", label: "Source Coverage" },
  { id: "ai-found", label: "How AMIRA's AI found this evidence" },
  { id: "about-this-evidence-review", label: "About This Evidence Review" },
];

const SECTION_SUB: Record<string, string> = {
  "evidence-summary": "Medicine, finding and maturity",
  "representation": "Canonical states at a glance",
  "women-in-the-evidence": "Counts and analysis",
  "remains-unknown": "Gaps in the reviewed sources",
  "sex-specific-effectiveness": "What the research shows",
  "women-specific-safety": "What the research shows",
  "common-adverse-effects": "From reviewed sources",
  "life-stage-evidence": "Across the lifespan",
  "hormonal-context": "Menopause and hormone therapy",
  "exact-passages": "What the sources say",
  "source-coverage": "Studies and reviews",
  "ai-found": "Pipeline and schema",
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

/** Highlights the section the reader is currently in. Uses IntersectionObserver where
 *  available and degrades to the first section when it is not (e.g. jsdom), so the
 *  navigation is never left without an active item. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const visible = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.current.add(e.target.id);
          else visible.current.delete(e.target.id);
        }
        // The topmost section currently on screen wins.
        const first = ids.find((id) => visible.current.has(id));
        if (first) setActive(first);
      },
      // Offset the top by the sticky header so a section counts as "current" only
      // once it is actually readable beneath it.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids.join("|")]);

  return active;
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

/** A compact critical-signal callout placed beside the evidence section it concerns.
 *  It sits ALONGSIDE the canonical evidence state — it never replaces it, and the
 *  section's own classification is unchanged by the signal's presence. */
function SignalCallout({ signal }: { signal: CriticalSignal }) {
  const p = CS.presentSignal(signal);
  return (
    <aside className={`ev-signal ${p.tone}`} aria-label="Critical evidence signal">
      <div className="ev-signal-head">
        <span className="ev-signal-label">{p.label}</span>
        <span className="ev-signal-review">{p.reviewStatus}</span>
      </div>
      {p.headline && <p className="ev-signal-headline">{p.headline}</p>}
      {p.statistic && <p className="ev-signal-stat">{p.statistic}</p>}
      {p.analysis && <p className="ev-signal-note">{p.analysis}</p>}
      {p.sourceUrl && (
        <a className="ev-link" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
          View exact passage →
        </a>
      )}
      <p className="ev-signal-note">
        Shown separately from the evidence state above. A critical signal does not change
        evidence maturity, effectiveness or safety classification, and is not a ranking.
      </p>
    </aside>
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

export function EvidenceReview({
  report, signalCard, maturityCard, scopeCard, representationCard, unknownCard, aiFoundCard, footerCard,
  signal,
}: {
  report: EvidenceResponse;
  /** "What should I notice?" — the primary result, column two of the summary row. */
  signalCard?: React.ReactNode;
  /** Evidence Maturity — the circular meter and its checklist, column three. */
  maturityCard?: React.ReactNode;
  /** The bounded Evidence Scope panel. */
  scopeCard?: React.ReactNode;
  /** "How were women represented?" — the canonical summary row. */
  representationCard?: React.ReactNode;
  /** "What remains unknown" — bounded reviewed-source gaps. */
  unknownCard?: React.ReactNode;
  /** "How AMIRA's AI found this evidence" + the Women's Evidence Schema panel. */
  aiFoundCard?: React.ReactNode;
  /** Anything that follows the review (e.g. continue-exploring links). */
  footerCard?: React.ReactNode;
  /** The medicine's canonical critical signal, when one qualifies. It is shown beside
   *  the section it concerns and never alters any evidence classification. */
  signal?: CriticalSignal | null;
}) {
  const [busy, setBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  // A summary link is offered only when its component is actually rendered, so the
  // navigation can never point at a section that is not on the page.
  const optional: Record<string, boolean> = {
    "representation": !!representationCard,
    "remains-unknown": !!unknownCard,
    "ai-found": !!aiFoundCard,
  };
  const navSections = SECTIONS.filter((s) => optional[s.id] !== false);
  const active = useActiveSection(navSections.map((s) => s.id));
  const pop = M.evidencePopulation(report);
  const ae = M.commonAdverseEffects(report);
  const hc = M.hormonalContext(report);
  const passages = M.exactPassages(report);
  const sources = M.sourceRecords(report);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    // Instant, not smooth: programmatic smooth scrolling is a no-op in some embedded
    // browsers, which would silently break every section link. Guarded so a missing
    // scrollIntoView can never abort the rest of the click handler.
    try { el?.scrollIntoView({ behavior: "auto", block: "start" }); } catch { /* no-op */ }
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
      {/* ---- Section navigation (approved: sticky on desktop, "Jump to section"
              on mobile). Restoring the meter, representation row and AI trace must
              never displace it. ---- */}
      <nav className="ev-nav" aria-label="Evidence sections">
        <button className="ev-nav-toggle" aria-expanded={jumpOpen} aria-controls="ev-nav-list"
                onClick={() => setJumpOpen((v) => !v)}>
          <span>Jump to section</span>
          <span className="ev-nav-caret" aria-hidden="true">{jumpOpen ? "▲" : "▼"}</span>
        </button>
        <ul className={`ev-nav-list ${jumpOpen ? "open" : ""}`} id="ev-nav-list">
          {navSections.map((s) => (
            <li key={s.id}>
              <a className={`ev-nav-link ${active === s.id ? "active" : ""}`} href={`#${s.id}`}
                 aria-current={active === s.id ? "true" : undefined}
                 onClick={(e) => { e.preventDefault(); jump(s.id); setJumpOpen(false); }}>
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
        {/* One aligned row: medicine identity (compact) · the primary result ·
            evidence maturity. Stacks in that same order on narrow viewports. */}
        <Section id="evidence-summary" title="Evidence summary">
          <div className="ev-summary3">
            <div className="ev-identity">
              <div className="ev-med-name">{M.medicineName(report)}</div>
              {M.activeIngredient(report) && (
                <div className="ev-med-ing">{M.activeIngredient(report)!.toLowerCase()}</div>
              )}
              <dl className="ev-identity-facts">
                <div><dt>Drug class</dt><dd>{M.drugClass(report)}</dd></div>
                <div><dt>Condition</dt><dd>{M.condition(report)}</dd></div>
              </dl>
              {M.brandNote(report) && <p className="ev-med-note">{M.brandNote(report)}</p>}
              <span className="ev-selected-badge">Selected medicine</span>
            </div>
            {signalCard}
            {maturityCard}
          </div>
        </Section>

        {/* Quick evidence understanding, all reading the same canonical record as the
            detailed review below. */}
        {scopeCard}
        {representationCard}

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

        {unknownCard}

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
          {signal && CS.signalSection(signal.signal_type) === "effectiveness" && <SignalCallout signal={signal} />}
        </Section>

        <Section id="women-specific-safety" title="Women-specific safety" sub="What the research shows">
          <StateChip cell={M.safety(report)} />
          {report.safety?.headline && <p className="ev-body">{report.safety.headline}</p>}
          {report.safety?.caveat && <p className="ev-foot">{report.safety.caveat}</p>}
          <p className="ev-foot">
            Women-specific safety is a separate question from the overall adverse effects listed below.
          </p>
          {signal && CS.signalSection(signal.signal_type) === "safety" && <SignalCallout signal={signal} />}
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
            <>
              <p className="ev-body">Not reported in the reviewed sources.</p>
              {signal && (
                <p className="ev-foot">
                  A separate {CS.presentSignal(signal).label.toLowerCase()} was identified and is shown in
                  the Evidence Summary. It is a distinct canonical finding — not a common adverse effect.
                </p>
              )}
            </>
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
            <MetricCard label={CS.REVIEWED_THROUGH_LABEL} value={M.evidenceCutoff(report)} tone="reported"
              note={CS.freshness(M.evidenceCutoff(report))?.label} />
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

        {/* Governance last: the reader inspects the evidence and its sources first,
            then how AMIRA extracted it. */}
        {aiFoundCard}

        <Section id="about-this-evidence-review" title="About this evidence review" sub="Methods and limitations">
          <div className="ev-metrics">
            <MetricCard label="Human review status" value={M.humanReviewStatus(report)}
              tone={M.humanReviewStatus(report) === "Completed" ? "reported" : "limited"} />
            <MetricCard label={CS.REVIEWED_THROUGH_LABEL} value={M.evidenceCutoff(report)} tone="reported"
              note={`Sources published on or before this date · ${CS.freshness(M.evidenceCutoff(report))?.label ?? ""}`.trim()} />
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

        {footerCard}
      </div>
    </div>
  );
}
