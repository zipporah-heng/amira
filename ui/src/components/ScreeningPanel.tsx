import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { StudySelection } from "../api";

interface ScreeningRow {
  candidate: string; identifier_type: string; decision: string; reason: string;
}

export function ScreeningPanel({ selection }: { selection?: StudySelection }) {
  const [rows, setRows] = useState<ScreeningRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/screening-log").then((r) => r.json()).then((d) => setRows(d.screening_log || []));
  }, []);

  return (
    <section id="screening" className="card">
      <div className="section-title">How studies were selected</div>
      {selection && (
        <div className="screen-counts">
          <div><b>{selection.candidate_records_screened}</b><span>candidate records screened</span></div>
          <div className="ok"><b>{selection.evidence_sources_included}</b><span>evidence sources included</span></div>
          <div><b>{selection.unique_phase3_rcts_identified}</b><span>unique Phase 3 RCTs</span></div>
          <div className="x"><b>{selection.records_excluded}</b><span>records excluded</span></div>
          <div><b>{selection.records_deferred}</b><span>deferred</span></div>
        </div>
      )}
      {selection && (
        <p className="muted" style={{ marginTop: 10 }}>
          {selection.reconciliation}
        </p>
      )}
      <button className="mb-toggle" onClick={() => setOpen(!open)} style={{ marginTop: 12 }}>
        {open ? "Hide" : "View"} screening methodology
      </button>
      {open && (
        <div className="tbl-wrap" style={{ marginTop: 12 }}>
          <table className="studies">
            <thead><tr><th>Candidate</th><th>Type</th><th>Decision</th><th>Reason</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.candidate}>
                  <td className="td-name">{r.candidate}</td>
                  <td>{r.identifier_type}</td>
                  <td><span className={`decision ${r.decision}`}>{r.decision}</span></td>
                  <td style={{ maxWidth: 380 }}>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="disclaimer" style={{ marginTop: 10 }}>
        Discovery: ClinicalTrials.gov + PubMed + PubMed Central are the authoritative sources.
        Secondary tools are used only as completeness checks; any study they surface is traced back
        to a primary source before ingestion. <Link to="/amira/methodology" className="rail-link">Full methodology →</Link>
      </p>
    </section>
  );
}
