import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceSearch, hormonalContextOptions, hormonalContextToApi, type Filters, type HealthAreaEntry } from "./EvidenceSearch";

const catalog: HealthAreaEntry[] = [
  {
    health_area: "Cardiovascular",
    conditions: [
      { condition: "Heart failure", drug_classes: [
        { drug_class: "SGLT2 inhibitor", medicines: [{ medicine: "Dapagliflozin", status: "verified" }] },
        { drug_class: "Cardiac glycoside", medicines: [{ medicine: "Digoxin", status: "verified" }] },
      ] },
      { condition: "Cardiovascular disease prevention", drug_classes: [
        { drug_class: "Statin", medicines: [
          { medicine: "Rosuvastatin", status: "verified" },
          { medicine: "Atorvastatin", status: "incomplete" },
        ] },
      ] },
    ],
  },
  {
    health_area: "Metabolic Health",
    conditions: [
      { condition: "Weight management", drug_classes: [
        { drug_class: "GLP-1 receptor agonist", medicines: [
          { medicine: "Semaglutide", status: "incomplete" },
          { medicine: "Liraglutide", status: "incomplete" },
        ] },
      ] },
    ],
  },
];

function Harness({ initial }: { initial?: Partial<Filters> } = {}) {
  const [filters, setFilters] = useState<Filters>({
    healthArea: "Cardiovascular", condition: "Heart failure", drugClass: "Cardiac glycoside",
    medicine: "Digoxin", lifeStage: "menopause_postmenopause", hormonalContext: "Any", ...initial,
  });
  return <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => {}} catalog={catalog} />;
}

describe("EvidenceSearch — 6-level cascade with Health Area", () => {
  it("exposes the Health Area selector as the first level", () => {
    render(<Harness />);
    const ha = screen.getByLabelText("Health Area") as HTMLSelectElement;
    const areas = within(ha).getAllByRole("option").map((o) => o.textContent);
    expect(areas).toContain("Cardiovascular");
    expect(areas).toContain("Metabolic Health");
    expect(ha.value).toBe("Cardiovascular");
  });

  it("cascades Health Area -> Condition -> Drug Class -> Medicine, preferring a verified default", () => {
    render(<Harness initial={{ healthArea: "Cardiovascular", condition: "Cardiovascular disease prevention", drugClass: "Statin", medicine: "Rosuvastatin" }} />);
    const med = screen.getByLabelText("Medicine") as HTMLSelectElement;
    const labels = within(med).getAllByRole("option").map((o) => o.textContent);
    // Both offered with CLEAN names (no status suffix); default is the verified one.
    expect(labels).toEqual(["Rosuvastatin", "Atorvastatin"]);
    expect(med.value).toBe("Rosuvastatin");
  });

  it("offers an incomplete-review medicine with a clean name and plain value", () => {
    render(<Harness initial={{ healthArea: "Metabolic Health", condition: "Weight management", drugClass: "GLP-1 receptor agonist", medicine: "Semaglutide" }} />);
    const med = screen.getByLabelText("Medicine") as HTMLSelectElement;
    const labels = within(med).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Semaglutide", "Liraglutide"]);
    expect(labels.some((l) => /incomplete/i.test(l || ""))).toBe(false);
    fireEvent.change(med, { target: { value: "Liraglutide" } });
    expect(med.value).toBe("Liraglutide");
  });
});

describe("EvidenceSearch — brand label never appends the active ingredient", () => {
  const brandCatalog: HealthAreaEntry[] = [
    { health_area: "Metabolic Health", conditions: [
      { condition: "Type 2 diabetes", drug_classes: [
        { drug_class: "GLP-1 receptor agonist", medicines: [
          { medicine: "Ozempic", status: "verified", active_ingredient: "Semaglutide" }] },
        { drug_class: "Dual GIP/GLP-1 receptor agonist", medicines: [
          { medicine: "Mounjaro", status: "verified", active_ingredient: "Tirzepatide" }] },
      ] },
    ] },
  ];
  function BrandHarness({ initial }: { initial: Partial<Filters> }) {
    const [filters, setFilters] = useState<Filters>({
      healthArea: "Metabolic Health", condition: "Type 2 diabetes", drugClass: "GLP-1 receptor agonist",
      medicine: "Ozempic", lifeStage: "not_specified", hormonalContext: "Any", ...initial });
    return <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => {}} catalog={brandCatalog} />;
  }

  it("shows only the brand name (no '· semaglutide' / '· tirzepatide') and keeps a plain value", () => {
    const first = render(<BrandHarness initial={{ drugClass: "GLP-1 receptor agonist", medicine: "Ozempic" }} />);
    let med = screen.getByLabelText("Medicine") as HTMLSelectElement;
    let labels = within(med).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Ozempic"]);
    expect(labels.some((l) => /·|semaglutide/i.test(l || ""))).toBe(false);
    expect(med.value).toBe("Ozempic");
    first.unmount();

    render(<BrandHarness initial={{ drugClass: "Dual GIP/GLP-1 receptor agonist", medicine: "Mounjaro" }} />);
    med = screen.getByLabelText("Medicine") as HTMLSelectElement;
    labels = within(med).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Mounjaro"]);
    expect(labels.some((l) => /·|tirzepatide/i.test(l || ""))).toBe(false);
  });
});

