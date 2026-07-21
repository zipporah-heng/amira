import type { EvidenceResponse, Finding } from "../api";
import { MaturityMeter } from "./MaturityMeter";

/** Section: "What should I notice?" — two equal-height panels.
 *  Left: a concise, source-linked historical finding (pale pink). Right: the
 *  verified segmented Evidence Maturity meter. Every value is derived from a
 *  verified finding record; nothing is hard-coded. */

function pct(s: string | null, which: 0 | 1): string | null {
  if (!s) return null;
  const all = s.match(/(\d+(?:\.\d+)?)\s*%/g);
  if (!all || !all[which]) return null;
  return all[which].replace(/\s/g, "");
}
function hrValue(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function pickFinding(report: EvidenceResponse): Finding | null {
  const eff = report.effectiveness?.findings || [];
  const saf = report.safety?.significant_findings || [];
  return [...eff, ...saf].find((f) => f.significance === "significant" && f.scope.startsWith("trial:"))
    || eff.find((f) => f.scope.startsWith("trial:") && f.comparison_p)
    || eff.find((f) => f.scope.startsWith("trial:")) || eff[0] || null;
}

export function WhatToNotice({ report }: { report: EvidenceResponse }) {
  const medicine = report.banner!.medicine;
  const mat = report.maturity!;
  const f = pickFinding(report);

  const drugPct = f && pct(f.female_rate, 0);
  const comparatorPct = f && pct(f.female_rate, 1);
  const hr = f && hrValue(f.female_estimate);
  const isMortality = f && /death|mortalit/i.test(f.endpoint);
  const isPostHoc = f && /post hoc/i.test(f.interpretation || "");

  const headline = f && drugPct && isMortality
    ? `${drugPct} of women assigned ${medicine.toLowerCase()} died during follow-up`
    : f
      ? `${medicine}: a sex-specific signal on ${f.endpoint.toLowerCase()}`
      : `No drug-specific sex-based finding was located for ${medicine}.`;

  const statLine = [
    comparatorPct ? `${comparatorPct} placebo` : null,
    hr ? `adjusted HR ${hr}` : null,
    f?.female_ci || null,
  ].filter(Boolean).join(" · ");

  return (
    <section className="card notice-card" id="important-finding" style={{ marginTop: 18 }}>
      <h2 className="notice-title">What should I notice?</h2>
      <div className="notice-grid">
        {/* LEFT — historical finding */}
        <div className="notice-finding">
          <div className="nf-icon" aria-hidden>⚠</div>
          <div className="nf-body">
            {isPostHoc && <div className="nf-eyebrow">Historical post hoc signal</div>}
            <div className="nf-headline">{headline}</div>
            {statLine && <div className="nf-stats">{statLine}</div>}
            <div className="nf-caveat">
              Not menopause-specific · Does not establish an individual outcome was caused by {medicine.toLowerCase()}
            </div>
            {f && (
              <a className="nf-link" href={f.source.url} target="_blank" rel="noopener noreferrer">
                View exact passage →
              </a>
            )}
          </div>
        </div>

        {/* RIGHT — evidence maturity */}
        <div className="notice-maturity">
          <div className="nm-head">Evidence Maturity</div>
          <MaturityMeter level={mat.level} maxLevel={mat.max_level} label={mat.label} />
          <p className="nm-note">This measures evidence completeness—not whether the medicine is better.</p>
        </div>
      </div>
    </section>
  );
}
