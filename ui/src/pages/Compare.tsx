import { useEffect, useState } from "react";
import { checkEvidence, type EvidenceResponse } from "../api";
import { hormonalContextToApi, type HealthAreaEntry, type MedicineEntry } from "../components/EvidenceSearch";

/** Compare Women's Evidence — CONTEXTUAL and DYNAMIC.
 *
 *  The comparison set is derived from the user's SELECTED CONDITION using the canonical
 *  taxonomy (/api/catalog) — never a hard-coded medicine list. Every reviewed medicine
 *  registered under the same condition is compared (regardless of drug class), with the
 *  selected medicine shown first. Medicines that merely share an active ingredient but
 *  belong to a different condition are NOT grouped together. */

interface CondMed extends MedicineEntry { drug_class: string; }

function readContext() {
  const p = new URLSearchParams(window.location.search);
  return {
    healthArea: p.get("healthArea") || "Cardiovascular",
    condition: p.get("condition") || "Heart failure",
    medicine: p.get("medicine") || "Digoxin",
    lifeStage: p.get("lifeStage") || "not_specified",
    hormonalContext: p.get("hormonalContext") || "Any",
  };
}

/** All medicines registered under a condition, across every drug class, from the
 *  canonical catalog. Matches health-area + condition first; falls back to the first
 *  condition of that name if the health area is not found. */
function medicinesForCondition(catalog: HealthAreaEntry[], healthArea: string, condition: string): CondMed[] {
  const conds = (catalog.find((h) => h.health_area === healthArea)?.conditions
    || catalog.flatMap((h) => h.conditions));
  const cond = conds.find((c) => c.condition === condition)
    || catalog.flatMap((h) => h.conditions).find((c) => c.condition === condition);
  if (!cond) return [];
  const out: CondMed[] = [];
  for (const cls of cond.drug_classes) {
    for (const m of cls.medicines) out.push({ ...m, drug_class: cls.drug_class });
  }
  return out;
}

function checkHref(c: { healthArea: string; condition: string; drugClass?: string; medicine: string }) {
  const p = new URLSearchParams({ healthArea: c.healthArea, condition: c.condition, medicine: c.medicine });
  if (c.drugClass) p.set("drugClass", c.drugClass);
  return `/amira/check-evidence?${p.toString()}`;
}

const traceSatisfied = (r: EvidenceResponse, level: number) =>
  !!r.maturity?.rule_trace?.find((t) => t.level === level)?.satisfied;

function analyzedTone(r: EvidenceResponse) {
  const lvl = r.maturity?.level ?? 0;
  const scorable = r.maturity?.scorable !== false;
  if (scorable && lvl >= 2) return { label: "Yes", tone: "yes" as const };
  if (scorable && lvl >= 1) return { label: "Not established", tone: "no" as const };
  return { label: "Not established", tone: "no" as const };
}

/** Download a compact evidence brief for one medicine (client-side; no PHI). */
function exportBrief(r: EvidenceResponse) {
  const b = r.banner!; const t = r.totals!;
  const kae = b.known_adverse_effects;
  const lines = [
    `# AMIRA evidence brief — ${b.medicine}`,
    `Active ingredient: ${b.active_ingredient || "—"}`,
    `Condition: ${r.query?.condition || b.indication || "—"}`,
    `Primary study: ${r.trials?.[0]?.display_name || "—"}`,
    `Evidence maturity: ${b.maturity.scorable === false ? "Not yet established" : b.maturity.display}`,
    `Women represented: ${t.women_pct_of_participants != null ? t.women_pct_of_participants + "%" : "—"}`,
    `Sex-specific effectiveness: ${r.effectiveness?.state || "—"}`,
    `Women-specific safety: ${r.safety?.state || "—"}`,
    `Common adverse effects (reviewed sources): ${kae?.list?.join(", ") || "—"}`,
    "",
    "## Exact passages",
    ...(r.studies_behind || []).filter((s) => s.source_url).map((s) => `- ${s.study}: ${s.source_url}`),
    "",
    "AMIRA compares the completeness and visibility of evidence about women. It does not recommend one medicine over another.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `amira-${b.medicine.toLowerCase().replace(/\s+/g, "-")}-brief.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="ce-cell">
      <div className="ce-cell-k">{label}</div>
      <div className={`ce-cell-v ${tone || ""}`}>{value}</div>
    </div>
  );
}

