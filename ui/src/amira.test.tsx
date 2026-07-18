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
    expect(counts["Randomized Controlled Trials"]).toBe(12);
    expect(counts["Observational Studies"]).toBe(7);
    expect(counts["Post-hoc Analyses"]).toBe(3);
    expect(counts["Other Study Types"]).toBe(2);
  });
});

describe("Check the Evidence page", () => {
  it("renders the primary question", () => {
    wrap(<CheckEvidence />);
    expect(screen.getByText("Was this medicine studied in women like me?")).toBeInTheDocument();
  });

  it("renders the medicine card with brand and evidence level (2 of 5, Women Analyzed)", () => {
    const { container } = wrap(<CheckEvidence />);
    expect(container.querySelector(".med-name")!.textContent).toContain("Atorvastatin");
    expect(screen.getByText("(Lipitor)")).toBeInTheDocument();
    expect(container.querySelector(".ml-num")!.textContent).toContain("2");
    expect(screen.getByText("of 5")).toBeInTheDocument();
    expect(screen.getByText("Women Analyzed")).toBeInTheDocument();
  });

  it("renders the evidence-at-a-glance donut legend with study-type buckets", () => {
    wrap(<CheckEvidence />);
    expect(screen.getByText("Randomized Controlled Trials")).toBeInTheDocument();
    expect(screen.getByText("Observational Studies")).toBeInTheDocument();
  });

  it("shows numbers that come from the fixture, not vague words", () => {
    wrap(<CheckEvidence />);
    expect(screen.getAllByText("18,452").length).toBeGreaterThan(0);
    expect(screen.getByText("6 / 24")).toBeInTheDocument();
    expect(screen.getByText("1 / 24")).toBeInTheDocument();
    expect(screen.getAllByText("0 / 24").length).toBe(2); // hormone therapy + pregnancy
    expect(screen.queryByText(/many studies|some women|usually not reported/i)).toBeNull();
  });

  it("Check Evidence button is present and clickable", () => {
    wrap(<CheckEvidence />);
    const btn = screen.getByRole("button", { name: "Check Evidence" });
    fireEvent.click(btn);
    expect(screen.getByText("Studies behind this result (24)")).toBeInTheDocument();
  });

  it("filters update state", () => {
    wrap(<CheckEvidence />);
    const medicine = screen.getByLabelText("Medicine") as HTMLSelectElement;
    fireEvent.change(medicine, { target: { value: "Rosuvastatin (Crestor)" } });
    expect(medicine.value).toBe("Rosuvastatin (Crestor)");
  });

  it("shows the featured trials, expands to all 24, and opens the source drawer", () => {
    wrap(<CheckEvidence />);
    const table = document.querySelector("table.studies")!;
    // Default shows 5 featured rows.
    expect(within(table as HTMLElement).getAllByRole("row").length).toBe(1 + 5);
    expect(screen.getByText("SEARCH Trial")).toBeInTheDocument();
    expect(screen.getByText("JUPITER Trial")).toBeInTheDocument();
    // Expand to all 24.
    fireEvent.click(screen.getByRole("button", { name: /View all studies/i }));
    expect(within(table as HTMLElement).getAllByRole("row").length).toBe(1 + 24);
    // Open drawer from first row.
    fireEvent.click(within(table as HTMLElement).getAllByRole("row")[1]);
    expect(screen.getByRole("dialog", { name: /study source detail/i })).toBeInTheDocument();
    expect(screen.getByText(/Human verified: No/i)).toBeInTheDocument();
  });

  it("renders the right rail: findings, missing, and confidence", () => {
    wrap(<CheckEvidence />);
    expect(screen.getByText("What we found")).toBeInTheDocument();
    expect(screen.getByText("What's still missing")).toBeInTheDocument();
    expect(screen.getByText("How confident are we?")).toBeInTheDocument();
    expect(screen.getByText(/did not report menopause status/i)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
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
