import { stats } from "../fixture";

export function FindingsPanel() {
  return (
    <div className="panel found">
      <h3>
        <span>✅</span> What we found
      </h3>
      <ul>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.studyCount}</b> studies in the reviewed sample included women.</span>
        </li>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.femaleTotal.toLocaleString()}</b> female participants were identified.</span>
        </li>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.sexSpecificOutcomes} of {stats.studyCount}</b> studies reported outcomes separately for women.</span>
        </li>
        <li>
          <span className="ic">•</span>
          <span><b>{stats.sexSpecificSafety} of {stats.studyCount}</b> studies reported sex-specific safety outcomes.</span>
        </li>
      </ul>
    </div>
  );
}