function CompareCard({ report, meta, isSelected, ctx }: {
  report: EvidenceResponse | null; meta: CondMed; isSelected: boolean;
  ctx: ReturnType<typeof readContext>;
}) {
  const href = checkHref({ healthArea: ctx.healthArea, condition: ctx.condition, drugClass: meta.drug_class, medicine: meta.medicine });

  // Incomplete / un-reviewed medicine (status-driven, never inferred from a still-
  // loading fetch): bounded card, explicitly labelled, no scores.
  if (meta.status !== "verified" || (report && (!report.supported || !report.banner))) {
    return (
      <div className={`ce-card ${isSelected ? "selected" : ""}`}>
        {isSelected && <div className="ce-selbadge">Selected medicine</div>}
        <div className="ce-brand">{meta.medicine}</div>
        {meta.active_ingredient && <div className="ce-ingredient">Active ingredient: {meta.active_ingredient.toLowerCase()}</div>}
        <div className="ce-row"><span className="cmp-k">Drug class</span><span className="cmp-v">{meta.drug_class}</span></div>
        <div className="ce-incomplete">
          <div className="ce-inc-badge">Evidence review incomplete</div>
          <div className="ce-inc-sub">Not scored</div>
        </div>
        <div className="ce-links"><a className="cmp-viewfull" href={href}>View full evidence →</a></div>
      </div>
    );
  }

  // Verified medicine whose evidence is still loading.
  if (!report) {
    return (
      <div className={`ce-card ${isSelected ? "selected" : ""}`}>
        {isSelected && <div className="ce-selbadge">Selected medicine</div>}
        <div className="ce-brand">{meta.medicine}</div>
        {meta.active_ingredient && <div className="ce-ingredient">Active ingredient: {meta.active_ingredient.toLowerCase()}</div>}
        <p className="cmp-sub" style={{ marginTop: 10 }}>Loading evidence…</p>
      </div>
    );
  }

  const b = report.banner!; const t = report.totals!;
  const women = t.women_reported_count > 0 ? t.women_reported_count : t.women_estimated_total;
  const womenEst = !(t.women_reported_count > 0) && t.women_estimated_total > 0;
  const pct = t.women_pct_of_participants;
  const an = analyzedTone(report);
  const counted = traceSatisfied(report, 1);
  const isPostHoc = (report.effectiveness?.findings || []).some((f) => /post hoc/i.test(f.interpretation || ""));
  const kae = b.known_adverse_effects;
  const passages = (report.studies_behind || []).filter((s) => s.source_url).slice(0, 3);
  const mat = report.maturity!;
  const study = report.trials?.[0]?.display_name || "—";

  return (
    <div className={`ce-card ${isSelected ? "selected" : ""}`}>
      <div className="ce-head">
        <div>
          {isSelected && <div className="ce-selbadge">Selected medicine</div>}
          <div className="ce-brand">{b.medicine}</div>
          <div className="ce-ingredient">Active ingredient: {(b.active_ingredient || "").toLowerCase()}</div>
        </div>
        <div className="ce-mat"><span className="ce-mat-k">Evidence Maturity</span>
          <span className="ce-mat-v">{mat.scorable === false ? "—" : `${mat.level}`}<span className="ce-mat-den">/5</span></span></div>
      </div>
      <div className="ce-row"><span className="cmp-k">Condition</span><span className="cmp-v">{report.query?.condition || b.indication}</span></div>
      <div className="ce-row"><span className="cmp-k">Drug class</span><span className="cmp-v">{b.drug_class}</span></div>
      <div className="ce-row"><span className="cmp-k">Primary evidence</span><span className="cmp-v">{study}</span></div>
      {b.brand_note && <div className="cmp-brandnote">{b.brand_note}</div>}

      {/* Representation: Included / Counted / Analyzed */}
      <div className="ce-rep">
        <Cell label="Women Included" value={women ? `${womenEst ? "~" : ""}${women.toLocaleString()} of ${t.participants_total.toLocaleString()}${pct != null ? ` · ${pct}%` : ""}` : (pct != null ? `${pct}%` : "—")} tone="yes" />
        <Cell label="Women Counted" value={counted ? "Yes" : "Not established"} tone={counted ? "yes" : "no"} />
        <Cell label="Women Analyzed" value={an.label + (an.tone === "yes" && isPostHoc ? " (post hoc)" : "")} tone={an.tone} />
      </div>

      <div className="ce-block"><div className="cmp-k">Sex-specific effectiveness</div><div className="cmp-sub">{report.effectiveness?.state}</div></div>
      <div className="ce-block"><div className="cmp-k">Women-specific safety</div><div className="cmp-sub">{report.safety?.state}</div></div>

      {kae && kae.list?.length > 0 && (
        <div className="ce-block"><div className="cmp-k">Common adverse effects (reviewed sources)</div>
          <div className="cmp-ae">{kae.list.join(" · ")}</div></div>
      )}

      <div className="ce-row"><span className="cmp-k">Life-stage evidence</span><span className="cmp-v">{traceSatisfied(report, 3) ? "Reported" : "Not established"}</span></div>
      <div className="ce-row"><span className="cmp-k">Hormonal context</span><span className="cmp-v">{traceSatisfied(report, 4) ? "Reported" : "Not established"}</span></div>

      <div className="ce-links">
        <a className="cmp-viewfull" href={href}>View full evidence →</a>
        {passages.map((p) => (
          <a key={p.source_url} className="cmp-passage" href={p.source_url} target="_blank" rel="noopener noreferrer">Exact passage: {p.study} →</a>
        ))}
        <button className="ce-export" onClick={() => exportBrief(report)}>⭳ Export Evidence Brief</button>
      </div>
    </div>
  );
}

