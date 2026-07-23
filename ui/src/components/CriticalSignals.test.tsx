import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CriticalSignals } from "./CriticalSignals";

const digoxin = {
  signal_id: "SIG-F-EFF-DIG-001", medicine: "Digoxin", health_area: "Cardiovascular",
  condition: "Heart failure", drug_class: "Cardiac glycoside", trial_id: "DIG",
  finding_id: "F-EFF-DIG-001", signal_type: "Mortality",
  headline: "33.1% of women assigned digoxin died during follow-up",
  summary: "28.9% placebo · Adjusted HR 1.23 · 95% CI 1.02-1.47 · Adjusted sex-by-treatment interaction P = 0.014",
  clinical_significance: "A post hoc DIG analysis reported a higher risk of death among women.",
  evidence_status: "Human Review Pending", source_id: "SRC-PMID-12409542",
  source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/", source_resolved: true,
  exact_passage: "higher risk of death among women…", sex_specific: true,
  life_stage: "Not specified", life_stage_context: "Not inferred from age", hormonal_context: "Not reported",
  human_verified: false, cautions: ["Historical post hoc signal", "Not menopause-specific", "Not a treatment recommendation"],
  featured: true, featured_priority: 1,
};
const dapa = {
  ...digoxin, signal_id: "SIG-F-EFF-DAPA-001", medicine: "Dapagliflozin", finding_id: "F-EFF-DAPA-001",
  trial_id: "DAPA-HF", signal_type: "Effectiveness",
  headline: "Dapagliflozin: no statistically significant sex difference",
  clinical_significance: "Similar effect in women and men.", featured: false, featured_priority: null,
};

function mock(body: any) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => body })) as any);
}
const payload = {
  featured: [digoxin], library: [digoxin, dapa],
  signal_types: ["Mortality", "Serious Safety", "Effectiveness", "Outcome Difference"],
  evidence_statuses: ["Source Verified", "Human Review Pending", "Human Reviewed", "Evidence Review Incomplete"],
  max_featured: 5,
};

afterEach(() => vi.unstubAllGlobals());

describe("CriticalSignals", () => {
  it("shows the section heading and the Digoxin Featured card with canonical stats + passage link", async () => {
    mock(payload);
    render(<CriticalSignals />);
    await screen.findByText("Evidence That Changed the Story for Women");
    const card = document.querySelector(".cs-card") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.className).toContain("warn");                 // mortality accent
    expect(card.textContent).toContain("33.1% of women assigned digoxin died during follow-up");
    expect(card.textContent).toContain("28.9% placebo");
    expect(card.textContent).toContain("95% CI 1.02-1.47");
    const link = within(card).getByText("View exact passage →") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("pubmed.ncbi.nlm.nih.gov/12409542");
  });

  it("only Featured-flagged signals become cards (cap respected)", async () => {
    mock(payload);
    const { container } = render(<CriticalSignals />);
    await screen.findByText("Evidence That Changed the Story for Women");
    expect(container.querySelectorAll(".cs-card").length).toBe(1);   // only Digoxin featured
  });

  it("library filters by Signal Type", async () => {
    mock(payload);
    render(<CriticalSignals />);
    await screen.findByText("Evidence That Changed the Story for Women");
    // Dapagliflozin row initially present in the table.
    expect(screen.getByText("Dapagliflozin: no statistically significant sex difference")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Signal Type"), { target: { value: "Mortality" } });
    await waitFor(() =>
      expect(screen.queryByText("Dapagliflozin: no statistically significant sex difference")).toBeNull());
    // Digoxin (Mortality) still shown (card + table row).
    expect(screen.getAllByText(/33.1% of women/).length).toBeGreaterThan(0);
  });

  it("library search filters by medicine/finding text", async () => {
    mock(payload);
    render(<CriticalSignals />);
    await screen.findByText("Evidence That Changed the Story for Women");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "dapagliflozin" } });
    // Featured card is unaffected by the Library search; the Digoxin TABLE row is filtered out
    // so only the Featured card headline remains (exactly one occurrence).
    await waitFor(() => expect(screen.getAllByText(/33.1% of women/).length).toBe(1));
    expect(screen.getByText("Dapagliflozin: no statistically significant sex difference")).toBeInTheDocument();
  });

  it("shows the Why This Section Exists guardrail", async () => {
    mock(payload);
    render(<CriticalSignals />);
    expect(await screen.findByText(/Counted is not the same as studied/)).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose, prescribe, or recommend treatment/)).toBeInTheDocument();
  });
});
