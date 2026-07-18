import { useMemo, useState } from "react";
import type { EvidenceReport, ReportedStatus, Source } from "./api";
import { SourceDrawer } from "./Drawer";
import {
  CLASSIFICATION_CAPTION,
  clsKey,
  hormoneLabel,
  lifeStageLabel,
  STATUS_LABEL,
} from "./labels";

const NOT_REPORTED_LINE =
  "“Not reported in the sources reviewed” does not mean the medicine does not work or is unsafe. AMIRA measures evidence coverage, not clinical performance.";

interface CardDef {
  title: string;
  render: (r: EvidenceReport) => { value: string; status?: ReportedStatus; sub?: string };
  show?: (r: EvidenceReport) => boolean;
}

const STATUS_CLASS: Record<ReportedStatus, string> = {
  yes: "status-yes",
  no: "status-no",
  uncertain: "status-uncertain",
  not_reported: "status-not_reported",
  unknown: "status-unknown",
};

const CARDS: CardDef[] = [
  {
    title: "Women represented",
    render: (r) => {
      const s = r.evidence_summary;
      if (s.female_n == null && s.female_pct == null)
        return { value: "Not reported", status: "not_reported" };
      const pct = s.female_pct != null ? `${s.female_pct}%` : "—";
      const n = s.female_n != null ? s.female_n.toLocaleString() : "—";
      const total = s.total_n != null ? s.total_n.toLocaleString() : "—";
      return { value: pct, sub: `${n} women of ${total} participants` };
    },
  },
  {
    title: "Sex-specific efficacy reported",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.sex_stratified_efficacy_reported],
      status: r.evidence_summary.sex_stratified_efficacy_reported,
    }),
  },
  {
    title: "Sex-specific safety reported",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.sex_stratified_safety_reported],
      status: r.evidence_summary.sex_stratified_safety_reported,
    }),
  },
  {
    title: "Sex × treatment interaction tested",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.sex_by_treatment_interaction_tested],
      status: r.evidence_summary.sex_by_treatment_interaction_tested,
    }),
  },
  {
    title: "Menopausal status reported",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.menopausal_status_reported],
      status: r.evidence_summary.menopausal_status_reported,
    }),
  },
  {
    title: "Hormonal factors reported",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.hormonal_factors_reported],
      status: r.evidence_summary.hormonal_factors_reported,
    }),
  },
  {
    title: "Hormone therapy reported",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.hormone_therapy_reported],
      status: r.evidence_summary.hormone_therapy_reported,
    }),
    show: (r) => r.evidence_summary.hormone_therapy_reported !== "unknown",
  },
  {
    title: "Pregnancy exclusion",
    render: (r) => ({
      value: STATUS_LABEL[r.evidence_summary.pregnancy_excluded],
      status: r.evidence_summary.pregnancy_excluded,
    }),
    show: (r) =>
      r.evidence_summary.pregnancy_excluded !== "unknown" &&
      r.evidence_summary.pregnancy_excluded !== "not_reported",
  },
];

const FOUND_FIELDS: { key: keyof EvidenceReport["evidence_summary"]; label: string }[] = [
  { key: "sex_stratified_efficacy_reported", label: "Sex-specific efficacy was analyzed and reported" },
  { key: "sex_stratified_safety_reported", label: "Sex-specific safety was analyzed and reported" },
  { key: "sex_by_treatment_interaction_tested", label: "A sex-by-treatment interaction was tested" },
  { key: "menopausal_status_reported", label: "Menopausal status was reported" },
  { key: "hormonal_factors_reported", label: "Hormonal factors were reported" },
  { key: "hormone_therapy_reported", label: "Hormone therapy use was reported" },
  { key: "pregnancy_excluded", label: "Pregnancy handling was explicitly stated" },
];

