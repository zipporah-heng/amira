import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenBenchmark } from "./OpenBenchmark";
import { ReusableScienceTeaser } from "../components/ReusableScienceTeaser";

/** The Open Benchmark is the home for AMIRA's reusable scientific assets. Every figure
 *  is derived from the records the API serves; the benchmark's real maturity is stated;
 *  no accuracy or validation claim appears while evaluation is pending; and only files
 *  that genuinely exist are offered for download. */

const SCHEMA = {
  available: true, title: "Women's Evidence Schema", schema_version: "0.2",
  schema_path: "schema/womens_evidence_schema_v0.2.json", field_count: 4, required_count: 2,
  fields: [
    { field: "women_represented", description: "Whether THIS passage reports that women were represented.", required: true },
    { field: "sex_specific_effectiveness", description: "Whether a sex-specific effectiveness outcome is reported.", required: true },
    { field: "menopause", description: "Whether menopausal status is reported. NEVER inferred from age.", required: false },
    { field: "human_review_state", description: "Human review status.", required: false },
  ],
};

const ITEMS = [
  { benchmark_id: "AMIRA-BM-001", source_id: "SRC-PMID-27040132", nct_id: "NCT00468923", pmid: "27040132",
    source_url: "https://pubmed.ncbi.nlm.nih.gov/27040132/", exact_passage: "There was no excess of diabetes.",
    draft_label: { sex_specific_outcomes: "not_reported", expected_abstention: true }, split: "development",
    annotation_status: "pending_human_review", human_verifier: null, human_verified: false,
    label_provenance: "rule_drafted_from_retrieved_passage", medicine: "Rosuvastatin", condition: "CVD prevention" },
  { benchmark_id: "AMIRA-BM-002", source_id: "SRC-PMID-12409542", nct_id: "NCT00000476", pmid: "12409542",
    source_url: "https://pubmed.ncbi.nlm.nih.gov/12409542/", exact_passage: "Mortality was higher among women.",
    draft_label: { sex_specific_outcomes: "reported", expected_abstention: false }, split: "validation",
    annotation_status: "pending_human_review", human_verifier: null, human_verified: false,
    label_provenance: "rule_drafted_from_retrieved_passage", medicine: "Digoxin", condition: "Heart failure" },
];

const BENCHMARK = {
  dataset_version: "3.0.0", benchmark_version: "1.0.0", source_cutoff: "2026-07-18",
  commit_hash: "51457d2618c8b852e2bb25cd33ffa6bee1881cb6", generated_at: "2026-07-19T00:51:08Z",
  total: 2, development: 1, validation: 1, held_out: 0, label_field: "draft_label",
  annotation_status: "pending_human_review", human_verified_items: 0, items: ITEMS,
  evaluation: {
    status: "EVALUATION PENDING", evaluation_type: "process_metrics_only",
    corpus_passages_evaluated: 8, schema_validity_rate: 1.0, quote_verification_rate: 1.0,
    clinical_accuracy: null, macro_f1: null,
  },
};

const ASSETS = {
  assets: [
    { key: "schema", title: "Schema", path: "schema/womens_evidence_schema_v0.2.json", kind: "file", present: true },
    { key: "benchmark", title: "Benchmark", path: "benchmark/amira_benchmark.jsonl", kind: "file", present: true },
    { key: "dataset", title: "Dataset", path: "dataset/", kind: "dir", present: true },
    { key: "methodology", title: "Methodology", path: "docs/methodology.md", kind: "file", present: true },
    { key: "model_card", title: "Model card", path: "docs/ai-model-card.md", kind: "file", present: false },
  ],
  honest_status: ["No accuracy figure is claimed.", "No validated / gold benchmark is claimed."],
  license_present: true,
};

function mockFetch(over: { assets?: any; benchmark?: any; schema?: any } = {}) {
  vi.stubGlobal("fetch", vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes("/api/schema")) return { ok: true, json: async () => over.schema ?? SCHEMA } as any;
    if (u.includes("/api/assets")) return { ok: true, json: async () => over.assets ?? ASSETS } as any;
    return { ok: true, json: async () => over.benchmark ?? BENCHMARK } as any;
  }) as any);
}

afterEach(() => vi.unstubAllGlobals());

