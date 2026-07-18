import { NavLink } from "react-router-dom";

const ACTIVE = [
  { to: "/amira/check-evidence", label: "Check the Evidence", icon: "🔬" },
  { to: "/amira/research-map", label: "Research Map", icon: "🗺️" },
  { to: "/amira/open-benchmark", label: "Open AMIRA Benchmark", icon: "📦" },
  { to: "/amira/methodology", label: "Methodology", icon: "📐" },
];

const PLACEHOLDER = [
  { label: "Home", icon: "🏠" },
  { label: "Evidence Library", icon: "📚" },
  { label: "About AMIRA", icon: "💜" },
];

export function Sidebar() {
  return (
    <nav className="nav">
      <div className="brand">
        <div className="mark">A</div>
        <div>
          <div className="name">AMIRA</div>
          <div className="tag">Clearer evidence for women's health</div>
        </div>
      </div>

      <div className="nav-label">Product</div>
      <button className="navitem disabled" disabled>
        <span>🏠</span> Home <span className="soon">soon</span>
      </button>
      {ACTIVE.slice(0, 1).map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => `navitem ${isActive ? "active" : ""}`}>
          <span>{n.icon}</span> {n.label}
        </NavLink>
      ))}

      <div className="nav-label">Research</div>
      {ACTIVE.slice(1).map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => `navitem ${isActive ? "active" : ""}`}>
          <span>{n.icon}</span> {n.label}
        </NavLink>
      ))}

      <div className="nav-sep" />
      {PLACEHOLDER.slice(1).map((n) => (
        <button key={n.label} className="navitem disabled" disabled>
          <span>{n.icon}</span> {n.label} <span className="soon">soon</span>
        </button>
      ))}

      <div className="navfoot">
        Every statement links back to a source. If AMIRA cannot find the evidence, it says so.
      </div>
    </nav>
  );
}
