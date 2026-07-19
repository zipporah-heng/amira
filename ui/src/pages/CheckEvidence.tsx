import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse, type TrialRow } from "../api";
import { EvidenceSearch, type Filters } from "../components/EvidenceSearch";
import { MedicineCard } from "../components/MedicineCard";
import { EvidenceMetricCard } from "../components/EvidenceMetricCard";
import { EvidenceGlanceDonut } from "../components/EvidenceGlanceDonut";
import { FindingsPanel } from "../components/FindingsPanel";
import { MissingEvidencePanel } from "../components/MissingEvidencePanel";
import { ConfidencePanel } from "../components/ConfidencePanel";
import { StudyTable } from "../components/StudyTable";
import { SourceDrawer } from "../components/SourceDrawer";
import { BenchmarkSummary } from "../components/BenchmarkSummary";

const DEFAULTS: Filters = {
  condition: "Cardiovascular disease prevention",
  medicine: "Rosuvastatin",
  lifeStage: "Postmenopause",
  hormoneTherapy: "Any",
};

const toApi = (f: Filters) => ({
  condition: f.condition,
  medicine: f.medicine,
  life_stage: f.lifeStage.toLowerCase().replace(/\s+/g, "_"),
  hormone_therapy: f.hormoneTherapy.toLowerCase().replace(/\s+/g, "_"),
});

export function CheckEvidence() {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [report, setReport] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TrialRow | null>(null);

  const run = async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await checkEvidence(toApi(f)));
    } catch (e: any) {
      setError(e.message || "Could not reach the evidence API");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(DEFAULTS); }, []);

  const t = report?.totals;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-q">Was this medicine studied in women like me?</h1>
          <p className="page-sub">See the evidence behind your questions.</p>
        </div>
        <button className="share-btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          ⌁ Share
        </button>
      </div>

      <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => run(filters)} />

      {loading && <p style={{ marginTop: 22 }}>Loading evidence…</p>}
      {error && (
        <div className="callout" style={{ marginTop: 22 }}>
          {error}. The evidence API must be running — start it with
          <code> uvicorn main:app --app-dir backend</code>.
        </div>
      )}

      {report && !report.supported && report.bounded_response && (
        <div className="callout" style={{ marginTop: 22 }}>
          <strong>{report.bounded_response.status.replace(/_/g, " ")}:</strong>{" "}
          {report.bounded_response.message}
        </div>
      )}

      {report && report.supported && t && (
        <>
          <div className="ce-grid">
            <div className="ce-center">
              <MedicineCard report={report} />

              <div className="metrics">
                <EvidenceMetricCard
                  icon="👥" tint="#efe9fb" title="Women studied"
                  value={t.women_reported_count.toLocaleString()}
                  sub={`exact reported count in ${t.trials_with_reported_female_count.length} of ${t.trials} trials`}
                />
                {report.dimensions.map((d) => (
                  <EvidenceMetricCard
                    key={d.dimension}
                    icon={d.dimension.includes("menopause") ? "📅"
                      : d.dimension.includes("hormone") ? "💧"
                      : d.dimension.includes("pregnancy") ? "🤰" : "♀"}
                    tint={d.dimension.includes("menopause") ? "#fdf1e5"
                      : d.dimension.includes("hormone") ? "#fbe9ee"
                      : d.dimension.includes("pregnancy") ? "#e9f6f1" : "#e9f1fb"}
                    title={d.title}
                    value={d.display}
                    sub={d.subtitle}
                    zero={d.n_reporting === 0}
                  />
                ))}
              </div>

              {t.count_basis_warning && (
                <div className="callout" style={{ marginTop: 18 }}>
                  <strong>Count basis:</strong> {t.count_basis_warning} Combined estimate:{" "}
                  {t.women_estimated_total.toLocaleString()} women ({t.women_estimated_basis.replace(/_/g, " ")}).
                </div>
              )}

              {report.life_stage_context && !report.life_stage_context.supported && (
                <div className="callout" style={{ marginTop: 14 }}>
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

              <StudyTable trials={report.trials} onOpen={setActive} />
            </div>

            <aside className="ce-right">
              <EvidenceGlanceDonut report={report} />
              <FindingsPanel report={report} />
              <MissingEvidencePanel report={report} />
              <ConfidencePanel report={report} />
            </aside>
          </div>

          <BenchmarkSummary report={report} />
        </>
      )}

      {active && <SourceDrawer trial={active} onClose={() => setActive(null)} />}
    </div>
  );
}