const renderPage = () => render(<MemoryRouter><OpenBenchmark /></MemoryRouter>);
const sec = (c: HTMLElement, id: string) => c.querySelector(`#${id}`) as HTMLElement;

describe("Reusable-science teaser", () => {
  it("1. Links to the Open Benchmark page", () => {
    render(<MemoryRouter><ReusableScienceTeaser /></MemoryRouter>);
    const cta = screen.getByRole("link", { name: /Explore the Open Benchmark/i });
    expect(cta.getAttribute("href")).toBe("/amira/open-benchmark");
  });

  it("2. Stays compact and states the honest benchmark status", () => {
    const { container } = render(<MemoryRouter><ReusableScienceTeaser /></MemoryRouter>);
    const items = [...container.querySelectorAll(".sci-teaser-list li")].map((n) => n.textContent);
    expect(items).toEqual([
      "Open Women's Evidence Schema", "Source-linked benchmark scaffold",
      "Reproducible evidence-extraction pipeline", "Transparent evaluation methodology",
    ]);
    expect(container.textContent).toContain("Benchmark records are pending human review.");
    // Compact: a heading, four bullets, one status line and one action — no documentation dump.
    expect(container.querySelectorAll("p").length).toBeLessThanOrEqual(2);
    expect(container.querySelectorAll("a").length).toBe(1);
    for (const banned of ["validated", "gold standard", "clinically complete", "comprehensive"]) {
      expect(container.textContent!.toLowerCase()).not.toContain(banned);
    }
  });
});

