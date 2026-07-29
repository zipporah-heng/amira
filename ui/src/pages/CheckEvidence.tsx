import { useEffect, useState } from "react";
import { checkEvidence, getCriticalSignals, type CriticalSignal, type EvidenceResponse } from "../api";
import { EvidenceSearch, hormonalContextToApi, type Filters, type HealthAreaEntry } from "../components/EvidenceSearch";
import { HormonalFocus } from "../components/HormonalFocus";
import { EvidenceScope, WhatRemainsUnknown } from "../components/EvidenceClarity";
import { WhatToNotice } from "../components/WhatToNotice";
import { Representation } from "../components/Representation";
import { AiFound } from "../components/AiFound";
import { EvidenceTraceDrawer } from "../components/EvidenceTraceDrawer";
import { OtherEvidencePaths } from "../components/OtherEvidencePaths";
import { StudyTable } from "../components/StudyTable";
import { NhanesContext } from "../components/NhanesContext";
import { ReusableAssets } from "../components/ReusableAssets";
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

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <>
          {/* Active ingredient shown SEPARATELY in the result (never appended to the
              selectable medicine name). Brand note (e.g. Zepbound) sits alongside it. */}
          {report.banner.active_ingredient && (
            <p className="med-ingredient">
              <span className="med-ingredient-k">Active ingredient:</span> {report.banner.active_ingredient.toLowerCase()}
              {report.banner.brand_note ? <span className="med-brandnote"> · {report.banner.brand_note}</span> : null}
            </p>
          )}
          {/* "What should I notice?" is the SINGLE primary presentation of the signal.
              When a verified Critical Signal exists for this medicine it is consolidated
              INTO this card (no separate standalone panel above the selector). */}
          <WhatToNotice report={report} signal={signals.find((s) => s.medicine === report.banner!.medicine) || null} />
          {/* Page-level maturity disclaimer, beneath the combined signal + maturity card. */}
          <p className="maturity-note">
            <span className="mn-ic" aria-hidden="true">ℹ️</span>
            <span>Evidence Maturity reflects the depth and specificity of women's health reporting in
              the research. It is not a quality rating and is not intended to compare this medicine to others.</span>
          </p>
          <EvidenceScope report={report} />
          <Representation report={report} />
          <WhatRemainsUnknown report={report} />
          <AiFound onOpenTrace={() => setTraceOpen(true)} />
          <OtherEvidencePaths report={report} />
          {report.studies_behind && <StudyTable records={report.studies_behind} />}
          <NhanesContext drugClass={report.banner.drug_class} />
          <ReusableAssets />
          <ContinueExploring onWhy={() => jump("important-finding")} onPassages={() => setTraceOpen(true)} />
        </>
      )}

      {traceOpen && <EvidenceTraceDrawer medicine={medicine} onClose={() => setTraceOpen(false)} />}
    </div>
  );
}
