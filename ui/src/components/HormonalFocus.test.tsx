import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HormonalFocus } from "./HormonalFocus";

describe("HormonalFocus", () => {
  it("states the menopause / hormone-therapy evidence problem", () => {
    const { container } = render(<HormonalFocus />);
    const text = container.textContent || "";
    expect(text).toMatch(/specific hormonal health evidence problem/i);
    expect(text).toMatch(/menopause/i);
    expect(text).toMatch(/hormone therapy/i);
    expect(text).toMatch(/not reported/i);
    expect(text).toMatch(/could not be located/i);
  });

  it("uses generic guardrail copy with NO medicine-specific mention", () => {
    const { container } = render(<HormonalFocus />);
    const text = container.textContent || "";
    expect(text).toMatch(/does not diagnose, prescribe, or recommend treatment/i);
    expect(text).toMatch(/reported.*not reported.*could not be located/i);
    // No medicine-specific copy in this shared component.
    expect(text).not.toMatch(/digoxin/i);
    expect(text).not.toMatch(/rosuvastatin/i);
    expect(text).not.toMatch(/dapagliflozin/i);
  });
});
