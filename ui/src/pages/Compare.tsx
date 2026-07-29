import { useEffect, useMemo, useState } from "react";
import { checkEvidence, type EvidenceResponse } from "../api";
import { hormonalContextToApi, type HealthAreaEntry, type MedicineEntry } from "../components/EvidenceSearch";
import * as M from "../evidenceModel";
import { StateChip } from "../components/EvidenceReview";
import {
  buildComparisonPdf, comparisonFilename, buildEvidenceBriefPdf, evidenceBriefFilename, downloadBlob,
} from "../pdf";

/** Compare Evidence — CONTEXTUAL, DYNAMIC and ALIGNED.
 *
 *  The comparison set is derived from the user's SELECTED CONDITION using the canonical
 *  taxonomy (/api/catalog) — never a hard-coded medicine list. Medicines are matched by
 *  condition and reviewable status only: never by drug class, and never merely because
 *  they share an active ingredient. The selected medicine is always the first column.
 *
 *  Every displayed value comes from ui/src/evidenceModel.ts, the same derivation layer
 *  the Check Evidence page and the PDF exports read. */

interface CondMed extends MedicineEntry { drug_class: string; }

/** Desktop readability limit. More eligible medicines stay available through
 *  Edit Comparison — they are never silently dropped. */
const MAX_COLUMNS = 3;

/** True on tablet/mobile widths, where the comparison shows ONE medicine at a time
 *  instead of squeezing three columns into the viewport. Falls back to desktop when
 *  matchMedia is unavailable (e.g. jsdom), so the full matrix stays testable. */
function useNarrow() {
  const query = "(max-width: 1000px)";
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches : false;
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return narrow;
}

function readContext() {
  const p = new URLSearchParams(window.location.search);
  return {
    healthArea: p.get("healthArea") || "Cardiovascular",
    condition: p.get("condition") || "Heart failure",
    medicine: p.get("medicine") || "Digoxin",
    lifeStage: p.get("lifeStage") || "not_specified",
    hormonalContext: p.get("hormonalContext") || "Any",
    // Deep-link straight into the medicine picker (shareable "edit this comparison").
    edit: p.get("edit") === "1",
  };
}

/** All medicines registered under a condition, across every drug class. */
function medicinesForCondition(catalog: HealthAreaEntry[], healthArea: string, condition: string): CondMed[] {
  const conds = catalog.find((h) => h.health_area === healthArea)?.conditions
    || catalog.flatMap((h) => h.conditions);
  const cond = conds.find((c) => c.condition === condition)
    || catalog.flatMap((h) => h.conditions).find((c) => c.condition === condition);
  if (!cond) return [];
  const out: CondMed[] = [];
  for (const cls of cond.drug_classes) {
    for (const m of cls.medicines) out.push({ ...m, drug_class: cls.drug_class });
  }
  return out;
}

function checkHref(c: { healthArea: string; condition: string; drugClass?: string; medicine: string }) {
  const p = new URLSearchParams({ healthArea: c.healthArea, condition: c.condition, medicine: c.medicine });
  if (c.drugClass) p.set("drugClass", c.drugClass);
  return `/amira/check-evidence?${p.toString()}`;
}

/** The fixed comparison rows — identical, in the same order, for every medicine.
 *  A row renders from the canonical report, or a bounded placeholder when a medicine's
 *  evidence review is explicitly incomplete. */
interface RowDef {
  key: string;
  label: string;
  /** Rendered cell for a reviewed medicine. */
  render: (r: EvidenceResponse) => React.ReactNode;
  /** Plain text used when the medicine has no completed review. */
  incomplete?: string;
}

