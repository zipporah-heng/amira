import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse } from "../api";

/** Compare Women's Evidence — three GLP-1 brand cards side by side. Every value is
 *  read from the canonical /api/check-evidence response for that brand; nothing here
 *  is hard-coded and no maturity value is assigned in the frontend. The cards compare
 *  HOW THOROUGHLY women were studied — not clinical effectiveness across unlike trials. */

const BRANDS = [
  { medicine: "Ozempic", condition: "Type 2 diabetes" },
  { medicine: "Wegovy", condition: "Weight management" },
  { medicine: "Mounjaro", condition: "Type 2 diabetes" },
];

function checkHref(medicine: string, condition: string, drugClass?: string) {
  const p = new URLSearchParams({ healthArea: "Metabolic Health", condition, medicine });
  if (drugClass) p.set("drugClass", drugClass);
  return `/amira/check-evidence?${p.toString()}`;
}

/** A level >=2 means a sex-specific analysis was reported (Women Analyzed). Level 1
 *  means women were only counted. Derived from the canonical maturity value. */
function analyzed(report: EvidenceResponse) {
  const lvl = report.maturity?.level ?? 0;
  const scorable = report.maturity?.scorable !== false;
  if (scorable && lvl >= 2) return { label: "Women analyzed", tone: "yes" as const };
  if (scorable && lvl >= 1) return { label: "Women counted, not yet analyzed", tone: "no" as const };
  return { label: "Not yet established", tone: "no" as const };
}

function traceSatisfied(report: EvidenceResponse, level: number): boolean {
  return !!report.maturity?.rule_trace?.find((t) => t.level === level)?.satisfied;
}

function CompareCard({ report }: { report: EvidenceResponse }) {
  const b = report.banner!;
  const t = report.totals!;
  const condition = report.query?.condition || b.indication || "";
  const study = report.trials?.[0]?.display_name || "—";
  const women = t.women_reported_count > 0 ? t.women_reported_count : t.women_estimated_total;
  const womenIsEstimate = !(t.women_reported_count > 0) && t.women_estimated_total > 0;
  const pct = t.women_pct_of_participants;
  const an = analyzed(report);
  const lifeStage = traceSatisfied(report, 3) ? "Reported" : "Not established";
  const hormonal = traceSatisfied(report, 4) ? "Reported" : "Not established";
  const mat = report.maturity!;
  const humanReviewed = (report.human_verification_status || "pending") !== "pending";
  // Up to two exact-passage links from the source records behind this brand.
  const passages = (report.studies_behind || [])
    .filter((s) => s.source_url)
    .slice(0, 3)
    .map((s) => ({ label: s.study, url: s.source_url }));

  // A. Known adverse effects (label-level, overall). B. Women-specific safety (by-sex).
  const kae = b.known_adverse_effects;
  const safetyFindings = [
    ...(report.safety?.significant_findings || []),
    ...(report.safety?.other_findings || []),
  ];
  const bySex = safetyFindings.find((f) => f.female_rate || f.male_rate);

  return (
    <div className="cmp-card">
      {/* 1. Brand + active ingredient */}
      <div className="cmp-brand">{b.medicine}</div>
      <div className="cmp-ingredient">{b.active_ingredient}</div>
      {b.brand_note && <div className="cmp-brandnote">{b.brand_note}</div>}

      {/* 2. Condition + study */}
      <div className="cmp-row"><span className="cmp-k">Evidence context</span><span className="cmp-v">{condition}</span></div>
      <div className="cmp-row"><span className="cmp-k">Primary study</span><span className="cmp-v">{study}</span></div>

      {/* 3. Women represented */}
      <div className="cmp-row"><span className="cmp-k">Women represented</span>
        <span className="cmp-v">{pct != null ? `${pct}%` : "—"}{women ? ` · ${womenIsEstimate ? "~" : ""}${women.toLocaleString()} of ${t.participants_total.toLocaleString()}` : ""}</span></div>

      {/* 4. Known adverse effects (OVERALL — from the reviewed prescribing information) */}
      {kae && kae.list?.length > 0 && (
        <div className="cmp-block">
          <div className="cmp-k">Known adverse effects (reviewed sources)</div>
          <div className="cmp-ae">{kae.list.join(" · ")}</div>
          {kae.source?.url && (
            <a className="cmp-passage" href={kae.source.url} target="_blank" rel="noopener noreferrer">
              Prescribing information →
            </a>
          )}
        </div>
      )}

      {/* 5. Were women analyzed? (sex-specific EFFECTIVENESS) */}
      <div className="cmp-block">
        <div className="cmp-k">Were women analyzed?</div>
        <div><span className={`cmp-chip ${an.tone}`}>{an.label}</span></div>
        <div className="cmp-sub">{report.effectiveness?.state}</div>
      </div>

      {/* 6. Women-specific safety (by sex — a DIFFERENT question from overall AEs) */}
      <div className="cmp-block">
        <div className="cmp-k">Women-specific safety</div>
        <div className="cmp-sub">{report.safety?.state}</div>
        {bySex && (bySex.female_rate || bySex.male_rate) && (
          <div className="cmp-bysex">
            {bySex.female_rate && <div>Women: {bySex.female_rate}</div>}
            {bySex.male_rate && <div>Men: {bySex.male_rate}</div>}
          </div>
        )}
      </div>

      {/* 6. Life stage + hormonal context */}
      <div className="cmp-row"><span className="cmp-k">Life-stage evidence</span><span className="cmp-v">{lifeStage}</span></div>
      <div className="cmp-row"><span className="cmp-k">Hormonal context</span><span className="cmp-v">{hormonal}</span></div>

      {/* 7. Evidence Maturity */}
      <div className="cmp-row"><span className="cmp-k">Evidence Maturity</span>
        <span className="cmp-v cmp-mat">{mat.scorable === false ? "Not yet established" : `${mat.display} · ${mat.label}`}</span></div>
      <div className="cmp-row"><span className="cmp-k">Evidence status</span>
        <span className={`cmp-badge ${humanReviewed ? "ok" : "pending"}`}>{humanReviewed ? "Human reviewed" : "Source verified · Human review pending"}</span></div>

      {/* 8. View evidence */}
      <div className="cmp-links">
        <a className="cmp-viewfull" href={checkHref(b.medicine, condition, b.drug_class)}>View full evidence →</a>
        {passages.map((p) => (
          <a key={p.url} className="cmp-passage" href={p.url} target="_blank" rel="noopener noreferrer">Exact passage: {p.label} →</a>
        ))}
      </div>
    </div>
  );
}

