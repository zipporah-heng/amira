import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MethodologyFlow } from "./MethodologyFlow";

describe("MethodologyFlow benchmark honesty", () => {
  it("describes the benchmark as awaiting human validation, not human-labeled", () => {
    render(<MethodologyFlow />);
    expect(screen.getByText(/prepared for human validation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Human-labeled benchmark checks AI accuracy/i)).not.toBeInTheDocument();
  });

  it("makes no measured-accuracy claim", () => {
    render(<MethodologyFlow />);
    expect(screen.getByText(/no accuracy has been measured or claimed/i)).toBeInTheDocument();
  });
});