const ROWS: RowDef[] = [
  { key: "maturity", label: "Evidence maturity",
    render: (r) => <span className="cmp-val">{M.maturity(r).display}</span>, incomplete: "Not scored" },
  { key: "ingredient", label: "Active ingredient",
    render: (r) => <span className="cmp-val">{M.activeIngredient(r)?.toLowerCase() || "Not recorded"}</span> },
  { key: "condition", label: "Condition", render: (r) => <span className="cmp-val">{M.condition(r)}</span> },
  { key: "class", label: "Drug class", render: (r) => <span className="cmp-val">{M.drugClass(r)}</span> },
  { key: "primary", label: "Primary evidence",
    render: (r) => <span className="cmp-val">{M.evidencePopulation(r).label}</span> },
  { key: "included", label: "Women included",
    render: (r) => <StateChip cell={M.womenIncluded(r)} /> },
  { key: "counted", label: "Women counted", render: (r) => <StateChip cell={M.womenCounted(r)} /> },
  { key: "analyzed", label: "Women analyzed", render: (r) => <StateChip cell={M.womenAnalyzed(r)} /> },
  { key: "effectiveness", label: "Sex-specific effectiveness",
    render: (r) => <ExpandableState report={r} kind="effectiveness" /> },
  { key: "safety", label: "Women-specific safety",
    render: (r) => <ExpandableState report={r} kind="safety" /> },
  { key: "adverse", label: "Common adverse effects",
    render: (r) => {
      const ae = M.commonAdverseEffects(r);
      return <span className="cmp-val">{ae ? ae.list.join(", ") : "Not recorded"}</span>;
    } },
  { key: "lifestage", label: "Life-stage evidence", render: (r) => <StateChip cell={M.lifeStageEvidence(r)} /> },
  { key: "hormonal", label: "Hormonal context",
    render: (r) => <StateChip cell={M.hormonalContext(r).hormonalContextAnalysis} /> },
  { key: "review", label: "Human review status",
    render: (r) => <span className="cmp-val">{M.humanReviewStatus(r)}</span> },
  { key: "scope", label: "Evidence scope",
    render: (r) => <span className="cmp-val">{M.evidencePopulation(r).detail || M.condition(r)}</span> },
  { key: "passages", label: "Exact passages",
    render: (r) => {
      const n = M.exactPassages(r).length;
      if (!n) return <span className="cmp-val">None recorded</span>;
      const first = M.exactPassages(r)[0];
      return (
        <a className="cmp-inline-link" href={first.url} target="_blank" rel="noopener noreferrer">
          {n} passage{n === 1 ? "" : "s"} →
        </a>
      );
    } },
];

/** A long finding is summarised to its canonical state, with the full text behind an
 *  explicit expander — compact cells never hold multiple paragraphs. */
function ExpandableState({ report, kind }: { report: EvidenceResponse; kind: "effectiveness" | "safety" }) {
  const [open, setOpen] = useState(false);
  const cell = kind === "effectiveness" ? M.effectiveness(report) : M.safety(report);
  const headline = kind === "effectiveness" ? report.effectiveness?.headline : report.safety?.headline;
  const hasMore = !!headline && headline !== cell.label;
  return (
    <div className="cmp-val">
      <StateChip cell={cell} />
      {hasMore && (
        <>
          <button className="cmp-expand" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Hide finding" : "View details"}
          </button>
          {open && <p className="ev-foot">{headline}</p>}
        </>
      )}
    </div>
  );
}

