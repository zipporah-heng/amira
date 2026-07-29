import type { EvidenceResponse, Finding, WomenIncludedStudy } from "./api";

/** THE SINGLE DERIVATION LAYER for everything AMIRA displays or exports about one
 *  medicine's evidence.
 *
 *  Both the Check Evidence page, the Compare Evidence matrix and the PDF exports read
 *  this module — there is no separate export truth source. Every value here comes from
 *  the canonical /api/check-evidence response. Nothing is invented, inferred from age,
 *  or upgraded: a missing analysis stays missing, and "not reported" is never converted
 *  into evidence of no difference. */

export type StateTone = "reported" | "limited" | "not_reported" | "incomplete";

export interface EvidenceCell {
  /** Short label safe for a compact comparison cell. */
  label: string;
  /** Optional secondary detail (counts, percentages, scope). */
  detail?: string;
  tone: StateTone;
}

/** Canonical evidence-state strings → a semantic tone. Tone drives colour AND is always
 *  accompanied by its text label, so colour is never the only signal. */
export function toneForState(state: string | undefined | null): StateTone {
  const s = (state || "").toLowerCase();
  if (!s) return "incomplete";
  if (s.includes("not reported") || s.includes("not_reported")) return "not_reported";
  if (s.includes("could not be located") || s.includes("not located") || s.includes("insufficient")) return "incomplete";
  if (s.includes("unclear") || s.includes("no formal") || s.includes("discussed")) return "limited";
  return "reported";
}

export const medicineName = (r: EvidenceResponse) => r.banner?.medicine || "";
export const activeIngredient = (r: EvidenceResponse) => r.banner?.active_ingredient || null;
export const drugClass = (r: EvidenceResponse) => r.banner?.drug_class || "";
export const condition = (r: EvidenceResponse) => r.query?.condition || r.banner?.indication || "";
export const brandNote = (r: EvidenceResponse) => r.banner?.brand_note || null;

/** True when a canonical maturity rule-trace level was satisfied. */
export const levelSatisfied = (r: EvidenceResponse, level: number) =>
  !!r.maturity?.rule_trace?.find((t) => t.level === level)?.satisfied;

/** Evidence maturity exactly as derived by the backend. Unscorable stays unscored —
 *  never rendered as 0 / 5. */
export function maturity(r: EvidenceResponse) {
  const m = r.maturity;
  const scorable = m?.scorable !== false;
  return {
    level: m?.level ?? 0,
    maxLevel: m?.max_level ?? 5,
    label: m?.label || "",
    scorable,
    display: scorable ? `${m?.level ?? 0} / ${m?.max_level ?? 5}` : "Not yet established",
  };
}

/** The primary study (or regulatory record) this evidence rests on. */
export function evidencePopulation(r: EvidenceResponse): EvidenceCell {
  const t = r.trials?.[0];
  if (!t) return { label: "Not established", tone: "incomplete" };
  const scope = [r.banner?.indication, t.study_type].filter(Boolean).join(" · ");
  return { label: t.display_name, detail: scope || undefined, tone: "reported" };
}

/** Bounded wording used whenever female enrolment is known for some reviewed studies
 *  but not all. It replaces any combined figure — never sits beside one. */
export const PARTIAL_WOMEN_LABEL = "Partially reported across reviewed studies";

/** The canonical study-by-study female enrolment rows. Every surface (Check Evidence,
 *  Compare Evidence, the PDF exports) renders these same rows. */
export function womenIncludedStudies(r: EvidenceResponse): WomenIncludedStudy[] {
  return r.totals?.women_included?.per_study || [];
}

/** One study's female enrolment, worded exactly as the API composed it. */
export function studyWomenLabel(s: WomenIncludedStudy): string {
  if (s.female_n == null) return "Female enrollment count not located";
  const approx = s.female_basis === "derived" ? "approximately " : "";
  const pct = s.female_pct_reported != null ? `, ${s.female_pct_reported}%` : "";
  if (s.total_enrollment == null) return `${approx}${s.female_n.toLocaleString()} women`;
  return `${approx}${s.female_n.toLocaleString()} of ${s.total_enrollment.toLocaleString()}${pct}`;
}

/** The supporting sentence for a partially reported medicine, e.g.
 *  "DECISION reported 284 of 1,001 women, 28.0%. The female enrollment count was not
 *  located for DIG." Composed by the API so no surface can reword it. */
