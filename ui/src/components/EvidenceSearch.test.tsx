import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceSearch, type Filters, type ConditionEntry } from "./EvidenceSearch";

const catalog: ConditionEntry[] = [
  {
    condition: "Heart failure",
    drug_classes: [
      { drug_class: "Cardiac glycoside", medicines: ["Digoxin"] },
      { drug_class: "SGLT2 inhibitor", medicines: ["Dapagliflozin"] },
    ],
  },
  {
    condition: "Cardiovascular disease prevention",
    drug_classes: [
      // Rosuvastatin verified; Atorvastatin known but evidence review incomplete.
      { drug_class: "Statin", medicines: ["Rosuvastatin"], incomplete_medicines: ["Atorvastatin"] },
    ],
  },
];

function Harness({ initial }: { initial?: Partial<Filters> } = {}) {
  const [filters, setFilters] = useState<Filters>({
    condition: "Heart failure", drugClass: "Cardiac glycoside", medicine: "Digoxin",
    lifeStage: "not_specified", hormoneTherapy: "Any", ...initial,
  });
  return <EvidenceSearch filters={filters} setFilters={setFilters} onCheck={() => {}} catalog={catalog} />;
}

describe("EvidenceSearch drug-class cascade", () => {
  it("exposes both drug classes and their correct medicines", () => {
    render(<Harness />);
    const drugClass = screen.getByLabelText("Drug Class") as HTMLSelectElement;
    const classes = within(drugClass).getAllByRole("option").map((o) => o.textContent);
    expect(classes).toContain("Cardiac glycoside");
    expect(classes).toContain("SGLT2 inhibitor");
    // Digoxin is under Cardiac glycoside by default.
    expect((screen.getByLabelText("Medicine") as HTMLSelectElement).value).toBe("Digoxin");
  });

  it("makes Dapagliflozin available when SGLT2 inhibitor is selected", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Drug Class"), { target: { value: "SGLT2 inhibitor" } });
    const medicine = screen.getByLabelText("Medicine") as HTMLSelectElement;
    const meds = within(medicine).getAllByRole("option").map((o) => o.textContent);
    expect(meds).toContain("Dapagliflozin");
    expect(meds).not.toContain("Digoxin");   // Dapagliflozin is not in the cardiac-glycoside class
    expect(medicine.value).toBe("Dapagliflozin"); // auto-selected on class change
  });
});

describe("EvidenceSearch incomplete-review medicine (Atorvastatin)", () => {
  it("offers Atorvastatin in the selector, labelled 'Evidence review incomplete'", () => {
    render(<Harness initial={{ condition: "Cardiovascular disease prevention", drugClass: "Statin", medicine: "Rosuvastatin" }} />);
    const medicine = screen.getByLabelText("Medicine") as HTMLSelectElement;
    const labels = within(medicine).getAllByRole("option").map((o) => o.textContent);
    // Verified medicine is offered plainly; incomplete one is offered with a clear label.
    expect(labels).toContain("Rosuvastatin");
    expect(labels.some((l) => l === "Atorvastatin · Evidence review incomplete")).toBe(true);
    // The default selection stays the VERIFIED medicine, not the incomplete one.
    expect(medicine.value).toBe("Rosuvastatin");
  });

  it("selecting the labelled Atorvastatin option sets the plain medicine value", () => {
    render(<Harness initial={{ condition: "Cardiovascular disease prevention", drugClass: "Statin", medicine: "Rosuvastatin" }} />);
    const medicine = screen.getByLabelText("Medicine") as HTMLSelectElement;
    fireEvent.change(medicine, { target: { value: "Atorvastatin" } });
    // The submitted value is the plain name so the API call is unchanged.
    expect(medicine.value).toBe("Atorvastatin");
  });

  it("no longer claims only verified medicines are selectable", () => {
    const { container } = render(<Harness />);
    const text = container.textContent || "";
    expect(text).not.toMatch(/Only medicines with verified evidence in AMIRA are selectable/i);
    expect(text).toMatch(/Incomplete evidence is clearly labelled and is not scored/i);
    expect(text).toMatch(/does not diagnose, prescribe, or recommend treatment/i);
  });
});