export function Compare() {
  const ctx = readContext();
  const [meds, setMeds] = useState<CondMed[] | null>(null);
  const [reports, setReports] = useState<Record<string, EvidenceResponse | null>>({});
  const [selectedNames, setSelectedNames] = useState<string[] | null>(null);
  const [editOpen, setEditOpen] = useState(ctx.edit);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [activeMobile, setActiveMobile] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const narrow = useNarrow();

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      const all = medicinesForCondition(d.health_areas || [], ctx.healthArea, ctx.condition);
      // Selected medicine first; then reviewed medicines before incomplete ones.
      const ordered = [
        ...all.filter((m) => m.medicine === ctx.medicine),
        ...all.filter((m) => m.medicine !== ctx.medicine)
          .sort((a, b) => (a.status === b.status ? a.medicine.localeCompare(b.medicine) : a.status === "verified" ? -1 : 1)),
      ];
      setMeds(ordered);
      setSelectedNames(ordered.slice(0, MAX_COLUMNS).map((m) => m.medicine));
      ordered.filter((m) => m.status === "verified").forEach((m) => {
        checkEvidence({
          condition: ctx.condition, medicine: m.medicine, life_stage: ctx.lifeStage,
          hormone_therapy: hormonalContextToApi(ctx.hormonalContext),
        })
          .then((r) => setReports((prev) => ({ ...prev, [m.medicine]: r })))
          .catch(() => setReports((prev) => ({ ...prev, [m.medicine]: null })));
      });
    }).catch((e) => setError(e.message || "Could not load the comparison catalog"));
  }, []);

  /** Columns currently displayed — selected medicine always first. */
  const columns = useMemo<CondMed[]>(() => {
    if (!meds || !selectedNames) return [];
    const chosen = meds.filter((m) => selectedNames.includes(m.medicine));
    return [
      ...chosen.filter((m) => m.medicine === ctx.medicine),
      ...chosen.filter((m) => m.medicine !== ctx.medicine),
    ];
  }, [meds, selectedNames, ctx.medicine]);

  const shownReports = columns
    .map((c) => reports[c.medicine])
    .filter((r): r is EvidenceResponse => !!r && !!r.banner && r.supported);

  const otherReviewed = (meds || []).filter((m) => m.medicine !== ctx.medicine && m.status === "verified");
  const onlyOneReviewed = meds !== null && otherReviewed.length === 0;

  const toggle = (name: string) => {
    if (name === ctx.medicine) return;                      // selected medicine is always included
    setSelectedNames((prev) => {
      const cur = prev || [];
      if (cur.includes(name)) return cur.filter((n) => n !== name);
      if (cur.length >= MAX_COLUMNS) return cur;            // desktop readability limit
      return [...cur, name];
    });
    setActiveMobile(0);
  };

  const exportComparison = async () => {
    if (!shownReports.length) return;
    setBusy(true);
    try {
      downloadBlob(await buildComparisonPdf(shownReports, ctx.condition), comparisonFilename(ctx.condition));
    } finally { setBusy(false); }
  };

  const exportBrief = async (r: EvidenceResponse) => {
    downloadBlob(await buildEvidenceBriefPdf(r), evidenceBriefFilename(r));
  };

  // Reviewed source coverage — computed from the medicines currently displayed.
  const coverage = useMemo(() => {
    const sources = new Set<string>();
    shownReports.forEach((r) => M.sourceRecords(r).forEach((s) => sources.add(s.sourceId)));
    const count = (pred: (r: EvidenceResponse) => boolean) => shownReports.filter(pred).length;
    return {
      sources: sources.size,
      total: shownReports.length,
      counted: count((r) => M.womenCounted(r).tone === "reported"),
      analyzed: count((r) => M.womenAnalyzed(r).tone === "reported"),
      lifeStage: count((r) => M.lifeStageEvidence(r).tone === "reported"),
      hormonal: count((r) => M.hormonalContext(r).hormonalContextAnalysis.tone === "reported"),
      review: shownReports.every((r) => M.humanReviewStatus(r) === "Completed") && shownReports.length > 0
        ? "Completed" : "Pending",
      cutoff: shownReports[0] ? M.evidenceCutoff(shownReports[0]) : "",
    };
  }, [shownReports]);

  // Tablet / mobile show ONE medicine at a time — never three squeezed columns. The
  // evidence-row order and the selected-medicine-first rule are identical either way.
  const visibleColumns = narrow && columns.length > 1
    ? [columns[Math.min(activeMobile, columns.length - 1)]] : columns;
  const gridStyle = {
    gridTemplateColumns: `minmax(190px, 220px) repeat(${visibleColumns.length}, minmax(230px, 1fr))`,
  };

  return (
    <div className="compare-page">
      <span className="eyebrow">Compare Evidence</span>
      <div className="cmp-head">
        <div>
          <h1 className="page-q">Compare evidence for medicines studied in {ctx.condition}</h1>
          <p className="page-sub">
            The selected medicine is shown first, alongside other reviewed medicines registered under
            this condition.
          </p>
        </div>
        <div className="cmp-actions">
          <button className="cmp-btn" onClick={() => setEditOpen((v) => !v)} aria-expanded={editOpen}>
            ⇄ Edit Comparison
          </button>
          <button className="cmp-btn primary" onClick={exportComparison}
                  disabled={busy || shownReports.length === 0}>
            ⭳ Export Comparison PDF
            <span className="cmp-btn-sub">
              {shownReports.length} medicine{shownReports.length === 1 ? "" : "s"}
            </span>
          </button>
        </div>
      </div>

      {/* Shown ONCE above the comparison, never repeated inside each column. */}
      <p className="cmp-note">
        <span aria-hidden="true">ℹ️</span>
        <span>
          These results compare the completeness and visibility of evidence about women. They do not
          recommend one medicine over another.
        </span>
      </p>

      {editOpen && meds && (
        <div className="cmp-editor">
          <div className="cmp-editor-h">Edit comparison</div>
          <p className="cmp-editor-sub">
            Choose which medicines registered under {ctx.condition} to display. Up to {MAX_COLUMNS} medicines
            are shown at a time for readability.
          </p>
          <ul className="cmp-editor-list">
            {meds.map((m) => {
              const locked = m.medicine === ctx.medicine;
              const checked = (selectedNames || []).includes(m.medicine);
              const full = !checked && (selectedNames || []).length >= MAX_COLUMNS;
              return (
                <li key={m.medicine} className={`cmp-editor-item ${locked ? "locked" : ""}`}>
                  <input type="checkbox" id={`cmp-pick-${m.medicine}`} checked={checked}
                         disabled={locked || full} onChange={() => toggle(m.medicine)} />
                  <label htmlFor={`cmp-pick-${m.medicine}`}>
                    {m.medicine}
                    {locked && " · selected medicine"}
                    {m.status !== "verified" && " · evidence review incomplete"}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="cmp-editor-note">
            Only medicines registered under {ctx.condition} can be compared. The order of the columns does
            not imply any treatment ranking, and medicines with an incomplete evidence review are labelled
            and never scored.
          </p>
        </div>
      )}

      {error && <div className="callout" style={{ marginTop: 16 }}>{error}</div>}
      {!error && meds === null && <p style={{ marginTop: 16 }}>Loading comparison…</p>}

      {/* Tablet / mobile: one medicine at a time, same row order. */}
      {columns.length > 1 && (
        <div className="cmp-switcher" role="group" aria-label="Choose a medicine to compare">
          {columns.map((c, i) => (
            <button key={c.medicine} className="cmp-switch-btn" aria-pressed={i === activeMobile}
                    onClick={() => setActiveMobile(i)}>
              {c.medicine}{i === 0 ? " · selected" : ""}
            </button>
          ))}
        </div>
      )}

      {visibleColumns.length > 0 && (
        <div className="cmp-matrix">
          <div className="cmp-scroll">
            <div className="cmp-grid" style={gridStyle} role="table"
                 aria-label={`Evidence comparison for medicines studied in ${ctx.condition}`}>
              {/* Column headers */}
              <div className="cmp-cell label cmp-row-head" role="columnheader">Evidence about women</div>
              {/* The "Selected medicine" marker keys on the medicine's IDENTITY, not the
                  column index — on mobile a single peer column is shown at a time and
                  must never inherit the selected-medicine label. */}
              {visibleColumns.map((c) => (
                <div key={c.medicine} className={`cmp-colhead ${c.medicine === ctx.medicine ? "selected" : ""}`}
                     role="columnheader">
                  {c.medicine === ctx.medicine && <span className="cmp-selbadge">Selected medicine</span>}
                  <span className="cmp-colname">{c.medicine}</span>
                  <span className="cmp-colsub">
                    {reports[c.medicine]?.banner?.active_ingredient?.toLowerCase() || c.active_ingredient?.toLowerCase() || c.drug_class}
                  </span>
                  {c.status !== "verified" && <span className="cmp-incomplete-badge">Evidence review incomplete</span>}
                </div>
              ))}

              {/* Fixed rows, identical across every medicine column */}
              {ROWS.map((row) => (
                <div key={row.key} className="cmp-rowgroup" style={{ display: "contents" }} role="row">
                  <div className="cmp-cell label" role="rowheader">{row.label}</div>
                  {visibleColumns.map((c) => {
                    const r = reports[c.medicine];
                    const incomplete = c.status !== "verified";
                    return (
                      <div key={`${row.key}-${c.medicine}`} className="cmp-cell value" role="cell">
                        {incomplete
                          ? <span className="cmp-val">{row.incomplete || "Evidence review incomplete"}</span>
                          : r && r.banner
                            ? row.render(r)
                            : <span className="cmp-val">Loading…</span>}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Per-medicine brief export stays available on every column */}
              <div className="cmp-cell label" role="rowheader">Export Evidence Brief PDF</div>
              {visibleColumns.map((c) => {
                const r = reports[c.medicine];
                return (
                  <div key={`export-${c.medicine}`} className="cmp-cell value" role="cell">
                    {r && r.banner ? (
                      <button className="cmp-btn" onClick={() => exportBrief(r)}>⭳ Export Evidence Brief PDF</button>
                    ) : (
                      <a className="cmp-inline-link"
                         href={checkHref({ healthArea: ctx.healthArea, condition: ctx.condition, drugClass: c.drug_class, medicine: c.medicine })}>
                        View full evidence →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {meds && meds.length === 0 && (
        <div className="cmp-empty">No reviewed medicines are registered under {ctx.condition}.</div>
      )}

      {onlyOneReviewed && meds!.length >= 1 && (
        <div className="cmp-empty">
          No other reviewed medicines are currently available for comparison within {ctx.condition}.
        </div>
      )}

      {/* ---- Reviewed source coverage: computed from the displayed medicines ---- */}
      {shownReports.length > 0 && (
        <section className="cmp-coverage" aria-labelledby="cmp-coverage-h">
          <div className="cmp-coverage-head">
            <div>
              <div className="cmp-coverage-h" id="cmp-coverage-h">Reviewed source coverage</div>
              <p className="cmp-coverage-sub">
                AMIRA reports what is known from the reviewed sources. It does not claim that every
                relevant study has been reviewed.
              </p>
            </div>
            <button className="cmp-btn" onClick={() => setCoverageOpen((v) => !v)} aria-expanded={coverageOpen}>
              View Source Coverage Details
            </button>
          </div>
          <div className="cmp-coverage-grid">
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Sources reviewed</div>
              <div className="cmp-cov-v">{coverage.sources}</div></div>
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Women counted</div>
              <div className="cmp-cov-v">{coverage.counted} of {coverage.total}</div></div>
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Women analyzed</div>
              <div className="cmp-cov-v">{coverage.analyzed} of {coverage.total}</div></div>
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Life-stage reporting</div>
              <div className="cmp-cov-v">{coverage.lifeStage} of {coverage.total}</div></div>
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Hormonal-context reporting</div>
              <div className="cmp-cov-v">{coverage.hormonal} of {coverage.total}</div></div>
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Human review status</div>
              <div className="cmp-cov-v">{coverage.review}</div></div>
            <div className="cmp-cov-cell"><div className="cmp-cov-k">Evidence cutoff date</div>
              <div className="cmp-cov-v">{coverage.cutoff}</div></div>
          </div>

          {coverageOpen && (
            <div className="cmp-cov-wrap">
              <table className="cmp-cov-table">
                <thead>
                  <tr><th>Medicine</th><th>Source</th><th>Evidence population</th><th>Review status</th><th>Cutoff date</th></tr>
                </thead>
                <tbody>
                  {shownReports.flatMap((r) =>
                    M.sourceRecords(r).map((s) => (
                      <tr key={`${M.medicineName(r)}-${s.sourceId}`}>
                        <td>{M.medicineName(r)}</td>
                        <td><a className="cmp-inline-link" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></td>
                        <td>{M.evidencePopulation(r).label}</td>
                        <td>{M.humanReviewStatus(r)}</td>
                        <td>{M.evidenceCutoff(r)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