export function womenIncludedDetail(r: EvidenceResponse): string {
  return r.totals?.women_included?.detail || "";
}

/** True when the medicine-level figure is only partly known. */
export function womenIncludedPartial(r: EvidenceResponse): boolean {
  return r.totals?.women_included?.state === "partially_reported";
}

/** Women included — the canonical medicine-level answer.
 *
 *  FAIL-CLOSED AGGREGATION: a combined numerator/denominator (and therefore any
 *  combined percentage) is shown ONLY when every reviewed study contributes a
 *  compatible verified pair. A known count from one study is never divided by a
 *  denominator that includes studies with unknown female enrolment — that produced
 *  the incorrect "284 of 7,801" for Digoxin. When coverage is partial the label is
 *  bounded wording and the study-specific values carry the numbers. */
export function womenIncluded(r: EvidenceResponse): EvidenceCell {
  const t = r.totals;
  if (!t) return { label: "Not established", tone: "incomplete" };
  const wi = t.women_included;

  // Canonical path — the API states the answer, including its bounded wording.
  if (wi) {
    if (wi.state === "reported") {
      const pct = wi.combined_percentage != null ? ` (${wi.combined_percentage}%)` : "";
      return { label: `${wi.label}${pct}`, tone: "reported" };
    }
    if (wi.state === "partially_reported") {
      return { label: PARTIAL_WOMEN_LABEL, detail: wi.detail, tone: "limited" };
    }
    // Nothing located anywhere. A verified sex-specific finding still counts as
    // evidence that women were included, so it is not called "not reported".
    const hasFinding =
      (r.effectiveness?.findings?.length || 0) > 0 ||
      (r.safety?.significant_findings?.length || 0) > 0 ||
      (r.safety?.other_findings?.length || 0) > 0;
    if (hasFinding || levelSatisfied(r, 1)) {
      return { label: PARTIAL_WOMEN_LABEL, detail: wi.detail, tone: "limited" };
    }
    return { label: "Not reported", detail: wi.detail || undefined, tone: "not_reported" };
  }

  // Fallback for a response without the canonical block: still never combine across
  // studies with unknown female enrolment.
  const missing = t.trials_without_female_count_or_percentage?.length || 0;
  const counted = levelSatisfied(r, 1);
  const reported = t.women_reported_count > 0 ? t.women_reported_count : 0;
  const hasFinding =
    (r.effectiveness?.findings?.length || 0) > 0 ||
    (r.safety?.significant_findings?.length || 0) > 0 ||
    (r.safety?.other_findings?.length || 0) > 0;
  if (missing > 0) {
    if (!(reported || counted || hasFinding)) return { label: "Not reported", tone: "not_reported" };
    return { label: PARTIAL_WOMEN_LABEL, tone: "limited" };
  }
  const n = reported || (t.women_estimated_total > 0 ? t.women_estimated_total : 0);
  const total = t.participants_total;
  const pct = t.women_pct_of_participants;
  if (!(n && total)) {
    if (counted || hasFinding) return { label: "Reported", tone: "reported" };
    return { label: "Not reported", tone: "not_reported" };
  }
  const approx = reported ? "" : "approximately ";
  return {
    label: `${approx}${n.toLocaleString()} of ${total.toLocaleString()}${pct != null ? ` (${pct}%)` : ""}`,
    tone: "reported",
  };
}

/** Women counted — the participants were reported. Distinct from Women analyzed. */
export function womenCounted(r: EvidenceResponse): EvidenceCell {
  const ok = levelSatisfied(r, 1);
  return { label: ok ? "Yes" : "Not established", tone: ok ? "reported" : "incomplete" };
}

/** Women analyzed — outcomes were analysed separately by sex. NEVER implied by a high
 *  proportion of women in the study. */
export function womenAnalyzed(r: EvidenceResponse): EvidenceCell {
  const ok = levelSatisfied(r, 2);
  const postHoc = (r.effectiveness?.findings || []).some((f) => /post hoc/i.test(f.interpretation || ""));
  return {
    label: ok ? (postHoc ? "Yes (post hoc)" : "Yes") : "Not established",
    tone: ok ? "reported" : "incomplete",
  };
}

/** "Sex-specific outcomes" in the representation row IS the women-analyzed question.
 *  Aliased (not re-derived) so the summary row can never disagree with the detail. */
