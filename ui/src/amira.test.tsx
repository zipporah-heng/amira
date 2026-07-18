import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CheckEvidence } from "./pages/CheckEvidence";
import { OpenBenchmark } from "./pages/OpenBenchmark";
import { ResearchMap } from "./pages/ResearchMap";
import { Methodology } from "./pages/Methodology";
import { fixture, stats } from "./fixture";

const wrap = (el: React.ReactNode) => render(<MemoryRouter>{el}</MemoryRouter>);

describe("fixture is the single source of truth", () => {
  it("derives exact aggregates from the studies array", () => {
    expect(stats.studyCount).toBe(24);
    expect(stats.femaleTotal).toBe(18452);
    expect(stats.femalePct).toBe(41);
    expect(stats.sexSpecificOutcomes).toBe(6);
    expect(stats.menopauseReported).toBe(1);
    expect(stats.hormoneTherapyReported).toBe(0);
    expect(stats.pregnancyReported).toBe(0);
  });

  it("study-type volumes sum to 24 (12/7/3/2)", () => {
    const counts = Object.fromEntries(stats.studyTypes.map((t) => [t.type, t.count]));
    expect(counts["Randomized Controlled Trial"]).toBe(12);
    expect(counts["Observational Study"]).toBe(7);
    expect(counts["Post-hoc Analysis"]).toBe(3);
    expect(counts["Other"]).toBe(2);
  });
});

describe("Check the Evidence page", () => {
  it("renders the primary question", () => {
    wrap(<CheckEvidence />);
    expect(screen.getByText("Was this medicine studied in women like me?")).toBeInTheDocument();
  });

  it("renders the evidence level (Level 2 of 5, Women Analyzed)", () => {
    wrap(<CheckEvidence />);
    expect(screen.getByText("Level 2 of 5")).toBeInTheDocument();
    expect(screen.getAllByText("Women Analyzed").length).toBeGreaterThan(0);
  });

  it("shows numbers that come from the fixture, not vague words", () => {
    wrap(<CheckEvidence />);
    expect(screen.getAllByText("18,452").length).toBeGreaterThan(0);
    expect(screen.getByText("6 / 24")).toBeInTheDocument();
    expect(screen.getByText("1 / 24")).toBeInTheDocument();
    expect(screen.getAllByText("0 / 24").length).toBe(2); // hormone therapy + pregnancy
    expect(screen.queryByText(/many studies|some women|usually not reported/i)).toBeNull();
  });

  it("CHECK THE EVIDENCE button is present and clickable", () => {
    wrap(<CheckEvidence />);
    const btn = screen.getByRole("button", { name: "CHECK THE EVIDENCE" });
    fireEvent.click(btn);
    expect(screen.getByText("Evidence result")).toBeInTheDocument();
  });

  it("filters update state", () => {
    wrap(<CheckEvidence />);
    const medicine = screen.getByLabelText("Medicine") as HTMLSelectElement;
    fireEvent.change(medicine, { target: { value: "Rosuvastatin" } });
    expect(medicine.value).toBe("Rosuvastatin");
  });

  it("loads the study table with all 24 studies and opens the source drawer", () => {
    wrap(<CheckEvidence />);
    const table = document.querySelector("table.studies")!;
    const rows = within(table as HTMLElement).getAllByRole("row");
    expect(rows.length).toBe(1 + 24); // header + 24
    fireEvent.click(rows[1]);
    expect(screen.getByRole("dialog", { name: /study source detail/i })).toBeInTheDocument();
    expect(screen.getByText(/Human verified: No/i)).toBeInTheDocument();
  });

  it("shows the safety line and DEMO DATA labeling", () => {
    wrap(<CheckEvidence />);
    expect(
      screen.getByText(/does not diagnose, prescribe, or recommend treatment/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/demo data/i).length).toBeGreaterThan(3);
  });

  it("makes no medical recommendation", () => {
    const { container } = wrap(<CheckEvidence />);
    const text = container.textContent!.toLowerCase();
    expect(text).not.toMatch(/you should take|we recommend|is safe for you|best medicine for you/);
  });

  it("surfaces the core message about representation vs analysis", () => {
    wrap(<CheckEvidence />);
    expect(
      screen.getByText(/High female representation does not automatically mean/i)
    ).toBeInTheDocument();
  });
});

describe("downloads generate from fixture data", () => {
  let created: Blob[] = [];
  beforeEach(() => {
    created = [];
    // @ts-expect-error jsdom URL
    global.URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:mock";
    });
    // @ts-expect-error jsdom URL
    global.URL.revokeObjectURL = vi.fn();
  });

  it("Open Benchmark page loads with 30-example benchmark and PENDING eval", () => {
    wrap(<OpenBenchmark />);
    expect(
      screen.getByText("AMIRA Open Women's Hormonal Evidence Dataset and Benchmark")
    ).toBeInTheDocument();
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getByText("Field-level accuracy")).toBeInTheDocument();
  });

  it("CSV, JSONL and Benchmark downloads produce non-empty blobs", () => {
    wrap(<OpenBenchmark />);
    fireEvent.click(screen.getByRole("button", { name: /Download CSV/i }));
    fireEvent.click(screen.getByRole("button", { name: /Download JSONL/i }));
    fireEvent.click(screen.getByRole("button", { name: /Download Benchmark/i }));
    expect(created.length).toBe(3);
    for (const b of created) expect(b.size).toBeGreaterThan(100);
  });

  it("benchmark example count matches fixture", () => {
    expect(fixture.benchmark.examples.length).toBe(30);
    expect(fixture.benchmark.examples.filter((e) => e.split === "development").length).toBe(18);
  });
});

describe("Research Map page", () => {
  it("loads the coverage matrix and highest gaps", () => {
    wrap(<ResearchMap />);
    expect(screen.getByText("Women's Evidence Coverage Matrix")).toBeInTheDocument();
    expect(screen.getByText("Atorvastatin")).toBeInTheDocument();
    expect(screen.getByText("Rosuvastatin")).toBeInTheDocument();
    expect(screen.getByText("Highest visible evidence gaps")).toBeInTheDocument();
  });
});

describe("Methodology page", () => {
  it("loads the 6-step flow, the 1-5 model, and the two distinct states", () => {
    wrap(<Methodology />);
    expect(screen.getByText("Collect research sources")).toBeInTheDocument();
    expect(screen.getByText("The 1-to-5 Evidence Maturity Model")).toBeInTheDocument();
    expect(screen.getByText(/No evidence found/i)).toBeInTheDocument();
    expect(screen.getByText(/Evidence of no effect/i)).toBeInTheDocument();
  });
});
