import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

const renderHeader = () => render(<MemoryRouter><Header /></MemoryRouter>);

describe("Header", () => {
  it("shows an enlarged AMIRA logo lockup and no left sidebar", () => {
    const { container } = renderHeader();
    const logo = container.querySelector("img.hdr-logo") as HTMLImageElement | null;
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute("alt")).toBe("AMIRA");
    expect(screen.getByText("Evidence Intelligence Platform")).toBeInTheDocument();
    expect(container.querySelector("nav.nav")).toBeNull();
  });

  it("does not show technical status badges in the header", () => {
    renderHeader();
    // These belong inside the AI evidence trace, not competing with the clinical question.
    expect(screen.queryByText("Source-linked evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded AI extraction demo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Video-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cached records/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Concept mockup/i)).not.toBeInTheDocument();
  });
});
