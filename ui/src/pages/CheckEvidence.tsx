import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse, type TrialRow } from "../api";
import { EvidenceSearch, type Filters, type ConditionEntry } from "../components/EvidenceSearch";
import { SelectedMedicine } from "../components/SelectedMedicine";
import { ImportantFinding } from "../components/ImportantFinding";
import { ReadinessScore } from "../components/ReadinessScore";
import { MaturityBreakdown } from "../components/MaturityBreakdown";
import { Representation } from "../components/Representation";
import { AiPipeline } from "../components/AiPipeline";
import { ClassComparison } from "../components/ClassComparison";
import { DirectComparison } from "../components/DirectComparison";
import { StudyTable } from "../components/StudyTable";
import { NhanesContext } from "../components/NhanesContext";
import { ReusableAssets } from "../components/ReusableAssets";
import { SexEffectiveness } from "../components/SexEffectiveness";
import { SexSideEffects } from "../components/SexSideEffects";
import { FindingsPanel } from "../components/FindingsPanel";
import { GapsPanel } from "../components/GapsPanel";
import { WhoWasStudied } from "../components/WhoWasStudied";
import { ScreeningPanel } from "../components/ScreeningPanel";
import { BenchmarkSummary } from "../components/BenchmarkSummary";
import { AdditionalResources } from "../components/AdditionalResources";
import { SourceDrawer } from "../components/SourceDrawer";
import { DatasetStamp } from "../components/DemoBadge";

// Deterministic video-ready default: Digoxin leads with a striking, source-linked
// finding, and every record is served from the committed corpus + cache.
const DEFAULTS: Filters = {
  condition: "Heart failure",
  drugClass: "Cardiac glycoside",
  medicine: "Digoxin",
  lifeStage: "menopause_postmenopause",
  hormoneTherapy: "Any",
};

const toApi = (f: Filters) => ({
  condition: f.condition,
  medicine: f.medicine,
  life_stage: f.lifeStage,
  hormone_therapy: f.hormoneTherapy.toLowerCase().replace(/\s+/g, "_"),
});

export function CheckEvidence() {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [report, setReport] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TrialRow | null>(null);
  const [catalog, setCatalog] = useState<ConditionEntry[]>([]);

  const run = async (f: Filters) => {
    setLoading(true); setError(null);
    try { setReport(await checkEvidence(toApi(f))); }
    catch (e: any) { setError(e.message || "Could not reach the evidence API"); setReport(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(d.conditions || []))
      .catch(() => setCatalog([]));
    run(DEFAULTS);
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openFirstSource = () => report && report.trials[0] && setActive(report.trials[0]);

  const medicine = report?.banner?.medicine || filters.medicine;

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="video-badge" title="Every value is served from committed real records and a versioned cache">
            ● Video-ready · real cached records
          </span>
          <h1 className="page-q">How ready is the evidence supporting {medicine} for women?</h1>
          <p className="page-sub">
            Explore how women were represented, what researchers found, what remains unknown and where
            each finding came from.
          </p>
        </div>
        <button className="share-btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          ⌁ Share
        </button>
      </div>

      {/* 1. EVIDENCE SELECTORS */}
      <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => run(filters)} catalog={catalog} />

      {loading && <p style={{ marginTop: 22 }}>Loading evidence…</p>}
      {error && (
        <div className="callout" style={{ marginTop: 22 }}>
          {error}. The evidence API must be running (<code>uvicorn main:app --app-dir backend</code>).
        </div>
      )}

      {report && !report.supported && report.bounded_response && (
        <div className="callout" style={{ marginTop: 22 }}>
          <strong>{report.bounded_response.status.replace(/_/g, " ")}:</strong>{" "}
          {report.bounded_response.message}
        </div>
      )}

      {report && report.supported && report.banner && report.totals && (
        <>
          {/* 2. SELECTED MEDICINE */}
          <SelectedMedicine report={report} onSources={openFirstSource} />

          {/* 3. IMPORTANT FINDING — the "so what" */}
          <ImportantFinding report={report} />

          {/* 4 & 5. AMIRA EVIDENCE READINESS + TRANSPARENT SCORE BREAKDOWN */}
          {report.readiness && (
            <ReadinessScore readiness={report.readiness} maturity={report.maturity} onJumpMaturity={() => jump("maturity")} />
          )}

          {/* 4 (cont). Preserve the scientifically implemented 1–5 maturity ladder */}
          {report.maturity && <div id="maturity"><MaturityBreakdown maturity={report.maturity} /></div>}

          {/* 6. HOW WERE WOMEN REPRESENTED */}
          <Representation report={report} />

          {/* 7 & 8 (AI). HOW AMIRA FOUND THIS EVIDENCE + demonstration */}
          <AiPipeline initialMedicine={medicine} />

          {/* 8 (page order). COMPARISON WITH SIMILAR MEDICINES */}
          {report.class_comparison && (
            <div id="class" style={{ marginTop: 22 }}>
              <ClassComparison data={report.class_comparison} current={report.banner.medicine} />
            </div>
          )}

          {/* 9. STUDIES BEHIND THIS RESULT */}
          <StudyTable trials={report.trials} onOpen={setActive} />

          {/* 10. NHANES POPULATION CONTEXT */}
          <NhanesContext drugClass={report.banner.drug_class} />

          {/* 11. REUSABLE SCIENTIFIC ASSETS */}
          <ReusableAssets />

          {/* 12. EXISTING DEEPER EVIDENCE MODULES (preserved) */}
          <details className="deeper" open>
            <summary>Deeper evidence modules</summary>

            {report.direct_comparisons?.map((c) => (
              <div key={c.comparison_id} style={{ marginTop: 22 }}><DirectComparison data={c} /></div>
            ))}
            {report.effectiveness && <div style={{ marginTop: 22 }}><SexEffectiveness data={report.effectiveness} /></div>}
            {report.safety && <div style={{ marginTop: 22 }}><SexSideEffects data={report.safety} /></div>}
            <div className="two-col" style={{ marginTop: 22 }}>
              <FindingsPanel report={report} />
              {report.evidence_gaps && <GapsPanel gaps={report.evidence_gaps} report={report} />}
            </div>
            {report.who_was_studied && <div style={{ marginTop: 22 }}><WhoWasStudied rows={report.who_was_studied} /></div>}
            <div style={{ marginTop: 22 }}><ScreeningPanel selection={report.study_selection} /></div>
            <BenchmarkSummary report={report} />
            <div style={{ marginTop: 22 }}><AdditionalResources /></div>
          </details>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
            <DatasetStamp version={report.dataset_version} cutoff={report.source_cutoff} commit={report.commit_hash} />
          </div>
        </>
      )}

      {active && <SourceDrawer trial={active} onClose={() => setActive(null)} />}
    </div>
  );
}
