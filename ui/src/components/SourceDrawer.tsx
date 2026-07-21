import type { TrialRow } from "../api";
import { BasisBadge, HumanReviewBadge, SourceVerifiedBadge } from "./DemoBadge";

export function SourceDrawer({ trial, onClose }: { trial: TrialRow; onClose: () => void }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Study source detail">
        <div className="dr-head">
          <div>
            <div className="section-title">Study source</div>
            <h2 style={{ fontSize: 18, marginTop: 6, maxWidth: 420 }}>{trial.display_name}</h2>
            <a href={trial.registry_url} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: 13 }}>{trial.nct_id} on ClinicalTrials.gov ↗</a>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="dr-body">
          <div className="dr-meta">
            <div><div className="k">Total participants</div><div className="v">{trial.total_enrollment != null ? trial.total_enrollment.toLocaleString() : "Not reported"}</div></div>
            <div><div className="k">Women (N)</div><div className="v">{trial.female_n != null ? trial.female_n.toLocaleString() : "Not reported"}</div></div>
            <div><div className="k">% Women</div><div className="v">{trial.female_pct != null ? `${trial.female_pct}%` : "—"}</div></div>
            <div><div className="k">Minimum age</div><div className="v">{trial.minimum_age || "—"}</div></div>
            <div><div className="k">Study type</div><div className="v">{trial.study_type}</div></div>
            <div><div className="k">Year</div><div className="v">{trial.year ?? "—"}</div></div>
          </div>

          <h3 style={{ fontSize: 14, marginTop: 22 }}>
            Evidence assertions ({trial.assertions.length})
          </h3>
          <p style={{ fontSize: 12.5, marginTop: 4 }}>
            Each assertion below carries the exact passage and source it was drawn from. A
            value is shown as evidence-backed only when its assertion is verified against a
            resolvable, authoritative source; otherwise its evidence state (not located / not
            reported / evidence status unavailable) is shown instead.
          </p>

          {trial.assertions.map((a) => (
            <div className="src-item" key={a.assertion_id} style={{ marginTop: 14 }}>
              <div className="st">
                {a.dimension.replace(/_/g, " ")}: <strong>{String(a.value ?? "not reported")}</strong>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <BasisBadge basis={a.value_basis} />
                {a.source_verified && <SourceVerifiedBadge />}
                <HumanReviewBadge verified={a.human_verified} />
              </div>
              <div className="src-meta" style={{ marginTop: 8 }}>
                <span>{a.source.title}</span>
                {a.source.publisher && <span>{a.source.publisher}</span>}
                {a.source.year && <span>{a.source.year}</span>}
                {a.source.pmid && <span>PMID {a.source.pmid}</span>}
                {a.source.pmcid && <span>{a.source.pmcid}</span>}
                {a.source_locator && <span>{a.source_locator}</span>}
              </div>
              <div className="passage">"{a.exact_passage}"</div>
              {a.notes && <div className="rationale">{a.notes}</div>}
              <div style={{ marginTop: 10 }}>
                <a href={a.source.url} target="_blank" rel="noopener noreferrer">
                  Open source ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
