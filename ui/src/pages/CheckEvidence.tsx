import { useState } from "react";
import { EvidenceSearch, type Filters } from "../components/EvidenceSearch";
import { EvidenceLevel } from "../components/EvidenceLevel";
import { EvidenceMetricCard } from "../components/EvidenceMetricCard";
import { EvidenceAtGlance } from "../components/EvidenceAtGlance";
import { FindingsPanel } from "../components/FindingsPanel";
import { MissingEvidencePanel } from "../components/MissingEvidencePanel";
import { StudyTable } from "../components/StudyTable";
import { SourceDrawer } from "../components/SourceDrawer";
import { BenchmarkSummary } from "../components/BenchmarkSummary";
import { fixture, stats } from "../fixture";
import type { Study } from "../types";

export function CheckEvidence() {
  const { meta } = fixture;
  const [filters, setFilters] = useState<Filters>({
    condition: meta.condition,
    medicine: meta.medicine,
    lifeStage: meta.life_stage_demo,
    hormoneTherapy: meta.hormone_therapy_demo,
  });
  const [checked, setChecked] = useState(true); // deterministic demo shows result by default
  const [active, setActive] = useState<Study | null>(null);

  return (
    <div>
      <span className="eyebrow">Check the Evidence</span>
      <h1 className="page-q">Was this medicine studied in women like me?</h1>
      <p className="page-sub">
        AMIRA reviews published research to show how many women were studied, what was
        reported separately for women, and what is still missing — with every number
        traceable to a source.
      </p>

      <div style={{ marginTop: 22 }}>
        <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => setChecked(true)} />
      </div>

      {checked && (
        <div>
          {/* Medicine header */}
          <div className="card" style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div className="section-title">Evidence result</div>
              <h2 style={{ fontSize: 24, marginTop: 8 }}>{meta.medicine}</h2>
              <p style={{ marginTop: 4 }}>
                {meta.drug_class} · {meta.condition} · {filters.lifeStage}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span className="badge demo"><span className="dot" /> Demo data</span>
            </div>
          </div>

          <EvidenceLevel level={meta.evidence_level} />

          {/* Five core cards — all derived from the fixture */}
          <div className="section-title" style={{ marginTop: 24 }}>Evidence in numbers</div>
          <div className="metrics">
            <EvidenceMetricCard
              title="Women Studied"
              value={stats.femaleTotal.toLocaleString()}
              sub={`${stats.femalePct}% of participants across ${stats.studyCount} reviewed studies`}
            />
            <EvidenceMetricCard
              title="Sex-specific Outcomes"
              value={`${stats.sexSpecificOutcomes} / ${stats.studyCount}`}
              sub="studies reported results separately for women"
            />
            <EvidenceMetricCard
              title="Menopause Status"
              value={`${stats.menopauseReported} / ${stats.studyCount}`}
              sub="studies reported menopausal status"
            />
            <EvidenceMetricCard
              title="Hormone Therapy"
              value={`${stats.hormoneTherapyReported} / ${stats.studyCount}`}
              sub="studies reported hormone therapy use"
              zero={stats.hormoneTherapyReported === 0}
            />
            <EvidenceMetricCard
              title="Pregnancy"
              value={`${stats.pregnancyReported} / ${stats.studyCount}`}
              sub="studies included pregnancy-specific evidence"
              zero={stats.pregnancyReported === 0}
            />
          </div>

          <div className="callout">
            High female representation does not automatically mean complete women-specific or
            hormone-aware evidence. Women were studied here — but menopause, hormone therapy,
            and most sex-specific outcomes were not reported in the reviewed studies.
          </div>

          <EvidenceAtGlance />

          <div className="panels">
            <FindingsPanel />
            <MissingEvidencePanel />
          </div>

          <StudyTable studies={fixture.studies} onOpen={setActive} />

          <BenchmarkSummary />
        </div>
      )}

      {active && <SourceDrawer study={active} onClose={() => setActive(null)} />}
    </div>
  );
}
