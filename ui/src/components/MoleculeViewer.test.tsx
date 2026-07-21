import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../public/molecules/index.json";
import { MoleculeViewer } from "./MoleculeViewer";

afterEach(() => { vi.restoreAllMocks(); });

describe("molecule structure mapping", () => {
  it("maps each medicine to a real, distinct PubChem CID", () => {
    const m = manifest as Record<string, { cid: number; file: string; source: string }>;
    expect(m["Digoxin"].cid).toBe(2724385);          // real digoxin CID, never decorative
    expect(m["Dapagliflozin"].cid).toBe(9887712);
    const cids = Object.values(m).map((x) => x.cid);
    expect(new Set(cids).size).toBe(cids.length);     // all distinct
    for (const v of Object.values(m)) {
      expect(v.source).toBe("PubChem");
      expect(v.file).toMatch(/\.sdf$/);
    }
  });
});

describe("MoleculeViewer fallback", () => {
  it("shows an accessible static fallback when the structure cannot load", async () => {
    // jsdom has no canvas/fetch for structures — force the failure path.
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network"))));
    render(<MoleculeViewer medicine="Digoxin" />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Molecular structure of Digoxin unavailable/i)).toBeInTheDocument()
    );
  });
});
