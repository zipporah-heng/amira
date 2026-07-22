import type { WhoRow } from "../api";
import { EVIDENCE_STATE, toEvidenceState } from "../evidenceState";

export function WhoWasStudied({ rows }: { rows: WhoRow[] }) {
  const stateLabel = (token?: string) => EVIDENCE_STATE[toEvidenceState(token)].label;
  return (
    <section id="who" className="card">
      <div className="section-title">Who was studied?</div>
      <div className="who-grid">
        {rows.map((w) => (
          <div className="who-card" key={w.trial_id}>
            <div className="who-title">
              <a href={w.registry_url} target="_blank" rel="noopener noreferrer">{w.display_name}</a>
              <span className="who-nct">{w.nct_id || w.source_label || "Primary publication"}</span>
            </div>
            <div className="who-rows">
              <div><span>Medicine</span><b>{w.medicine}</b></div>
              <div><span>Phase</span><b>{w.study_phase || "—"}</b></div>
              <div><span>Total participants</span><b>{w.total_participants != null ? w.total_participants.toLocaleString() : "Not reported"}</b></div>
              <div><span>Women (N)</span><b>{w.female_n != null ? w.female_n.toLocaleString() : stateLabel(w.female_n_state ?? w.female_n_basis)}</b></div>
              <div><span>% women</span><b>{w.female_pct != null ? `${w.female_pct}%${(w.female_pct_state ?? w.female_pct_basis) === "derived" ? " (derived)" : ""}` : stateLabel(w.female_pct_state ?? w.female_pct_basis)}</b></div>
              <div><span>Minimum age</span><b>{w.minimum_age || "—"}</b></div>
              <div><span>Indication</span><b>{w.indication || "—"}</b></div>
            </div>
            <div className="who-endpoint"><span>Primary endpoint:</span> {w.primary_endpoint}</div>
            <p className="who-age-note">{w.age_note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
