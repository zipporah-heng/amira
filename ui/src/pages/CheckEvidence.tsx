import { useEffect, useState } from "react";
import { checkEvidence, getCriticalSignals, type CriticalSignal, type EvidenceResponse } from "../api";
import { EvidenceSearch, hormonalContextToApi, type Filters, type HealthAreaEntry } from "../components/EvidenceSearch";
import { HormonalFocus } from "../components/HormonalFocus";
import { NoticePanel, MaturityPanel } from "../components/WhatToNotice";
import { EvidenceReview } from "../components/EvidenceReview";
import { Representation } from "../components/Representation";
import { AiFound } from "../components/AiFound";
import { EvidenceTraceDrawer } from "../components/EvidenceTraceDrawer";
import { ReusableScienceTeaser } from "../components/ReusableScienceTeaser";
import { EvidenceScope, WhatRemainsUnknown } from "../components/EvidenceClarity";
import { ContinueExploring } from "../components/ContinueExploring";

// Digoxin leads: a striking, source-linked finding on the first, default view.
const DEFAULTS: Filters = {
  healthArea: "Cardiovascular",
  condition: "Heart failure",
  drugClass: "Cardiac glycoside",
  medicine: "Digoxin",
  lifeStage: "menopause_postmenopause",
  hormonalContext: "Any",
};

const toApi = (f: Filters) => ({
  condition: f.condition, medicine: f.medicine,
  life_stage: f.lifeStage, hormone_therapy: hormonalContextToApi(f.hormonalContext),
});

/** Read an optional deep-link context (e.g. from the Critical Evidence Library's
 *  "View full evidence") so the selector opens on the requested medicine. */
function initialFilters(): Filters {
  try {
    const p = new URLSearchParams(window.location.search);
    const get = (k: string, d: string) => p.get(k) || d;
    if (p.get("medicine")) {
      return {
        healthArea: get("healthArea", DEFAULTS.healthArea),
        condition: get("condition", DEFAULTS.condition),
        drugClass: get("drugClass", DEFAULTS.drugClass),
        medicine: get("medicine", DEFAULTS.medicine),
        lifeStage: get("lifeStage", DEFAULTS.lifeStage),
        hormonalContext: get("hormonalContext", DEFAULTS.hormonalContext),
      };
    }
  } catch { /* no-op */ }
  return DEFAULTS;
}

export function CheckEvidence() {
  const start = initialFilters();
  const [filters, setFilters] = useState<Filters>(start);
  const [report, setReport] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<HealthAreaEntry[]>([]);
  const [signals, setSignals] = useState<CriticalSignal[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);

  const run = async (f: Filters) => {
    setLoading(true); setError(null);
    try { setReport(await checkEvidence(toApi(f))); }
    catch (e: any) { setError(e.message || "Could not reach the evidence API"); setReport(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setCatalog(d.health_areas || [])).catch(() => setCatalog([]));
    getCriticalSignals().then((d) => setSignals(d.library || [])).catch(() => setSignals([]));
    run(start);
  }, []);

  const medicine = report?.banner?.medicine || filters.medicine;

  return (
    <div className="check-page">
      <h1 className="page-q">What does the evidence show about {medicine} in women?</h1>
      <p className="page-sub">
        See how women were represented, what researchers found, what remains unknown and where each
        finding came from.
      </p>

      {/* Hormonal-health focus (concise; does not overwhelm the journey) */}
      <HormonalFocus compact />

      {/* A compact pointer to the reusable scientific assets; the documentation itself
          lives on the Open Benchmark page. */}
      <ReusableScienceTeaser />

      {/* Evidence selectors — one compact row */}
      <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => run(filters)} catalog={catalog} />

      {loading && <p style={{ marginTop: 18 }}>Loading evidence…</p>}
      {error && (
        <div className="callout" style={{ marginTop: 18 }}>
          {error}. The evidence API must be running (<code>uvicorn main:app --app-dir backend</code>).
        </div>
      )}
      {report && !report.supported && report.bounded_response && (
        <div className="callout" style={{ marginTop: 18 }}>
          <strong>{report.bounded_response.status.replace(/_/g, " ")}:</strong> {report.bounded_response.message}
        </div>
      )}

      {report && report.supported && report.banner && report.totals && (
        /* The approved evidence review. Section navigation + evidence sections, all
           reading the shared evidence model (the same layer the PDF brief reads).
           The verified critical signal, when one exists, stays consolidated into the
           evidence summary rather than becoming a second competing headline. */
        <EvidenceReview
          report={report}
          /* Columns two and three of the compact summary row: the primary result,
             then the circular maturity meter and its checklist. */
          signalCard={
            <NoticePanel
              report={report}
              signal={signals.find((s) => s.medicine === report.banner!.medicine) || null}
            />
          }
          maturityCard={<MaturityPanel report={report} />}
          signal={signals.find((s) => s.medicine === report.banner!.medicine) || null}
          scopeCard={<EvidenceScope report={report} />}
          representationCard={<Representation report={report} />}
          unknownCard={<WhatRemainsUnknown report={report} />}
          aiFoundCard={<AiFound report={report} onOpenTrace={() => setTraceOpen(true)} />}
          footerCard={
            <ContinueExploring
              onWhy={() => document.getElementById("important-finding")?.scrollIntoView({ block: "start" })}
              onPassages={() => setTraceOpen(true)}
            />
          }
        />
      )}

      {traceOpen && <EvidenceTraceDrawer medicine={medicine} onClose={() => setTraceOpen(false)} />}
    </div>
  );
}
