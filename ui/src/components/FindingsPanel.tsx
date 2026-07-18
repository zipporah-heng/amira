import { Link } from "react-router-dom";
import { stats } from "../fixture";

export function FindingsPanel() {
  const items = [
    `Women were included in ${stats.studyCount} studies.`,
    `${stats.femaleTotal.toLocaleString()} women participants identified.`,
    `Cholesterol-lowering efficacy was reported in women in ${stats.sexSpecificOutcomes} studies.`,
    `Safety outcomes were reported in women in ${stats.sexSpecificSafety} studies.`,
  ];
  return (
    <div className="rail-card">
      <h3 className="rail-title">What we found</h3>
      <ul className="rail-list found">
        {items.map((t) => (
          <li key={t}>
            <span className="ic ok">✓</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <Link to="/amira/methodology" className="rail-link">See all findings →</Link>
    </div>
  );
}
