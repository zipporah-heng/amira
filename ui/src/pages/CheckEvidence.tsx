import { useState } from "react";
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
import { fixture, stats } from "../fixture";
import type { Study } from "../types";

const ICONS = {
  women: "👥",
  sex: "♀",
  meno: "📅",
  hormone: "💧",
  pregnancy: "🤰",
};

export function CheckEvidence() {
  const { meta } = fixture;
  const [filters, setFilters] = useState<Filters>({
    condition: meta.condition,
    medicine: `${meta.medicine} (${meta.brand})`,
    lifeStage: meta.life_stage_demo,
    hormoneTherapy: meta.hormone_therapy_demo,
  });
  const [checked, setChecked] = useState(true);
  const [active, setActive] = useState<Study | null>(null);

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

      <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => setChecked(true)} />

      {checked && (
        <div className="ce-grid">
          <div className="ce-center">
            <MedicineCard />

            <div className="metrics">
              <EvidenceMetricCard
                icon={ICONS.women} tint="#efe9fb"
                title="Women studied"
                value={stats.femaleTotal.toLocaleString()}
                sub={`${stats.femalePct}% of all participants across ${stats.studyCount} trials`}
              />
              <EvidenceMetricCard
                icon={ICONS.sex} tint="#e9f1fb"
                title="Sex-specific outcomes"
                value={`${stats.sexSpecificOutcomes} / ${stats.studyCount}`}
                sub="studies reported results separately for women"
              />
              <EvidenceMetricCard
                icon={ICONS.meno} tint="#fdf1e5"
                title="Menopause status"
                value={`${stats.menopauseReported} / ${stats.studyCount}`}
                sub="studies reported menopausal status"
              />
              <EvidenceMetricCard
                icon={ICONS.hormone} tint="#fbe9ee"
                title="Hormone therapy"
                value={`${stats.hormoneTherapyReported} / ${stats.studyCount}`}
                sub="studies reported hormone therapy use"
                zero={stats.hormoneTherapyReported === 0}
              />
              <EvidenceMetricCard
                icon={ICONS.pregnancy} tint="#e9f6f1"
                title="Pregnancy"
                value={`${stats.pregnancyReported} / ${stats.studyCount}`}
                sub="studies included pregnant participants"
                zero={stats.pregnancyReported === 0}
              />
            </div>

            <div className="callout" style={{ marginTop: 18 }}>
              High female representation does not automatically mean complete
              women-specific or hormone-aware evidence. Women were studied here — but
              menopause, hormone therapy, and reproductive stage were rarely reported.
            </div>

            <StudyTable studies={fixture.studies} onOpen={setActive} />
          </div>

          <aside className="ce-right">
            <EvidenceGlanceDonut />
            <FindingsPanel />
            <MissingEvidencePanel />
            <ConfidencePanel />
          </aside>
        </div>
      )}

      {checked && <BenchmarkSummary />}

      {active && <SourceDrawer study={active} onClose={() => setActive(null)} />}
    </div>
  );
}
