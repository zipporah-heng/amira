import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse, type TrialRow } from "../api";
import { EvidenceSearch, type Filters, type ConditionEntry } from "../components/EvidenceSearch";
import { TopBanner } from "../components/TopBanner";
import { EvidenceMetricCard } from "../components/EvidenceMetricCard";
import { WhoWasStudied } from "../components/WhoWasStudied";
import { MaturityBreakdown } from "../components/MaturityBreakdown";
import { SexEffectiveness } from "../components/SexEffectiveness";
import { SexSideEffects } from "../components/SexSideEffects";
import { FindingsPanel } from "../components/FindingsPanel";
import { GapsPanel } from "../components/GapsPanel";
import { ClassComparison } from "../components/ClassComparison";
import { StudyTable } from "../components/StudyTable";
import { SourceDrawer } from "../components/SourceDrawer";
import { ScreeningPanel } from "../components/ScreeningPanel";
import { BenchmarkSummary } from "../components/BenchmarkSummary";
import { AdditionalResources } from "../components/AdditionalResources";
import { DatasetStamp } from "../components/DemoBadge";

// Icon + tint per summary-card dimension.
const CARD_META: Record<string, { icon: string; tint: string }> = {
  sex_specific_efficacy_reported: { icon: "🎯", tint: "#e9f6f1" },
  sex_specific_safety_reported: { icon: "💊", tint: "#fdf1e5" },
  menopause_status_reported: { icon: "📅", tint: "#efe9fb" },
  hormone_therapy_reported: { icon: "💧", tint: "#e9f1fb" },
  pregnancy_evidence_reported: { icon: "🤰", tint: "#f4f4f6" },
};

const DEFAULTS: Filters = {
  condition: "Cardiovascular disease prevention",
  drugClass: "Statin",
  medicine: "Rosuvastatin",
  lifeStage: "menopause_postmenopause",
  hormoneTherapy: "Any",
};

const toApi = (f: Filters) => ({
  condition: f.condition,
  medicine: f.medicine,
  life_stage: f.lifeStage, // already a clean token from LIFE_STAGE_OPTIONS
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

  const t = report?.totals;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-q">What does the evidence show for women?</h1>
          <p className="page-sub">
            See how well the medicine was studied in women, whether effectiveness or side effects
            differed by sex, and how the evidence compares with similar drugs.
          </p>
        </div>
        <button className="share-btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          ⌁ Share
        </button>
      </div>

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

      {report && report.supported && report.banner && t && (
        <>
          {/* 1. TOP SUMMARY BANNER */}
          <TopBanner banner={report.banner} onJump={jump} />

          {/* 2. SUMMARY EVIDENCE CARDS — quick snapshot, all from real records */}
          <div className="metrics" style={{ marginTop: 22 }}>
            <EvidenceMetricCard icon="🗂️" tint="#efe9fb" title="Studies included"
              value={String(report.trials.length)}
              sub={`Phase 3 RCT${report.trials.length === 1 ? "" : "s"} for ${report.query.medicine}`} />
            <EvidenceMetricCard icon="👥" tint="#e9f1fb" title="Women studied"
              value={t.women_reported_count.toLocaleString()}
              sub={t.women_pct_of_participants != null
                ? `reported · ${t.women_pct_of_participants}% of ${t.participants_total.toLocaleString()} participants`
                : `reported in ${t.trials_with_reported_female_count.length} of ${t.trials} trials`} />
            {/* Pregnancy is not a core maturity dimension: it stays in the detailed
                evidence sections and Additional Clinical Resources, not this row. */}
            {report.dimensions
              .filter((d) => d.dimension !== "pregnancy_evidence_reported")
              .map((d) => {
                const meta = CARD_META[d.dimension] || { icon: "•", tint: "#eee" };
                return (
                  <EvidenceMetricCard key={d.dimension}
                    icon={meta.icon} tint={meta.tint}
                    title={d.title}
                    value={d.display}
                    sub={`of ${d.n_trials} trial${d.n_trials === 1 ? "" : "s"} — ${d.subtitle}`}
                    zero={d.n_reporting === 0} />
                );
              })}
          </div>

          {t.count_basis_warning && (
            <div className="callout" style={{ marginTop: 16 }}>
              <strong>Count basis:</strong> {t.count_basis_warning} Combined estimate:{" "}
              {t.women_estimated_total.toLocaleString()} women ({t.women_estimated_basis.replace(/_/g, " ")}).
            </div>
          )}

          {/* 3. WHO WAS STUDIED */}
          {report.who_was_studied && <div style={{ marginTop: 22 }}><WhoWasStudied rows={report.who_was_studied} /></div>}

          {/* 4. EVIDENCE MATURITY BREAKDOWN */}
          {report.maturity && <div style={{ marginTop: 22 }}><MaturityBreakdown maturity={report.maturity} /></div>}

          {/* 5 & 6. HERO OUTPUTS */}
          {report.effectiveness && <div style={{ marginTop: 22 }}><SexEffectiveness data={report.effectiveness} /></div>}
          {report.safety && <div style={{ marginTop: 22 }}><SexSideEffects data={report.safety} /></div>}

          {/* 7 & 8. FOUND / MISSING */}
          <div className="two-col" style={{ marginTop: 22 }}>
            <FindingsPanel report={report} />
            {report.evidence_gaps && <GapsPanel gaps={report.evidence_gaps} report={report} />}
          </div>

          {/* 9. CLASS COMPARISON */}
          {report.class_comparison && (
            <div style={{ marginTop: 22 }}>
              <ClassComparison data={report.class_comparison} current={report.banner.medicine} />
            </div>
          )}

          {/* Context callouts (life stage / hormone therapy filters) */}
          {report.life_stage_context && !report.life_stage_context.supported && (
            <div className="callout" style={{ marginTop: 18 }}>
              <strong>Life stage — {report.life_stage_context.selected.replace(/_/g, " ")}:</strong>{" "}
              {report.life_stage_context.message}
            </div>
          )}
          {report.hormone_therapy_context && !report.hormone_therapy_context.supported && (
            <div className="callout" style={{ marginTop: 14 }}>
              <strong>Hormone therapy — {report.hormone_therapy_context.selected}:</strong>{" "}
              {report.hormone_therapy_context.message}
            </div>
          )}

          {/* 10. STUDIES AND SOURCES */}
          <StudyTable trials={report.trials} onOpen={setActive} />

          {/* 11. HOW STUDIES WERE SELECTED */}
          <div style={{ marginTop: 22 }}><ScreeningPanel selection={report.study_selection} /></div>

          {/* 12. OPEN DATASET AND BENCHMARK */}
          <BenchmarkSummary report={report} />

          {/* 13. ADDITIONAL CLINICAL RESOURCES */}
          <div style={{ marginTop: 22 }}><AdditionalResources /></div>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
            <DatasetStamp version={report.dataset_version} cutoff={report.source_cutoff} commit={report.commit_hash} />
          </div>
        </>
      )}

      {active && <SourceDrawer trial={active} onClose={() => setActive(null)} />}
    </div>
  );
}
