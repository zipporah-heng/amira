import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReusableAssets } from "./ReusableAssets";

describe("ReusableAssets links", () => {
  it("points every GitHub asset link at main, never the retired video-redesign branch", () => {
    render(<ReusableAssets />);
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    const gh = links.filter((l) => l.href.includes("github.com/zipporah-heng/amira/blob/"));
    expect(gh.length).toBeGreaterThan(0);
    for (const l of gh) {
      expect(l.href).toContain("/blob/main/");
      expect(l.href).not.toContain("video-redesign");
    }
  });
});
