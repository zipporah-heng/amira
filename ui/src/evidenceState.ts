// One exhaustive, shared mapping for AMIRA's five evidence states. Every surface
// must use this — the states are never collapsed into one another.

export type EvidenceState =
  | "reported" | "derived" | "not_reported" | "not_located" | "absent"
  | "conflict" | "unverified" | "invalid";

export interface EvidenceStateMeta {
  label: string;      // user-facing text
  tone: "present" | "derived" | "missing" | "unclear" | "unavailable"
      | "conflict" | "unverified" | "invalid";
  glyph: string;
  help: string;
}

// Eight distinct, never-collapsed evidence states. A positive claim (reported/
// derived) is only ever shown when verified; anything else keeps its own state —
// absent/not_located/not_reported are NOT interchangeable, and an unverified,
// conflicting, or invalid record is never silently rendered as "Not reported".
export const EVIDENCE_STATE: Record<EvidenceState, EvidenceStateMeta> = {
  reported: {
    label: "Reported", tone: "present", glyph: "●",
    help: "The dimension was reported in a verified, authoritative source.",
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
  conflict: {
    label: "Conflicting — withheld", tone: "conflict", glyph: "⚠",
    help: "Multiple assertions conflict, so no single value is shown as trusted.",
  },
  unverified: {
    label: "Unverified — withheld", tone: "unverified", glyph: "◌",
    help: "A value is present but its source is not verified against a resolvable authoritative source, so it is not shown as evidence.",
  },
  invalid: {
    label: "Invalid — withheld", tone: "invalid", glyph: "⊗",
    help: "The record has an unsupported evidence basis and cannot back a public value.",
  },
};

/** Normalize any backend token/basis into one of the canonical states. Unknown
 *  affirmative tokens are NEVER silently collapsed into "not_reported". */
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
    case "conflict":
      return "conflict";
    case "unverified":
      return "unverified";
    case "invalid":
      return "invalid";
    case "not_reported":
    case "no":
    default:
      return "not_reported";
  }
}