export function Compare() {
  const [reports, setReports] = useState<(EvidenceResponse | null)[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(BRANDS.map((x) =>
      checkEvidence({ condition: x.condition, medicine: x.medicine, life_stage: "not_specified", hormone_therapy: "any" })
        .catch(() => null)))
      .then(setReports)
      .catch((e) => setError(e.message || "Could not load comparison"));
  }, []);

  const ready = reports.filter(Boolean) as EvidenceResponse[];

  return (
    <div className="compare-page">
      <span className="eyebrow">Compare Women's Evidence</span>
      <h1 className="page-q">How thoroughly were women studied?</h1>
      <p className="page-sub">
        A side-by-side view of three GLP-1 medicines. AMIRA compares how visible and mature the
        evidence about women is — not to rank their clinical effectiveness.
      </p>

      {/* Required comparison warning */}
      <p className="cmp-warning">
        These cards compare the maturity and visibility of evidence about women. They do not rank
        medicines or compare clinical effectiveness across different indications, doses, populations,
        or trials.
      </p>

      {error && <div className="callout" style={{ marginTop: 16 }}>{error}</div>}
      {!error && ready.length === 0 && <p style={{ marginTop: 16 }}>Loading comparison…</p>}

      {ready.length > 0 && (
        <div className="cmp-grid">
          {ready.map((r) => <CompareCard key={r.banner!.medicine} report={r} />)}
        </div>
      )}

      {/* Evidence scope */}
      <p className="cmp-scope">
        This comparison reflects the defined studies and regulatory sources currently reviewed by
        AMIRA for each brand — not all GLP-1 evidence and not a complete clinical program.
      </p>
    </div>
  );
}
