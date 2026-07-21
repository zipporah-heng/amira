import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TopNav } from "./TopNav";

const renderNav = () => render(<MemoryRouter initialEntries={["/amira/check-evidence"]}><TopNav /></MemoryRouter>);

describe("TopNav", () => {
  it("renders a horizontal top navigation with all destinations and no left sidebar", () => {
    const { container } = renderNav();
    expect(container.querySelector("nav.nav")).toBeNull();            // no sidebar
    expect(container.querySelector(".topnav")).not.toBeNull();        // sticky top nav
    for (const label of ["Check Evidence", "Research Map", "Open Benchmark", "Methodology"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("exposes a Share action and an accessible hamburger toggle", () => {
    renderNav();
    expect(screen.getByText(/Share/)).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle navigation menu")).toBeInTheDocument();
  });
});
