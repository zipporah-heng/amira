import { describe, expect, it } from "vitest";
import { MATURITY_ANCHOR, MATURITY_LEVELS, maturityChecklist } from "./maturityLevels";

describe("maturityChecklist — derived only from the canonical awarded level", () => {
  it("has exactly five levels in order", () => {
    expect(MATURITY_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    expect(MATURITY_LEVELS.map((l) => l.label)).toEqual([
      "Women Counted", "Women Analyzed", "Life Stage Aware", "Hormone Aware", "Precision Women's Evidence",
    ]);
  });

  it("Level 1: only Women Counted reached", () => {
    const c = maturityChecklist(1);
    expect(c.map((i) => i.isReached)).toEqual([true, false, false, false, false]);
  });

  it("Level 2 (Digoxin): Women Counted + Women Analyzed reached, 3-5 not reached", () => {
    const c = maturityChecklist(2);
    expect(c.map((i) => i.isReached)).toEqual([true, true, false, false, false]);
    expect(c[1].description).toBe("A sex-specific treatment analysis was reported.");
    expect(c[2].description).toBe("Menopause or relevant life stage was not established.");
    expect(c[4].description).toBe("Evidence was not specific enough for this level.");
  });

  it("Level 4: first four reached, level 5 not reached", () => {
    const c = maturityChecklist(4);
    expect(c.map((i) => i.isReached)).toEqual([true, true, true, true, false]);
  });

  it("Level 5: all reached", () => {
    expect(maturityChecklist(5).every((i) => i.isReached)).toBe(true);
  });

  it("exposes the Methodology anchor id", () => {
    expect(MATURITY_ANCHOR).toBe("evidence-maturity-model");
  });
});