describe("Life Stage + Hormonal Context", () => {
  it("includes the Older Adult life stage", () => {
    render(<Harness />);
    const ls = screen.getByLabelText("Life Stage") as HTMLSelectElement;
    expect(within(ls).getAllByRole("option").map((o) => o.textContent)).toContain("Older Adult");
  });

  it("adapts Hormonal Context to the selected life stage (no menopause options for pediatric)", () => {
    const peds = hormonalContextOptions("childhood_prepubertal");
    expect(peds).toContain("Pubertal status");
    expect(peds.some((o) => /menopaus/i.test(o))).toBe(false);
    const meno = hormonalContextOptions("menopause_postmenopause");
    expect(meno).toContain("Using menopausal hormone therapy");
  });

  it("maps only explicit MHT use/non-use to yes/no; everything else to any/not_specified", () => {
    expect(hormonalContextToApi("Using menopausal hormone therapy")).toBe("yes");
    expect(hormonalContextToApi("Not using menopausal hormone therapy")).toBe("no");
    expect(hormonalContextToApi("Any")).toBe("any");
    expect(hormonalContextToApi("Pregnancy")).toBe("not_specified");
    expect(hormonalContextToApi("Pubertal status")).toBe("not_specified");
  });

  it("renders Hormonal Context (not the old Hormone Therapy) selector", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Hormonal Context")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hormone Therapy")).toBeNull();
  });
});

describe("Check Evidence + Compare Evidence — adjacent actions preserve context", () => {
  it("places Compare Evidence beside Check Evidence, carrying the full selection as URL params", () => {
    render(<Harness initial={{
      healthArea: "Cardiovascular", condition: "Heart failure", drugClass: "Cardiac glycoside",
      medicine: "Digoxin", lifeStage: "older_adult", hormonalContext: "Menopause status",
    }} />);
    // Both actions live together beneath the selectors.
    const actions = document.querySelector(".filter-actions")!;
    expect(within(actions as HTMLElement).getByText("Check Evidence")).toBeInTheDocument();
    const compare = within(actions as HTMLElement).getByText("Compare Evidence") as HTMLAnchorElement;

    const url = new URL(compare.href, "http://localhost");
    expect(url.pathname).toBe("/amira/compare-evidence");
    const p = url.searchParams;
    expect(p.get("healthArea")).toBe("Cardiovascular");
    expect(p.get("condition")).toBe("Heart failure");
    expect(p.get("drugClass")).toBe("Cardiac glycoside");
    expect(p.get("medicine")).toBe("Digoxin");
    expect(p.get("lifeStage")).toBe("older_adult");
    expect(p.get("hormonalContext")).toBe("Menopause status");
  });

  it("6+31. Neither action label wraps, and both sit in the same actions row", () => {
    render(<Harness />);
    const actions = document.querySelector(".filter-actions") as HTMLElement;
    const check = within(actions).getByRole("button", { name: "Check Evidence" });
    const compare = within(actions).getByRole("link", { name: "Compare Evidence" });
    // Single-line labels: no embedded line breaks, and both are direct siblings.
    for (const el of [check, compare]) {
      expect(el.textContent).not.toMatch(/\n/);
      expect(el.parentElement).toBe(actions);
    }
    expect(actions.children.length).toBe(2);
  });

  it("4+32. The Medicine selector shows the medicine name only and keeps every option readable", () => {
    render(<Harness initial={{ healthArea: "Metabolic Health", condition: "Weight management", drugClass: "GLP-1 receptor agonist", medicine: "Semaglutide" }} />);
    const med = screen.getByLabelText("Medicine") as HTMLSelectElement;
    for (const o of within(med).getAllByRole("option")) {
      expect(o.textContent).not.toMatch(/·/);          // no "Wegovy · semaglutide"
      expect(o.textContent).not.toMatch(/incomplete/i); // status is a separate badge
      expect((o as HTMLOptionElement).value).toBe(o.textContent);
    }
    // The life-stage selector keeps its full value visible (never truncated to a code).
    const ls = screen.getByLabelText("Life Stage") as HTMLSelectElement;
    const selected = within(ls).getAllByRole("option").find((o) => (o as HTMLOptionElement).selected)!;
    expect(selected.textContent).toBe("Menopause / Postmenopause");
  });
});
