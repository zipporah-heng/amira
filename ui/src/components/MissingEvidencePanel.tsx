import { Link } from "react-router-dom";
import { stats } from "../fixture";

export function MissingEvidencePanel() {
  const items = [
    `${stats.notMenopause} of ${stats.studyCount} studies did not report menopause status.`,
    `${stats.notHormoneTherapy} of ${stats.studyCount} studies did not report hormone therapy use.`,
    `${stats.studyCount} of ${stats.studyCount} studies did not analyze outcomes by reproductive stage.`,
    "Pregnant women were not included in any studies.",
    "Limited data on racial and ethnic diversity.",
  ];
  return (
    <div className="rail-card">
      <h3 className="rail-title missing">What's still missing</h3>
      <ul className="rail-list missing">
        {items.map((t) => (
          <li key={t}>
            <span className="ic x">✕</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="disclaimer" style={{ marginTop: 10 }}>
        In the sources reviewed. Absence of evidence is not evidence of absence.
      </p>
      <Link to="/amira/research-map" className="rail-link missing">See research gaps →</Link>
    </div>
  );
}
