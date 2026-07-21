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

  it("clarifies the Digoxin finding is sex-specific, not menopause-specific", () => {
    render(<HormonalFocus />);
    expect(screen.getByText(/sex-specific, not menopause-specific/i)).toBeInTheDocument();
    expect(screen.getByText(/does not reinterpret it as hormonal evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/does not provide treatment\s+recommendations/i)).toBeInTheDocument();
  });
});
