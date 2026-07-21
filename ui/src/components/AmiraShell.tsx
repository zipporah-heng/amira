import type { ReactNode } from "react";
import { TopNav } from "./TopNav";

export function AmiraShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <TopNav />
      <main className="main">
        <div className="container">
          {children}
          <div className="footer-note">
            <div className="brand-mission">Count women. Study women. Care for women.</div>
            AMIRA reviews published research evidence. It does not diagnose, prescribe, or
            recommend treatment.
            <br />
            Every statement links back to a source. If AMIRA cannot find the evidence, it says so.
          </div>
        </div>
      </main>
    </div>
  );
}
