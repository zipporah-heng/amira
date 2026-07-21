import { useEffect, useState } from "react";
import { getNhanes, type NhanesContext as Ctx } from "../api";

/** Compact "Population Context — NHANES" teal panel (mockup). Three method
 *  columns + a stability statement + the usage boundary. The full technical
 *  grid lives in the NHANES data card, not on the main page. Truthful suppressed
 *  state is preserved for classes with an insufficient sample (e.g. Digoxin). */
export function NhanesContext({ drugClass }: { drugClass: string }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  useEffect(() => { setCtx(null); getNhanes(drugClass).then(setCtx).catch(() => setCtx(null)); }, [drugClass]);

  const r = ctx?.result;
  const cycle = ctx?.cycle;
  const sampleNote = r
    ? (r.suppressed
        ? `${drugClass} sample too small (n=${r.unweighted_users}); estimate suppressed`
        : `${r.weighted_use_percent}% of women (n=${r.unweighted_users})`)
    : "Sample counts reflect unweighted respondents";

  return (
    <section className="card nhanes-panel" id="nhanes" style={{ marginTop: 18 }}>
      <div className="nhp-head">
        <h2 className="nhp-h">Population Context — NHANES</h2>
        <div className="nhp-sub">Reported medication use in surveyed U.S. women</div>
      </div>
      <div className="nhp-cols">
        <div className="nhp-col">
          <div className="nhp-ic" aria-hidden>📊</div>
          <div className="nhp-k">Survey-weighted analysis</div>
          <div className="nhp-v">Estimates account for the complex survey design.</div>
        </div>
        <div className="nhp-col">
          <div className="nhp-ic" aria-hidden>📋</div>
          <div className="nhp-k">Cycle + variables documented</div>
          <div className="nhp-v">NHANES {cycle || "cycle"} and variables are documented for transparency.</div>
        </div>
        <div className="nhp-col">
          <div className="nhp-ic" aria-hidden>👥</div>
          <div className="nhp-k">Unweighted sample shown</div>
          <div className="nhp-v">{sampleNote}.</div>
        </div>
      </div>
      <div className="nhp-stable">✓ Estimate displayed only when the sample is stable</div>
      <div className="nhp-boundary">
        <span aria-hidden>ⓘ</span> Population context—not effectiveness, safety, causality or prescription volume.
      </div>
    </section>
  );
}
