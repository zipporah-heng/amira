import type { EvidenceResponse } from "../api";

/** Section 6 — "How were women represented?"
 *  Deliberately NOT "Were women like her represented?" — AMIRA does not yet
 *  perform patient-level evidence matching. Each card shows a plain-language
 *  state and what that state means. States are derived from the reviewed
 *  evidence; not_located and not_reported are never collapsed into "No". */

type CardState = "yes" | "limited" | "not_reported" | "not_located" | "excluded" | "not_applicable";

const STATE_META: Record<CardState, { label: string; tone: string; meaning: string }> = {
  yes: { label: "Yes", tone: "present", meaning: "Reported in the reviewed evidence." },
  limited: { label: "Limited", tone: "unclear", meaning: "Partly reported, or reported without a formal comparison." },
  not_reported: { label: "Not reported", tone: "missing", meaning: "A source was reviewed and reports none." },
  not_located: { label: "Not located", tone: "neutral", meaning: "No accessible source with this information was retrieved." },
  excluded: { label: "Excluded", tone: "neutral", meaning: "Explicitly excluded from the study population." },
  not_applicable: { label: "Not applicable", tone: "neutral", meaning: "Not applicable to this evidence." },
};

function dimReporting(report: EvidenceResponse, dim: string): number {
  return report.dimensions.find((d) => d.dimension === dim)?.n_reporting ?? 0;
}

function fromClinicalState(state: string): CardState {
  const s = state.toLowerCase();
  if (s.includes("not reported")) return "not_reported";
  if (s.includes("insufficient")) return "not_located";
  if (s.includes("unclear") || s.includes("no comparison") || s.includes("no formal") || s.includes("women; no")) return "limited";
  return "yes";
}

export function Representation({ report }: { report: EvidenceResponse }) {
  const t = report.totals!;
  const trials = report.trials;
  const womenState: CardState = t.women_reported_count > 0
    ? "yes"
    : (t.trials_with_percentage_only.length > 0 ? "limited"
      : (t.trials_without_female_count_or_percentage?.length ? "not_located" : "not_reported"));

  // "Older women" from age eligibility only — never a menopause inference.
  const enrolledOlder = trials.some((tr) => {
    const m = (tr.minimum_age || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) >= 60 : false;
  });

  // Hormone therapy: distinguish "excluded" (Valsartan/HAYOZ) from "not reported".
  const htReporting = dimReporting(report, "hormone_therapy_reported");
  const htExcluded = report.hormone_therapy_context?.status === "hormone_therapy_population_not_represented"
    || report.trials.some((tr) => tr.hormone_therapy_reported === "yes") && htReporting > 0
      && report.hormone_therapy_context?.selected === "any"
      && report.query.medicine.toLowerCase() === "valsartan";

  const cards: { title: string; state: CardState; detail?: string }[] = [
    { title: "Women included", state: womenState,
      detail: t.women_reported_count > 0 ? `${t.women_reported_count.toLocaleString()} women reported.` : undefined },
    { title: "Sex-specific effectiveness", state: fromClinicalState(report.effectiveness?.state || "") },
    { title: "Sex-specific safety", state: fromClinicalState(report.safety?.state || "") },
    { title: "Menopause", state: dimReporting(report, "menopause_status_reported") > 0 ? "yes" : "not_reported",
      detail: "Menopausal status is never inferred from age." },
    { title: "Hormone therapy",
      state: htReporting > 0 ? "yes" : (htExcluded ? "excluded" : "not_reported") },
    { title: "Pregnancy", state: dimReporting(report, "pregnancy_evidence_reported") > 0 ? "yes" : "not_reported",
      detail: "Pregnant women are rarely represented in these trial populations." },
    { title: "Older women", state: enrolledOlder ? "limited" : "not_reported",
      detail: "Based on age eligibility only." },
    { title: "Race and ethnicity", state: "not_located",
      detail: "Not captured in the reviewed structured evidence." },
    { title: "Hormonal variability", state: "not_located",
      detail: "Cycle phase / hormonal transition not reported in these trials." },
  ];

  return (
    <section className="card representation" id="representation" style={{ marginTop: 22 }}>
      <div className="section-title">How were women represented?</div>
      <p className="muted" style={{ marginTop: 6 }}>
        What the reviewed studies did and did not capture about women. Each state is explained; a gap in
        reporting is not evidence of absence.
      </p>
      <div className="rep-grid">
        {cards.map((c) => {
          const m = STATE_META[c.state];
          return (
            <div className={`rep-card ${m.tone}`} key={c.title}>
              <div className="rep-title">{c.title}</div>
              <span className={`rep-state ${m.tone}`}>{m.label}</span>
              <div className="rep-meaning">{c.detail || m.meaning}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