export function Dashboard({ report }: { report: EvidenceReport }) {
  const [drawer, setDrawer] = useState<{ title: string; subtitle?: string; sources: Source[] } | null>(
    null
  );

  const openAll = () =>
    setDrawer({
      title: `All sources for ${report.medicine}`,
      subtitle: `${report.sources.length} source(s) reviewed`,
      sources: report.sources,
    });

  const openForCard = (title: string) =>
    setDrawer({ title, subtitle: `Sources supporting: ${report.medicine} · ${report.condition}`, sources: report.sources });

  const foundItems = useMemo(
    () =>
      FOUND_FIELDS.filter((f) => report.evidence_summary[f.key] === "yes").map((f) => f.label),
    [report]
  );

  const repItem =
    report.evidence_summary.female_n != null
      ? `Women were represented — ${report.evidence_summary.female_n.toLocaleString()} women` +
        (report.evidence_summary.female_pct != null
          ? ` (${report.evidence_summary.female_pct}% of participants)`
          : "")
      : null;

  const female = report.evidence_summary.female_pct;

  return (
    <div>
      {/* Top summary */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div className="summary-strip">
            <div className="kv">
              <div className="k">Medicine</div>
              <div className="v">{report.medicine}</div>
            </div>
            <div className="kv">
              <div className="k">Condition</div>
              <div className="v">{report.condition}</div>
            </div>
            <div className="kv">
              <div className="k">Life stage</div>
              <div className="v">{lifeStageLabel(report.selected_life_stage || report.life_stage)}</div>
            </div>
            <div className="kv">
              <div className="k">Hormonal context</div>
              <div className="v">
                {hormoneLabel(
                  report.selected_hormone_therapy || report.hormonal_context.hormone_therapy
                ).replace(/^.*: /, "")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span className="badge verified">
              <span className="dot" /> Verified demo data
            </span>
            {report.human_verified && (
              <span className="badge human">
                <span className="dot" /> Human verified
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div className={`classification ${clsKey(report.classification)}`}>
            <span className="cap">Evidence completeness</span>
            <span className="lvl">{report.classification}</span>
          </div>
          <p style={{ maxWidth: 340, fontSize: 13 }}>{CLASSIFICATION_CAPTION}</p>
        </div>
      </div>

      {/* Safety-state banners (distinct code paths / messages) */}
      {report.evidence_state === "NO_EVIDENCE_FOUND" && (
        <div className="state-banner no-evidence">
          <span className="sb-ic">🔍</span>
          <div>
            <h3>We found no relevant evidence in the sources reviewed</h3>
            <p>
              A search was executed and returned no source reporting outcomes for this
              women-and-hormone context. This is an evidence gap — not a finding about whether
              the medicine works.
            </p>
          </div>
        </div>
      )}
      {report.evidence_state === "EVIDENCE_OF_NO_EFFECT" && (
        <div className="state-banner no-effect">
          <span className="sb-ic">⚖️</span>
          <div>
            <h3>A study tested this outcome and reported no benefit or effect</h3>
            <p>
              This is different from missing evidence: a study explicitly examined the outcome in
              this population and reported a null or negative result. See the source for details.
            </p>
          </div>
        </div>
      )}

      {/* Evidence at a glance */}
      <div style={{ marginBottom: 8 }} className="section-title">
        Evidence at a glance
      </div>
      <div className="cards-grid">
        {CARDS.filter((c) => (c.show ? c.show(report) : true)).map((c) => {
          const out = c.render(report);
          return (
            <button className="ecard" key={c.title} onClick={() => openForCard(c.title)}>
              <div className="ec-title">{c.title}</div>
              <div className={`ec-val ${out.status ? STATUS_CLASS[out.status] : ""}`}>
                {out.value}
              </div>
              {out.sub && <div className="ec-sub">{out.sub}</div>}
              <div className="ec-inspect">Inspect source ↗</div>
            </button>
          );
        })}
      </div>

      {/* Found / Missing */}
      <div className="panels">
        <div className="panel found">
          <h3>
            <span>✅</span> What we found
          </h3>
          <ul>
            {repItem && (
              <li>
                <span className="ic">•</span>
                {repItem}
              </li>
            )}
            {foundItems.map((f) => (
              <li key={f}>
                <span className="ic">•</span>
                {f}
              </li>
            ))}
            {!repItem && foundItems.length === 0 && (
              <li>
                <span className="ic">•</span>
                No citation-backed women-specific findings were reported in the reviewed sources.
              </li>
            )}
          </ul>
        </div>

        <div className="panel missing">
          <h3>
            <span>🔎</span> What is still missing
          </h3>
          <ul>
            {report.missing_fields.length === 0 && (
              <li>
                <span className="ic">•</span>
                The reviewed sources reported the tracked women-specific fields.
              </li>
            )}
            {report.missing_fields.map((m) => (
              <li key={m}>
                <span className="ic">•</span>
                {m} — not reported in the sources reviewed
              </li>
            ))}
          </ul>
          <div className="disclaimer">{NOT_REPORTED_LINE}</div>
        </div>
      </div>

      {/* Representation vs analysis teaching line */}
      {female != null && female >= 20 && (
        <div className="callout" style={{ marginTop: 20 }}>
          Women were included in this research — but representation is not the same as complete
          women-specific and hormone-aware evidence. AMIRA shows the difference above.
        </div>
      )}

      {/* Studies behind this result */}
      <div className="card" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="section-title">Studies behind this result</div>
            <p style={{ marginTop: 6, fontSize: 13.5 }}>
              {report.sources.length} source(s). Every classification above links back to these.
            </p>
          </div>
          <button className="cta" style={{ marginTop: 0, padding: "11px 20px", fontSize: 14 }} onClick={openAll}>
            Open all sources
          </button>
        </div>
      </div>

      {drawer && (
        <SourceDrawer
          title={drawer.title}
          subtitle={drawer.subtitle}
          sources={drawer.sources}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
