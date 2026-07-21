import { useNavigate } from "react-router-dom";

/** "Continue exploring the evidence" — one horizontal row of compact bordered
 *  buttons. Internal routes navigate in-app; downloads hit the API. */
export function ContinueExploring({ onWhy, onPassages }: { onWhy: () => void; onPassages: () => void }) {
  const nav = useNavigate();
  const links: { icon: string; label: string; action: () => void }[] = [
    { icon: "❓", label: "Why this result", action: onWhy },
    { icon: "❝", label: "Exact passages", action: onPassages },
    { icon: "🗺️", label: "Research Map", action: () => nav("/amira/research-map") },
    { icon: "🗂️", label: "Open dataset", action: () => window.open("/api/download/trials.csv", "_blank") },
    { icon: "🌐", label: "Open benchmark", action: () => nav("/amira/open-benchmark") },
    { icon: "🕘", label: "Methodology", action: () => nav("/amira/methodology") },
    { icon: "⬇️", label: "Download CSV / JSONL", action: () => window.open("/api/download/findings.jsonl", "_blank") },
  ];
  return (
    <section className="continue" id="continue-exploring" style={{ marginTop: 22 }}>
      <h2 className="continue-h">Continue exploring the evidence</h2>
      <div className="continue-row">
        {links.map((l) => (
          <button className="continue-btn" key={l.label} onClick={l.action}>
            <span aria-hidden>{l.icon}</span> {l.label}
          </button>
        ))}
      </div>
    </section>
  );
}