export const sexSpecificOutcomes = womenAnalyzed;

/** A compact label for the representation row, derived from the SAME cell the detailed
 *  section renders. Only the wording is shortened — never the state. */
export function shortLabel(cell: EvidenceCell): string {
  // Keep an already-short canonical answer verbatim (e.g. "Yes", "Yes (post hoc)").
  if (cell.label.length <= 18) return cell.label;
  // Partial female-enrolment coverage keeps its meaning in the compact row: it must read
  // as partially reported, not merely "Limited".
  if (cell.label === PARTIAL_WOMEN_LABEL) return "Partially reported";
  switch (cell.tone) {
    case "reported": return "Reported";
    case "limited": return "Limited";
    case "not_reported": return "Not reported";
    default: return "Not established";
  }
}

/** Pregnancy-specific evidence, from the canonical pregnancy dimension. */
export function pregnancyEvidence(r: EvidenceResponse): EvidenceCell {
  const n = r.dimensions?.find((x) => x.dimension === "pregnancy_evidence_reported")?.n_reporting ?? 0;
  return n > 0 ? { label: "Reported", tone: "reported" } : { label: "Not reported", tone: "not_reported" };
}

/** Age reporting — whether the reviewed records state an age eligibility. This is a
 *  registry FACT about reporting; it never implies that older women were studied, and
 *  age is never used to infer menopausal status. */
export function ageReporting(r: EvidenceResponse): EvidenceCell {
  const withAge = (r.trials || []).filter((t) => !!t.minimum_age);
  if (!withAge.length) return { label: "Not reported", tone: "not_reported" };
  return { label: "Reported", detail: `Minimum age ${withAge[0].minimum_age}`, tone: "reported" };
}

/** Race and ethnicity is not a dimension AMIRA has reviewed for any medicine, so it
 *  stays explicitly unestablished rather than being reported as absent from the
 *  literature — AMIRA never claims a source is silent on something it did not check. */
export function raceEthnicity(_r: EvidenceResponse): EvidenceCell {
  return { label: "Not established", detail: "Not a reviewed dimension", tone: "incomplete" };
}

export function effectiveness(r: EvidenceResponse): EvidenceCell {
  const state = r.effectiveness?.state || "";
  return { label: state || "Not established", tone: toneForState(state) };
}

export function safety(r: EvidenceResponse): EvidenceCell {
  const state = r.safety?.state || "";
  return { label: state || "Not established", tone: toneForState(state) };
}

/** Overall adverse effects from the reviewed prescribing information. This is the
 *  LABEL-level layer and is deliberately kept separate from women-specific safety;
 *  it must never be presented as specific to women. */
export function commonAdverseEffects(r: EvidenceResponse) {
  const kae = r.banner?.known_adverse_effects;
  if (!kae || !kae.list?.length) return null;
  return { list: kae.list, source: kae.source, exactPassage: kae.exact_passage || null };
}

export function lifeStageEvidence(r: EvidenceResponse): EvidenceCell {
  const ok = levelSatisfied(r, 3);
  return { label: ok ? "Reported" : "Not established", tone: ok ? "reported" : "incomplete" };
}

/** Hormonal context is three distinct canonical questions, never collapsed into one. */
export function hormonalContext(r: EvidenceResponse) {
  const dim = (d: string) => r.dimensions?.find((x) => x.dimension === d)?.n_reporting ?? 0;
  const meno = dim("menopause_status_reported") > 0;
  const ht = dim("hormone_therapy_reported") > 0;
  const analysis = levelSatisfied(r, 4);
  const cell = (ok: boolean): EvidenceCell =>
    ok ? { label: "Reported", tone: "reported" } : { label: "Not reported", tone: "not_reported" };
  return {
    menopauseRepresentation: cell(meno),
    hormoneTherapyRepresentation: cell(ht),
    hormonalContextAnalysis: analysis
      ? ({ label: "Reported", tone: "reported" } as EvidenceCell)
      : ({ label: "Not established", tone: "incomplete" } as EvidenceCell),
  };
}

export interface PassageRecord {
  study: string;
  passage: string;
  sourceTitle: string;
  sourceId: string;
  locator: string | null;
  url: string;
}

/** Exact supporting passages, with the source record behind each one. Only verified,
 *  source-linked findings appear — nothing is paraphrased or generated. */
