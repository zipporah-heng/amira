import { useState } from "react";
import { NavLink } from "react-router-dom";
import amiraLogo from "../assets/amira-logo.png";

const NAV = [
  { to: "/amira/check-evidence", label: "Check Evidence" },
  { to: "/amira/research-map", label: "Research Map" },
  { to: "/amira/open-benchmark", label: "Open Benchmark" },
  { to: "/amira/methodology", label: "Methodology" },
];

/** Sticky horizontal top navigation (no left sidebar). Desktop: full-width bar
 *  with active-page state and a Share action on the right. Mobile: compact header
 *  with an accessible hamburger menu, keyboard support, and visible focus. */
export function TopNav() {
  const [open, setOpen] = useState(false);
  const share = () => navigator.clipboard?.writeText(window.location.href);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <NavLink to="/amira/check-evidence" className="topnav-brand" aria-label="AMIRA — Check Evidence">
          <img src={amiraLogo} alt="AMIRA" className="topnav-logo" />
        </NavLink>

        <nav className="topnav-links" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `topnav-link ${isActive ? "active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="topnav-right">
          <button className="share-btn" onClick={share}>⌁ Share</button>
          <button
            className="topnav-burger"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            aria-controls="topnav-mobile"
            onClick={() => setOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {open && (
        <nav id="topnav-mobile" className="topnav-mobile" aria-label="Primary mobile">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `topnav-mobile-link ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
