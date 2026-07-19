import { NavLink } from "react-router-dom";
import amiraLogo from "../assets/amira-logo.png";

const NAV: { to?: string; label: string; icon: string }[] = [
  { label: "Home", icon: "🏠" },
  { to: "/amira/check-evidence", label: "Check the Evidence", icon: "🔍" },
  { to: "/amira/research-map", label: "Research Map", icon: "🗺️" },
  { to: "/amira/open-benchmark", label: "Open AMIRA Benchmark", icon: "🌐" },
  { label: "Evidence Library", icon: "📚" },
  { to: "/amira/methodology", label: "Methodology", icon: "🕘" },
  { label: "About AMIRA", icon: "ⓘ" },
];

export function Sidebar() {
  return (
    <nav className="nav">
      <div className="brand">
        <img src={amiraLogo} alt="AMIRA" className="brand-logo" width={150} />
        <div className="tag">Evidence Intelligence Platform</div>
      </div>

      {NAV.map((n) =>
        n.to ? (
          <NavLink key={n.label} to={n.to} className={({ isActive }) => `navitem ${isActive ? "active" : ""}`}>
            <span>{n.icon}</span> {n.label}
          </NavLink>
        ) : (
          <button key={n.label} className="navitem disabled" disabled>
            <span>{n.icon}</span> {n.label} <span className="soon">soon</span>
          </button>
        )
      )}

      <div className="trust-card">
        <div className="trust-head">
          <span>🛡️</span> Evidence you can trust
        </div>
        <p>Every statement is linked to a source.</p>
        <a href="#" onClick={(e) => e.preventDefault()} className="rail-link">Learn how AMIRA works →</a>
      </div>
    </nav>
  );
}
