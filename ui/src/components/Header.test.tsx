import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

const renderHeader = (path = "/amira/check-evidence") =>
  render(<MemoryRouter initialEntries={[path]}><Header /></MemoryRouter>);

describe("Header", () => {
  it("renders the AMIRA logo lockup and no left sidebar", () => {
    const { container } = renderHeader();
    const logo = container.querySelector("img.hdr-logo") as HTMLImageElement | null;
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute("alt")).toBe("AMIRA");
    expect(screen.getByText("Evidence Intelligence Platform")).toBeInTheDocument();
    expect(container.querySelector("nav.nav")).toBeNull();
  });

  it("has no technical status badges in the header", () => {
    renderHeader();
    expect(screen.queryByText("Source-linked evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded AI extraction demo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Video-ready/i)).not.toBeInTheDocument();
  });

  it("has no Share button (and is not replaced by Login)", () => {
    const { container } = renderHeader();
    expect(container.querySelector(".hdr-share")).toBeNull();
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/log ?in/i)).not.toBeInTheDocument();
  });

  it("provides functional platform navigation with the correct routes", () => {
    renderHeader();
    const routes: Record<string, string> = {
      "Check Evidence": "/amira/check-evidence",
      "Research Map": "/amira/research-map",
      "Open Benchmark": "/amira/open-benchmark",
      "Methodology": "/amira/methodology",
    };
    for (const [label, href] of Object.entries(routes)) {
      // both desktop and mobile copies exist; check at least one has the right href
      const links = screen.getAllByRole("link", { name: label });
      expect(links.some((l) => l.getAttribute("href") === href)).toBe(true);
    }
  });

  it("opens GitHub at the repository root in a new tab (not a branch/PR page)", () => {
    renderHeader();
    const gh = screen.getAllByRole("link", { name: /GitHub/ })[0];
    expect(gh.getAttribute("href")).toBe("https://github.com/zipporah-heng/amira");
    expect(gh.getAttribute("target")).toBe("_blank");
    expect(gh.getAttribute("href")).not.toMatch(/pull|tree|blob/);
  });

  it("shows an active state for the current screen", () => {
    const { container } = renderHeader("/amira/research-map");
    const active = container.querySelector(".hdr-nav-link.active");
    expect(active?.textContent).toBe("Research Map");
  });

  it("has an accessible mobile menu toggle that opens and closes", () => {
    renderHeader();
    const burger = screen.getByLabelText("Toggle navigation menu");
    expect(burger.getAttribute("aria-expanded")).toBe("false");
    expect(burger.getAttribute("aria-controls")).toBe("hdr-mobile-menu");
    fireEvent.click(burger);
    expect(burger.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("hdr-mobile-menu")).not.toBeNull();
  });
});
