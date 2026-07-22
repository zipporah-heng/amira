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

export function WhatToNotice({ report }: { report: EvidenceResponse }) {
  const medicine = report.banner!.medicine;
  const mat = report.maturity!;
  const f = pickFinding(report);

  const drugPct = f && pct(f.female_rate, 0);
  const comparatorPct = f && pct(f.female_rate, 1);
  const hr = f && hrValue(f.female_estimate);
  const isMortality = f && /death|mortalit/i.test(f.endpoint);
  const isPostHoc = f && /post hoc/i.test(f.interpretation || "");
  const isPrespecified = f && /prespecified/i.test(f.interpretation || "");
  const noSexDiff = f?.significance === "no_significant_difference";
  const beneficial = hr != null && hr < 1;            // HR below 1 = fewer events
  const harmful = hr != null && hr > 1;

  // Colour semantics: green/calm for a beneficial-direction finding or a
  // no-significant-sex-difference result; pink/warn ONLY for an actual adverse
  // (mortality, harmful-direction) signal; amber for anything uncertain.
  const tone: "calm" | "warn" | "amber" =
    isMortality && harmful ? "warn"
    : noSexDiff || beneficial ? "calm"
    : "amber";
  const icon = tone === "warn" ? "⚠" : tone === "calm" ? "✓" : "◐";

  let headline: string;
  let statLine: string;
  if (f && drugPct && isMortality && harmful) {
    headline = `${drugPct} of women assigned ${medicine.toLowerCase()} died during follow-up`;
    statLine = [comparatorPct ? `${comparatorPct} placebo` : null,
      hr != null ? `adjusted HR ${hr}` : null, f.female_ci].filter(Boolean).join(" · ");
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

  const eyebrow = isPrespecified ? "Prespecified sex-specific analysis"
    : isPostHoc ? "Historical post hoc signal" : null;

  return (
    <section className="card notice-card" id="important-finding" style={{ marginTop: 18 }}>
      <h2 className="notice-title">What should I notice?</h2>
      <div className="notice-grid">
        {/* LEFT — the drug-specific finding, coloured by what the evidence means */}
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
