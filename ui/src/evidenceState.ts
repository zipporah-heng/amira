// One exhaustive, shared mapping for AMIRA's five evidence states. Every surface
// must use this — the states are never collapsed into one another.

export type EvidenceState = "reported" | "derived" | "not_reported" | "not_located" | "absent";

export interface EvidenceStateMeta {
  label: string;      // user-facing text
  tone: "present" | "derived" | "missing" | "unclear" | "unavailable";
  glyph: string;
  help: string;
}

export const EVIDENCE_STATE: Record<EvidenceState, EvidenceStateMeta> = {
  reported: {
    label: "Reported", tone: "present", glyph: "●",
    help: "The dimension was reported in the reviewed source.",
  },
  derived: {
    label: "Derived", tone: "derived", glyph: "◑",
    help: "Value derived by AMIRA from verified dependencies.",
  },
  not_reported: {
    label: "Not reported", tone: "missing", glyph: "○",
    help: "A reviewed source was checked and does not report this dimension.",
  },
  not_located: {
    label: "Unclear / not located", tone: "unclear", glyph: "◐",
    help: "AMIRA reviewed the defined source set but did not locate sufficient evidence. Incomplete coverage, not confirmed absence.",
  },
  absent: {
    label: "Evidence status unavailable", tone: "unavailable", glyph: "⊘",
    help: "AMIRA holds no assertion for this dimension.",
  },
};

/** Normalize any backend token/basis into one of the five canonical states. */
export function toEvidenceState(token: string | null | undefined): EvidenceState {
  switch (token) {
    case "reported":
    case "yes":
      return "reported";
    case "derived":
      return "derived";
    case "not_located":
      return "not_located";
    case "absent":
      return "absent";
    case "not_reported":
    case "no":
    default:
      return "not_reported";
  }
}
