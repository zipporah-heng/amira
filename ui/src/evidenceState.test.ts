import { describe, expect, it } from "vitest";
import { EVIDENCE_STATE, toEvidenceState } from "./evidenceState";

describe("evidence state mapping (exhaustive, never collapsed)", () => {
  it("maps every backend token to the correct distinct state + label", () => {
    expect(toEvidenceState("reported")).toBe("reported");
    expect(toEvidenceState("yes")).toBe("reported");
    expect(toEvidenceState("derived")).toBe("derived");
    expect(toEvidenceState("not_located")).toBe("not_located");
    expect(toEvidenceState("not_reported")).toBe("not_reported");
    expect(toEvidenceState("absent")).toBe("absent");
  });

  it("maps unverified/conflict/invalid to their own states, never not_reported", () => {
    expect(toEvidenceState("unverified")).toBe("unverified");
    expect(toEvidenceState("conflict")).toBe("conflict");
    expect(toEvidenceState("invalid")).toBe("invalid");
    // an unknown affirmative-looking token still falls back to not_reported…
    expect(toEvidenceState("no")).toBe("not_reported");
    // …but the explicit fail-closed states are NEVER collapsed to it.
    for (const s of ["unverified", "conflict", "invalid", "absent", "not_located"] as const) {
      expect(EVIDENCE_STATE[s].label).not.toBe(EVIDENCE_STATE.not_reported.label);
    }
  });

  it("never collapses absent or not_located into 'Not reported'", () => {
    expect(EVIDENCE_STATE.absent.label).toBe("Evidence status unavailable");
    expect(EVIDENCE_STATE.not_located.label).toBe("Unclear / not located");
    expect(EVIDENCE_STATE.not_reported.label).toBe("Not reported");
    expect(EVIDENCE_STATE.absent.label).not.toBe(EVIDENCE_STATE.not_reported.label);
    expect(EVIDENCE_STATE.not_located.label).not.toBe(EVIDENCE_STATE.not_reported.label);
  });

  it("gives every state a distinct tone and label", () => {
    const metas = Object.values(EVIDENCE_STATE);
    expect(new Set(metas.map((m) => m.tone)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.label)).size).toBe(metas.length);
    expect(metas.length).toBe(8);
  });
});