describe("Open Benchmark — reusable scientific assets", () => {
  it("3. Renders the canonical schema fields served from the repository", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-schema").textContent).toContain("women_represented"));
    const s = sec(container, "ob-schema");
    SCHEMA.fields.forEach((f) => expect(s.textContent).toContain(f.field));
    expect(s.textContent).toContain("Version 0.2");
    expect(s.textContent).toContain("schema/womens_evidence_schema_v0.2.json");
    expect(s.textContent).toMatch(/does not keep a second copy/i);
  });

  it("4. Computes benchmark totals from the actual records", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-status")).not.toBeNull());
    const metric = (k: string) => {
      const m = [...sec(container, "ob-status").querySelectorAll(".ob-metric")]
        .find((x) => x.textContent!.includes(k))!;
      return m.querySelector(".ob-metric-v")!.textContent;
    };
    await waitFor(() => expect(metric("Passages")).toBe("2"));
    expect(metric("Source documents")).toBe("2");     // two distinct SRC- ids
    expect(metric("Studies represented")).toBe("2");
    expect(metric("Benchmark version")).toBe("1.0.0");
    expect(metric("Evidence cutoff date")).toBe("2026-07-18");
  });

  it("5. Counts human-reviewed and pending records separately", async () => {
    mockFetch({
      benchmark: {
        ...BENCHMARK,
        items: [{ ...ITEMS[0], human_verified: true, human_verifier: "A. Reviewer" }, ITEMS[1]],
      },
    });
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-status")).not.toBeNull());
    const metric = (k: string) => {
      const m = [...sec(container, "ob-status").querySelectorAll(".ob-metric")]
        .find((x) => x.textContent!.includes(k))!;
      return m.querySelector(".ob-metric-v")!.textContent;
    };
    await waitFor(() => expect(metric("Human-reviewed records")).toBe("1"));
    expect(metric("Pending human review")).toBe("1");
    // The records table labels each row's own status — the two are never merged.
    const rows = [...sec(container, "ob-records").querySelectorAll("tbody tr")];
    expect(rows.filter((r) => r.textContent!.includes("Reviewed")).length).toBe(1);
    expect(rows.filter((r) => r.textContent!.includes("Pending")).length).toBe(1);
  });

  it("6+10. States that evaluation is pending and claims no accuracy", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-evaluation")).not.toBeNull());
    const e = sec(container, "ob-evaluation");
    expect(e.textContent).toContain("Formal benchmark evaluation is pending.");
    expect(e.textContent).toContain("Not measured");           // clinical accuracy + macro F1
    const page = container.textContent!.toLowerCase();
    for (const banned of ["gold standard", "gold-standard", "clinically validated",
      "fully human reviewed", "comprehensive benchmark"]) {
      expect(page).not.toContain(banned);
    }
    expect(container.textContent).toContain("Source-linked benchmark scaffold pending human review.");
  });

  it("7. Offers only files that genuinely exist, and says so when one does not", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-downloads")).not.toBeNull());
    const d = sec(container, "ob-downloads");
    await waitFor(() => expect(d.querySelectorAll("a").length).toBeGreaterThan(0));
    // model_card is absent in the manifest -> must not be a link.
    const cardRow = [...d.querySelectorAll(".ob-dl")].find((r) => r.textContent!.includes("Data dictionary"))!;
    expect(cardRow.querySelector("a")).toBeNull();
    expect(cardRow.textContent).toContain("Not yet published");
    // Present assets are real endpoints.
    const bench = [...d.querySelectorAll(".ob-dl")].find((r) => r.textContent!.includes("Benchmark JSONL"))!;
    expect(bench.querySelector("a")!.getAttribute("href")).toBe("/api/download/benchmark.jsonl");
  });

  it("8. Ties the downloads to the displayed benchmark version", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-downloads")!.textContent).toContain("1.0.0"));
    expect(sec(container, "ob-versioning").textContent).toContain("1.0.0");
    expect(sec(container, "ob-versioning").textContent).toContain("2026-07-18");
    expect(sec(container, "ob-versioning").textContent).toContain("51457d2618");
  });

  it("9. Keeps source identifiers linked to their exact passages", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-records").querySelectorAll("tbody tr").length).toBe(2));
    const rows = [...sec(container, "ob-records").querySelectorAll("tbody tr")];
    for (const [i, row] of rows.entries()) {
      const link = row.querySelector("a") as HTMLAnchorElement;
      expect(link.textContent).toBe(ITEMS[i].source_id);
      expect(link.href).toBe(ITEMS[i].source_url);
      expect(row.textContent).toContain(ITEMS[i].exact_passage);
    }
  });

  it("Search narrows the record list without altering the totals", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-records").querySelectorAll("tbody tr").length).toBe(2));
    fireEvent.change(screen.getByLabelText("Search benchmark records"), { target: { value: "Digoxin" } });
    await waitFor(() => expect(sec(container, "ob-records").querySelectorAll("tbody tr").length).toBe(1));
    expect(sec(container, "ob-records").textContent).toContain("AMIRA-BM-002".slice(0, 0) + "SRC-PMID-12409542");
    const passages = [...sec(container, "ob-status").querySelectorAll(".ob-metric")]
      .find((x) => x.textContent!.includes("Passages"))!;
    expect(passages.querySelector(".ob-metric-v")!.textContent).toBe("2");  // totals unchanged
  });

  it("Shows the real licence status rather than inferring one", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-versioning").textContent).toContain("Apache-2.0"));
    expect(sec(container, "ob-versioning").textContent).toContain("CC BY 4.0");

    vi.unstubAllGlobals();
    mockFetch({ assets: { ...ASSETS, license_present: false } });
    const { container: c2 } = renderPage();
    await waitFor(() => expect(sec(c2, "ob-versioning").textContent).toContain("License not yet specified"));
  });

  it("Describes the real pipeline without claiming autonomous clinical validation", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-methodology")).not.toBeNull());
    const m = sec(container, "ob-methodology");
    ["Published source", "AMIRA Extract AI", "Women's Evidence Schema", "Exact passage validation", "Human review"]
      .forEach((s) => expect(m.textContent).toContain(s));
    expect(m.textContent).toMatch(/does not perform autonomous clinical validation/i);
    expect(within(m).getByRole("link", { name: /full methodology/i }).getAttribute("href"))
      .toBe("/amira/methodology");
  });

  it("Provides the researcher actions, separate from clinical evidence checking", async () => {
    mockFetch();
    const { container } = renderPage();
    await waitFor(() => expect(sec(container, "ob-actions")).not.toBeNull());
    const a = sec(container, "ob-actions");
    expect(within(a).getByRole("link", { name: /View on GitHub/i }).getAttribute("href"))
      .toBe("https://github.com/zipporah-heng/amira");
    ["Review methodology", "Download available assets", "Inspect evidence records"]
      .forEach((t) => expect(within(a).getByText(t)).toBeInTheDocument());
  });
});
