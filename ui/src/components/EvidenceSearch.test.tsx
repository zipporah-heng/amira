import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceSearch, type Filters, type ConditionEntry } from "./EvidenceSearch";

const catalog: ConditionEntry[] = [{
  condition: "Heart failure",
  drug_classes: [
    { drug_class: "Cardiac glycoside", medicines: ["Digoxin"] },
    { drug_class: "SGLT2 inhibitor", medicines: ["Dapagliflozin"] },
  ],
}];

function Harness() {
  const [filters, setFilters] = useState<Filters>({
    condition: "Heart failure", drugClass: "Cardiac glycoside", medicine: "Digoxin",
    lifeStage: "not_specified", hormoneTherapy: "Any",
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
