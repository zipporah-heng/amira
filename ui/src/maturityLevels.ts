/** The single controlled source for the five Evidence Maturity levels' UI copy.
 *
 *  AMIRA's maturity level is DERIVED by the backend (amira/maturity.py) and served
 *  on `report.maturity`. This module only supplies the human-readable label and the
 *  reached / not-reached explanation for each level so the "How this level was
 *  reached" checklist can EXPLAIN the existing derived result. It never computes or
 *  assigns maturity, and the definitions are identical for every medicine. */

export interface MaturityLevelDef {
  level: number;
  label: string;
  /** Shown when the medicine reached this level. */
  reached: string;
  /** Shown when the medicine did not reach this level. */
  notReached: string;
}

export const MATURITY_LEVELS: MaturityLevelDef[] = [
  {
    level: 1,
    label: "Women Counted",
    reached: "Women were represented and reported.",
    notReached: "Women's representation was not sufficiently established.",
  },
  {
    level: 2,
    label: "Women Analyzed",
    reached: "A sex-specific treatment analysis was reported.",
    notReached: "A sex-specific treatment analysis was not established.",
  },
  {
    level: 3,
    label: "Life Stage Aware",
    reached: "Relevant life-stage evidence was reported.",
    notReached: "Menopause or relevant life stage was not established.",
  },
  {
    level: 4,
    label: "Hormone Aware",
    reached: "Hormone therapy or hormonal context was reported.",
    notReached: "Hormone therapy or hormonal context was not established.",
  },
  {
    level: 5,
    label: "Precision Women's Evidence",
    reached: "Evidence included sufficiently specific women's health context for this level.",
    notReached: "Evidence was not specific enough for this level.",
  },
];

/** Anchor id for the Evidence Maturity section on the Methodology page. */
export const MATURITY_ANCHOR = "evidence-maturity-model";

export interface MaturityChecklistItem extends MaturityLevelDef {
  /** True when this level is reached, derived ONLY from the canonical awarded level. */
  isReached: boolean;
  /** The reached or not-reached explanation for the current result. */
  description: string;
}

/** Build the checklist purely from the canonical awarded maturity level. Levels are
 *  cumulative: a level is reached iff its number is ≤ the awarded level. The frontend
 *  never recomputes maturity — it only explains `awardedLevel`. */
export function maturityChecklist(awardedLevel: number): MaturityChecklistItem[] {
  return MATURITY_LEVELS.map((d) => {
    const isReached = d.level <= awardedLevel;
    return { ...d, isReached, description: isReached ? d.reached : d.notReached };
  });
}
