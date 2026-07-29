import type { CriticalSignal } from "./api";

/** Presentation of a medicine's CRITICAL EVIDENCE SIGNAL, and of how recently the
 *  evidence was reviewed.
 *
 *  A critical signal is its own canonical field. It never replaces, overrides or is
 *  derived from evidence maturity, sex-specific effectiveness, women-specific safety or
 *  any ranking — those remain separate, and a medicine is never ordered or preferred
 *  because it carries (or lacks) a signal. Absence is always bounded to the sources
 *  AMIRA actually reviewed. */

export type SignalTone = "critical" | "caution" | "neutral";

/** Red is reserved for mortality and serious-safety signals. Dosing / regulatory and
 *  outcome-pattern findings are amber. No qualifying signal is neutral. */
export function signalTone(signalType?: string | null): SignalTone {
  const t = (signalType || "").toLowerCase();
  if (t.includes("mortality") || t.includes("serious safety")) return "critical";
  if (t.includes("dosing") || t.includes("regulatory") || t.includes("outcome pattern")) return "caution";
  return "neutral";
}

/** The wording used when a medicine carries no qualifying signal. It always names the
 *  limitation: AMIRA reviewed a defined source set, it did not survey all literature. */
export const NO_SIGNAL = "No critical signal identified in the reviewed source set";

export interface SignalPresentation {
  present: boolean;
  tone: SignalTone;
  /** e.g. "Critical mortality signal", or the canonical type for non-safety signals. */
  label: string;
  /** The canonical headline (carries the primary statistic). */
  headline?: string;
  /** The canonical statistic line. */
  statistic?: string;
  /** How the analysis is characterised, taken verbatim from the recorded cautions. */
  analysis?: string;
  /** Recorded review status — never upgraded. */
  reviewStatus: string;
  signalType?: string;
  sourceUrl?: string | null;
}

/** Build the presentation from the canonical signal record. Nothing is synthesised:
 *  the headline, statistic and analysis note are the stored strings. */
export function presentSignal(signal?: CriticalSignal | null): SignalPresentation {
  if (!signal) {
    return { present: false, tone: "neutral", label: NO_SIGNAL, reviewStatus: "" };
  }
  const type = signal.signal_type || "";
  const tone = signalTone(type);
  // "Mortality" / "Serious Safety" read naturally as "Critical … signal"; the dosing and
  // outcome-pattern types are already full phrases and are shown verbatim.
  const label = tone === "critical"
    ? `Critical ${type.toLowerCase()} signal`
    : type;
  return {
    present: true,
    tone,
    label,
    headline: signal.headline || undefined,
    statistic: signal.summary || undefined,
    // The first recorded caution characterises the analysis (e.g. "Historical post hoc
    // signal"). Rendered verbatim rather than reworded.
    analysis: signal.cautions?.[0],
    reviewStatus: signal.human_verified ? "Human review completed" : "Human review pending",
    signalType: type,
    sourceUrl: signal.source_url,
  };
}

/** Which Check Evidence section a signal belongs beside. Safety-natured signals sit
 *  with women-specific safety; an outcome-pattern signal sits with the effectiveness
 *  finding it came from. */
export function signalSection(signalType?: string | null): "safety" | "effectiveness" {
  return (signalType || "").toLowerCase().includes("outcome pattern") ? "effectiveness" : "safety";
}

/* ------------------------------ Evidence freshness ------------------------------ */

export type FreshnessTone = "current" | "due" | "overdue";

export interface Freshness {
  label: string;
  tone: FreshnessTone;
  days: number;
}

/** How recently the evidence was reviewed, derived from the canonical cutoff date and
 *  the real current date. A future cutoff is treated as current (0 days elapsed). */
export function freshness(cutoff?: string | null, now: Date = new Date()): Freshness | null {
  if (!cutoff) return null;
  const then = new Date(`${cutoff}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
  if (days <= 30) return { label: "Current", tone: "current", days };
  if (days <= 90) return { label: "Review due", tone: "due", days };
  return { label: "Update needed", tone: "overdue", days };
}

/** The canonical label for the date evidence was reviewed up to. */
export const REVIEWED_THROUGH_LABEL = "Evidence reviewed through";

/** "Last checked for new sources" is shown ONLY when a real recorded update-check
 *  timestamp exists. AMIRA records no such field today, so this returns null and the
 *  line is omitted rather than inferred from a response or build time. */
export function lastCheckedForNewSources(record?: { last_source_check?: string | null }): string | null {
  const stamp = record?.last_source_check;
  return stamp ? String(stamp).slice(0, 10) : null;
}
