import type { EvidenceResponse, Finding } from "../api";

/** Section 3 — the "so what". A prominent, source-linked "What should I notice?"
 *  panel derived ENTIRELY from verified finding records. No number is written in
 *  React: the headline, comparison and statistics are read from the finding. The
 *  comparison and limitations are always shown alongside any striking figure, so
 *  a rate is never presented as a drug-caused outcome rate. */

function leadingPercent(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

function pickHeadlineFinding(report: EvidenceResponse): Finding | null {
  const eff = report.effectiveness?.findings || [];
  const saf = report.safety?.significant_findings || [];
  // Prefer a significant drug-specific finding (the strongest "notice this").
  const sig = [...eff, ...saf].find((f) => f.significance === "significant" && f.scope.startsWith("trial:"));
  if (sig) return sig;
  // Otherwise a drug-specific finding that carries a formal comparison.
  const compared = eff.find((f) => f.scope.startsWith("trial:") && f.comparison_p);
  if (compared) return compared;
  // Otherwise the first drug-specific finding of any kind.
  return eff.find((f) => f.scope.startsWith("trial:")) || eff[0] || null;
}

function plainHeadline(f: Finding, medicine: string): string {
  const pct = leadingPercent(f.female_rate);
  const isMortality = /death|mortalit/i.test(f.endpoint);
  if (f.significance === "significant" && pct != null && isMortality) {
    const oneIn = Math.round(100 / pct);
    return `About 1 in ${oneIn} women assigned ${medicine.toLowerCase()} died during follow-up.`;
  }
  if (f.significance === "significant") {
    return `A sex difference was reported for ${medicine.toLowerCase()} on ${f.endpoint.toLowerCase()}.`;
  }
  if (f.significance === "no_significant_difference") {
    return `No statistically significant difference in ${medicine.toLowerCase()}'s effect between women and men was identified.`;
  }
  return `${medicine} — what the women's evidence shows on ${f.endpoint.toLowerCase()}.`;
}

function limitationChips(f: Finding): string[] {
  const chips: string[] = [];
  const interp = (f.interpretation || "").toLowerCase();
  if (interp.includes("post hoc")) chips.push("Historical post hoc analysis");
  if (f.population_scope === "women_only_life_stage") chips.push("Women-only study — not a between-sex comparison");
  chips.push("Not menopause-specific");
  if (f.significance === "significant") {
    chips.push("Shows an association, not proof that the medicine caused an individual outcome");
  }
  if (f.significance === "no_significant_difference") {
    chips.push("Not a head-to-head comparison against other medicines");
  }
  return chips;
}

export function ImportantFinding({ report }: { report: EvidenceResponse }) {
  const medicine = report.banner!.medicine;
  const f = pickHeadlineFinding(report);
  if (!f) {
    return (
      <section className="card important-finding neutral" id="important-finding" style={{ marginTop: 22 }}>
        <div className="if-eyebrow">What should I notice?</div>
        <h2 className="if-headline">No drug-specific sex-based finding was located for {medicine}.</h2>
        <p className="muted">
          The reviewed sources do not report a sex-specific outcome for {medicine}. This reflects a gap
          in the retrieved evidence, not a confirmed absence of any difference.
        </p>
      </section>
    );
  }
  const tone = f.significance === "significant" ? "warn" : "info";
  const chips = limitationChips(f);

  return (
    <section className={`card important-finding ${tone}`} id="important-finding" style={{ marginTop: 22 }}>
      <div className="if-eyebrow">What should I notice?</div>
      <h2 className="if-headline">{plainHeadline(f, medicine)}</h2>

      <div className="if-compare">
        {f.female_rate && (
          <div className="if-stat">
            <div className="if-k">Women (this medicine vs comparison)</div>
            <div className="if-v">{f.female_rate}</div>
          </div>
        )}
        {f.female_estimate && (
          <div className="if-stat">
            <div className="if-k">Effect in women</div>
            <div className="if-v">{f.female_estimate}{f.female_ci ? ` (${f.female_ci})` : ""}</div>
          </div>
        )}
        {f.male_estimate && (
          <div className="if-stat">
            <div className="if-k">Effect in men</div>
            <div className="if-v">{f.male_estimate}{f.male_ci ? ` (${f.male_ci})` : ""}</div>
          </div>
        )}
        {f.comparison_p && (
          <div className="if-stat">
            <div className="if-k">{f.comparison_test || "Sex comparison"}</div>
            <div className="if-v">P = {f.comparison_p}</div>
          </div>
        )}
      </div>

      <p className="if-interp">{f.interpretation}</p>

      <div className="if-chips">
        {chips.map((c) => <span key={c} className="if-chip">{c}</span>)}
      </div>

      <blockquote className="passage">"{f.exact_passage}"</blockquote>
      <div className="if-src">
        <span className="muted">
          {f.source.title} · {f.source.source_type.replace(/_/g, " ")}
          {f.source.pmid && <> · PMID {f.source.pmid}</>}
        </span>
        <a href={f.source.url} target="_blank" rel="noopener noreferrer">Open source ↗</a>
      </div>
    </section>
  );
}
