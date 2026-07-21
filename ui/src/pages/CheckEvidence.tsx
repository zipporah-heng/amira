import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse } from "../api";
import { EvidenceSearch, type Filters, type ConditionEntry } from "../components/EvidenceSearch";
import { HormonalFocus } from "../components/HormonalFocus";
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
  condition: "Heart failure",
  drugClass: "Cardiac glycoside",
  medicine: "Digoxin",
  lifeStage: "menopause_postmenopause",
  hormoneTherapy: "Any",
};

const toApi = (f: Filters) => ({
  condition: f.condition, medicine: f.medicine,
  life_stage: f.lifeStage, hormone_therapy: f.hormoneTherapy.toLowerCase().replace(/\s+/g, "_"),
});

export function CheckEvidence() {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [report, setReport] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ConditionEntry[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);

  const run = async (f: Filters) => {
    setLoading(true); setError(null);
    try { setReport(await checkEvidence(toApi(f))); }
    catch (e: any) { setError(e.message || "Could not reach the evidence API"); setReport(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setCatalog(d.conditions || [])).catch(() => setCatalog([]));
    run(DEFAULTS);
  }, []);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const medicine = report?.banner?.medicine || filters.medicine;

  return (
    <div className="check-page">
      <h1 className="page-q">How ready is the evidence supporting {medicine} for women?</h1>
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
          <WhatToNotice report={report} />
          <Representation report={report} />
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