export function exactPassages(r: EvidenceResponse): PassageRecord[] {
  const out: PassageRecord[] = [];
  const push = (f: Finding) => {
    if (!f?.exact_passage || !f.source?.url) return;
    if (out.some((p) => p.passage === f.exact_passage)) return;
    out.push({
      study: f.scope || f.endpoint || f.source.title,
      passage: f.exact_passage,
      sourceTitle: f.source.title,
      sourceId: f.source.source_id,
      locator: f.source_locator || null,
      url: f.source.url,
    });
  };
  (r.effectiveness?.findings || []).forEach(push);
  (r.safety?.significant_findings || []).forEach(push);
  (r.safety?.other_findings || []).forEach(push);
  (r.safety?.class_context_findings || []).forEach(push);
  const kae = r.banner?.known_adverse_effects;
  if (kae?.exact_passage && kae.source?.url) {
    out.push({
      study: "Prescribing information",
      passage: kae.exact_passage,
      sourceTitle: kae.source.title || "Prescribing information",
      sourceId: kae.source.source_id,
      locator: kae.source_locator || null,
      url: kae.source.url,
    });
  }
  return out;
}

/** Source records reviewed FOR THIS MEDICINE, deduplicated, resolvable links only.
 *
 *  Built from the medicine's own trial assertions and findings — deliberately NOT from
 *  the response's corpus-wide `sources` list, which would report every source in the
 *  dataset as though it had been reviewed for this one medicine. */
export function sourceRecords(r: EvidenceResponse) {
  const seen = new Map<string, { sourceId: string; title: string; url: string }>();
  const add = (sourceId?: string, title?: string | null, url?: string | null) => {
    if (!sourceId || !url || seen.has(sourceId)) return;
    seen.set(sourceId, { sourceId, title: title || sourceId, url });
  };
  (r.trials || []).forEach((t) => {
    (t.assertions || []).forEach((a) => add(a.source?.source_id, a.source?.title, a.source?.url));
  });
  exactPassages(r).forEach((p) => add(p.sourceId, p.sourceTitle, p.url));
  return [...seen.values()];
}

/** Human review status exactly as recorded — never upgraded to "completed". */
export function humanReviewStatus(r: EvidenceResponse) {
  const raw = (r.human_verification_status || "").toLowerCase();
  if (raw === "verified" || raw === "complete" || raw === "completed") return "Completed";
  if (raw === "pending" || !raw) return "Pending";
  return r.human_verification_status;
}

export const evidenceCutoff = (r: EvidenceResponse) => r.source_cutoff || "";

/** What AMIRA actually reviewed for this medicine, from the canonical study selection.
 *  Null when the response carries no selection record — never estimated. */
export function evidenceRecordsReviewed(r: EvidenceResponse) {
  const ss = r.study_selection;
  if (!ss) return null;
  return {
    records: ss.rcts_for_selected_medicine,
    publications: ss.publications_for_selected_medicine,
  };
}

/** How many sex-specific findings were located for this medicine, counted from the
 *  canonical finding lists rather than stored as a headline number. */
export function sexSpecificFindingsLocated(r: EvidenceResponse): number {
  const eff = r.effectiveness?.findings?.length || 0;
  const saf = (r.safety?.significant_findings?.length || 0)
    + (r.safety?.trend_findings?.length || 0)
    + (r.safety?.other_findings?.length || 0);
  return eff + saf;
}

/** AMIRA has not completed a guideline-level coverage review. Stated as a limitation
 *  rather than implied by silence. */
export const GUIDELINE_LIMITATION =
  "Guideline-level coverage review not yet completed. AMIRA reports coverage within a defined source set, not against a full guideline source list.";

/** Known limitations, taken from the canonical evidence gaps plus AMIRA's standing
 *  interpretation boundaries. */
export function limitations(r: EvidenceResponse): string[] {
  const gaps = (r.evidence_gaps || []).map((g) => g.statement).filter(Boolean);
  return [
    ...gaps,
    GUIDELINE_LIMITATION,
    "AMIRA reports what is known from the reviewed sources. It does not claim that every relevant study has been reviewed.",
  ];
}

/** The standing non-diagnosis / non-recommendation statement carried by every export. */
export const NON_RECOMMENDATION =
  "AMIRA compares the completeness and visibility of evidence about women. It does not diagnose, prescribe, recommend treatment, or recommend one medicine over another.";
