import { stats } from "../fixture";

export function MissingEvidencePanel() {
  return (
    <div className="panel missing">
      <h3>
        <span>🔎</span> What is still missing
      </h3>
      <ul>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.notMenopause} of {stats.studyCount}</b> studies did not report menopausal status, in the reviewed studies.</span>
        </li>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.notHormoneTherapy} of {stats.studyCount}</b> studies did not report hormone therapy use, in the reviewed studies.</span>
        </li>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.notSexSpecific} of {stats.studyCount}</b> studies did not report sex-specific outcomes, in the reviewed studies.</span>
        </li>
        <li>
          <span className="ic">•</span>
          <span>No pregnancy-specific evidence was identified in the reviewed sample.</span>
        </li>
      </ul>
      <div className="disclaimer">
        Missing evidence in the sources reviewed does not mean the medicine does not work or
        is unsafe. AMIRA measures evidence coverage, not clinical performance.
      </div>
    </div>
  );
}
