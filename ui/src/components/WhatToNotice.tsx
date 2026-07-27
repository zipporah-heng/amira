import type { CriticalSignal, EvidenceResponse, Finding } from "../api";
import { MaturityMeter } from "./MaturityMeter";

/** Section: "What should I notice?" — the SINGLE primary presentation of a
 *  medicine's headline signal. Two equal-height panels.
 *
 *  Left: the signal. When a verified Critical Signal exists for this medicine, the
 *  left card shows that signal's badges, headline, statistics, cautions, exact-passage
 *  link, and a "Why does this matter?" explanation — all in one place. There is no
 *  separate standalone signal panel elsewhere on the page. When there is no critical
 *  signal, the left card falls back to the medicine's drug-specific finding.
 *
 *  Right: the verified segmented Evidence Maturity meter. Every value is derived from
 *  a verified record; nothing is hard-coded. */

function pct(s: string | null, which: 0 | 1): string | null {
  if (!s) return null;
  const all = s.match(/(\d+(?:\.\d+)?)\s*%/g);
  if (!all || !all[which]) return null;
  return all[which].replace(/\s/g, "");
}
function hrValue(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function pickFinding(report: EvidenceResponse): Finding | null {
  const eff = report.effectiveness?.findings || [];
  const saf = report.safety?.significant_findings || [];
  return [...eff, ...saf].find((f) => f.significance === "significant" && f.scope.startsWith("trial:"))
    || eff.find((f) => f.scope.startsWith("trial:") && f.comparison_p)
    || eff.find((f) => f.scope.startsWith("trial:")) || eff[0] || null;
}

const trialOf = (scope: string) => (scope.split(":")[1] || "").trim();
const pluralize = (endpoint: string) =>
  endpoint.toLowerCase().replace(/\bevent$/i, "events");

/** LEFT card driven by a verified Critical Signal — the consolidated presentation. */
function SignalCard({ signal }: { signal: CriticalSignal }) {
  const isAdverse = /mortal|safety/i.test(signal.signal_type);
  const tone: "warn" | "amber" = isAdverse ? "warn" : "amber";
  const icon = tone === "warn" ? "⚠" : "◐";
  const isPostHoc = (signal.cautions || []).some((c) => /post hoc/i.test(c));
  const why = signal.why_matters
    || `A clinically important sex-specific signal was reported for ${signal.medicine.toLowerCase()}. This signal should not be missed, but it does not by itself determine treatment for an individual patient.`;
  return (
    <div className={`notice-finding ${tone}`}>
      <div className="nf-icon" aria-hidden>{icon}</div>
      <div className="nf-body">
        <div className="nf-badges">
          <span className={`nf-badge ${tone}`}>{signal.signal_type} Signal</span>
          <span className="nf-badge status">{signal.evidence_status}</span>
          {isPostHoc && <span className="nf-badge outline">Historical Post Hoc Signal</span>}
        </div>
        <div className="nf-headline">{signal.headline}</div>
        {signal.summary && <div className="nf-stats">{signal.summary}</div>}
        {signal.cautions?.length > 0 && <div className="nf-caveat">{signal.cautions.join(" · ")}</div>}
        {signal.source_url && (
          <a className="nf-link" href={signal.source_url} target="_blank" rel="noopener noreferrer">
            View exact passage →
          </a>
        )}
        <div className="nf-why">
          <h3>Why does this matter?</h3>
          <p>{why}</p>
          <p>Clinicians should consider this evidence alongside patient characteristics, current
            guidance, and the full balance of risks and benefits.</p>
        </div>
      </div>
    </div>
  );
}

/** LEFT card fallback — a medicine WITHOUT a verified critical signal. Derives the
 *  headline/tone from the drug-specific finding. */
function FindingCard({ report }: { report: EvidenceResponse }) {
  const medicine = report.banner!.medicine;
  const f = pickFinding(report);

  const drugPct = f && pct(f.female_rate, 0);
  const comparatorPct = f && pct(f.female_rate, 1);
  const hr = f && hrValue(f.female_estimate);
  const isMortality = f && /death|mortalit/i.test(f.endpoint);
  const isPostHoc = f && /post hoc/i.test(f.interpretation || "");
  const isPrespecified = f && /prespecified/i.test(f.interpretation || "");
  const womenOnly = f?.population_scope === "women_only_life_stage";
  const noSexDiff = f?.significance === "no_significant_difference";
  const beneficial = hr != null && hr < 1;
  const harmful = hr != null && hr > 1;

  const tone: "calm" | "warn" | "amber" =
    isMortality && harmful ? "warn"
    : womenOnly || noSexDiff || beneficial ? "calm"
    : "amber";
  const icon = tone === "warn" ? "⚠" : tone === "calm" ? "✓" : "◐";

  let headline: string;
  let statLine: string;
  if (f && drugPct && isMortality && harmful) {
    headline = `${drugPct} of women assigned ${medicine.toLowerCase()} died during follow-up`;
    statLine = [comparatorPct ? `${comparatorPct} placebo` : null,
      hr != null ? `adjusted HR ${hr}` : null, f.female_ci].filter(Boolean).join(" · ");
  } else if (f && womenOnly) {
    headline = `${medicine}: outcomes reported in the women-only ${trialOf(f.scope)}`;
    statLine = [f.female_estimate, f.female_ci].filter(Boolean).join(" · ");
  } else if (f && noSexDiff) {
    headline = `${medicine}: no statistically significant difference in treatment effect by sex identified`;
    statLine = [f.female_estimate ? `Women ${f.female_estimate}` : null, f.female_ci,
      f.comparison_p ? `Interaction P = ${f.comparison_p}` : null].filter(Boolean).join(" · ");
  } else if (f && beneficial) {
    headline = `${medicine}: fewer ${pluralize(f.endpoint)} reported in women in ${trialOf(f.scope)}`;
    statLine = [f.female_estimate, f.female_ci].filter(Boolean).join(" · ");
  } else if (f) {
    headline = `${medicine}: a sex-specific signal on ${f.endpoint.toLowerCase()}`;
    statLine = [f.female_estimate, f.female_ci].filter(Boolean).join(" · ");
  } else {
    headline = `No drug-specific sex-based finding was located for ${medicine}.`;
    statLine = "";
  }

  const eyebrow = womenOnly ? "Women-only trial"
    : isPrespecified ? "Prespecified sex-specific analysis"
    : isPostHoc ? "Historical post hoc signal" : null;

  return (
    <div className={`notice-finding ${tone}`}>
      <div className="nf-icon" aria-hidden>{icon}</div>
      <div className="nf-body">
        {eyebrow && <div className="nf-eyebrow">{eyebrow}</div>}
        <div className="nf-headline">{headline}</div>
        {statLine && <div className="nf-stats">{statLine}</div>}
        <div className="nf-caveat">
          Not menopause-specific · Not a treatment recommendation · Does not establish an
          individual patient's outcome
        </div>
        {f && (
          <a className="nf-link" href={f.source.url} target="_blank" rel="noopener noreferrer">
            View exact passage →
          </a>
        )}
      </div>
    </div>
  );
}

export function WhatToNotice({ report, signal = null }: { report: EvidenceResponse; signal?: CriticalSignal | null }) {
  const mat = report.maturity!;
  return (
    <section className="card notice-card" id="important-finding" style={{ marginTop: 18 }}>
      <h2 className="notice-title">What should I notice?</h2>
      <div className="notice-grid">
        {/* LEFT — the single primary signal presentation */}
        {signal ? <SignalCard signal={signal} /> : <FindingCard report={report} />}

        {/* RIGHT — evidence maturity */}
        <div className="notice-maturity">
          <div className="nm-head">Evidence Maturity</div>
          {report.banner!.evidence_review_complete === false && (
            <span className="review-status-badge" role="status">Evidence review incomplete</span>
          )}
          <MaturityMeter level={mat.level} maxLevel={mat.max_level} label={mat.label} scored={mat.scorable !== false} />
          <p className="nm-note">This measures evidence completeness—not whether the medicine is better.</p>
        </div>
      </div>
    </section>
  );
}
