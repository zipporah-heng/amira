import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import amiraLogo from "../assets/amira-logo.png";

const REPO_URL = "https://github.com/zipporah-heng/amira";

const NAV = [
  { to: "/amira/check-evidence", label: "Check Evidence" },
  { to: "/amira/research-map", label: "Research Map" },
  { to: "/amira/open-benchmark", label: "Open Benchmark" },
  { to: "/amira/methodology", label: "Methodology" },
];

/** Header: prominent AMIRA logo, functional platform navigation with an active
 *  state, and Share. On tablet/mobile the links collapse into an accessible
 *  menu (keyboard, focus, 44px targets, Escape to close). No technical status
 *  badges compete with the clinical question — that status lives in the AI
 *  evidence trace. The evidence selectors (condition/medicine) stay separate. */
export function Header() {
  const [open, setOpen] = useState(false);
  const share = () => navigator.clipboard?.writeText(window.location.href);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/amira/check-evidence" className="hdr-brand" aria-label="AMIRA — Evidence Intelligence Platform">
          <img src={amiraLogo} className="hdr-logo" alt="AMIRA" />
          <span className="hdr-tag">Evidence Intelligence Platform</span>
        </NavLink>

        <nav className="hdr-nav" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `hdr-nav-link ${isActive ? "active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
          <a className="hdr-nav-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </nav>

        <div className="hdr-right">
          <button className="share-btn hdr-share" onClick={share}>⌁ Share</button>
          <button
            className="hdr-burger"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            aria-controls="hdr-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {open && (
        <nav id="hdr-mobile-menu" className="hdr-mobile" aria-label="Primary (mobile)">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)}
              className={({ isActive }) => `hdr-mobile-link ${isActive ? "active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
          <a className="hdr-mobile-link" href={REPO_URL} target="_blank" rel="noopener noreferrer"
             onClick={() => setOpen(false)}>GitHub ↗</a>
        </nav>
      )}
    </header>
  );
}
