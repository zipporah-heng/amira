import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiFound } from "./AiFound";

describe("AiFound (redesigned pipeline + schema panel)", () => {
  it("renders five numbered pipeline steps and keeps the trace/notes affordances", () => {
    const { container } = render(<AiFound onOpenTrace={() => {}} />);
    expect(screen.getByText("How AMIRA's AI found this evidence")).toBeInTheDocument();
    expect(container.querySelectorAll(".pipe5-step").length).toBe(5);
    expect([...container.querySelectorAll(".pipe5-num")].map((n) => n.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    // Scope to the pipeline labels (note "Women's Evidence Schema" also titles the panel).
    expect([...container.querySelectorAll(".pipe5-lab")].map((l) => l.textContent)).toEqual(
      ["Published sources", "AMIRA-Extract (AI)", "Women's Evidence Schema", "Exact passage check", "Human review"]);
    // Preserved function: trace button + explanatory sentence.
    expect(screen.getByText("Open evidence trace ↗")).toBeInTheDocument();
    expect(screen.getByText(/The AI extracts evidence\. Deterministic rules calculate readiness\./)).toBeInTheDocument();
  });

  it("renders the schema as a UI-font reference panel (no raw code table) with all 10 fields", () => {
    const { container } = render(<AiFound onOpenTrace={() => {}} />);
    // No raw developer table.
    expect(container.querySelector(".schema-table")).toBeNull();
    expect(container.querySelector(".schema-panel")).not.toBeNull();
    expect(container.querySelector(".schema-head")).not.toBeNull();
    const fields = [...container.querySelectorAll(".schema-field")].map((f) => (f.textContent || "").trim());
    ["women_represented", "sex_specific_effectiveness", "sex_specific_safety", "menopause", "pregnancy",
     "hormone_therapy", "race_ethnicity", "age", "evidence_passage", "source_id"]
      .forEach((f) => expect(fields).toContain(f));
    expect(fields.length).toBe(10);
  });
});