export function Compare() {
  const ctx = readContext();
  const [meds, setMeds] = useState<CondMed[] | null>(null);
  const [reports, setReports] = useState<Record<string, EvidenceResponse | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      const all = medicinesForCondition(d.health_areas || [], ctx.healthArea, ctx.condition);
      // Selected medicine first; then the rest with verified before incomplete.
      const ordered = [
        ...all.filter((m) => m.medicine === ctx.medicine),
        ...all.filter((m) => m.medicine !== ctx.medicine)
          .sort((a, b) => (a.status === b.status ? a.medicine.localeCompare(b.medicine) : a.status === "verified" ? -1 : 1)),
      ];
      setMeds(ordered);
      // Fetch evidence for verified medicines (incomplete render bounded without a call).
      ordered.filter((m) => m.status === "verified").forEach((m) => {
        checkEvidence({ condition: ctx.condition, medicine: m.medicine, life_stage: ctx.lifeStage,
          hormone_therapy: hormonalContextToApi(ctx.hormonalContext) })
          .then((r) => setReports((prev) => ({ ...prev, [m.medicine]: r })))
          .catch(() => setReports((prev) => ({ ...prev, [m.medicine]: null })));
      });
    }).catch((e) => setError(e.message || "Could not load the comparison catalog"));
  }, []);

  const otherReviewed = (meds || []).filter((m) => m.medicine !== ctx.medicine && m.status === "verified");
  const onlyOneReviewed = meds !== null && otherReviewed.length === 0;

  return (
    <div className="compare-page">
      <span className="eyebrow">Compare Evidence</span>
      <h1 className="page-q">Compare evidence for medicines studied in {ctx.condition}</h1>
      <p className="page-sub">
        The selected medicine is shown first, alongside other reviewed medicines registered under
        this condition. The comparison is built from the current selection — not a fixed list.
      </p>

      <p className="cmp-warning">
        These cards compare the completeness and visibility of evidence about women. They do not
        recommend one medicine over another.
      </p>

      {error && <div className="callout" style={{ marginTop: 16 }}>{error}</div>}
      {!error && meds === null && <p style={{ marginTop: 16 }}>Loading comparison…</p>}

      {meds && meds.length > 0 && (
        <div className="ce-grid">
          {meds.map((m) => (
            <CompareCard key={m.medicine} meta={m} isSelected={m.medicine === ctx.medicine}
              report={m.status === "verified" ? (reports[m.medicine] ?? null) : null} ctx={ctx} />
          ))}
        </div>
      )}

      {meds && meds.length === 0 && (
        <div className="callout" style={{ marginTop: 16 }}>
          No reviewed medicines are registered under {ctx.condition}.
        </div>
      )}

      {onlyOneReviewed && meds!.length >= 1 && (
        <p className="cmp-scope">
          No other reviewed medicines are currently available for comparison within {ctx.condition}.
        </p>
      )}
    </div>
  );
}
