import { useEffect, useState } from "react";
import { getNhanes, type NhanesContext as Ctx } from "../api";

/** Section 10 — Population Context (NHANES).
 *  Scientifically bounded: reported medication USE among U.S. women, from the
 *  official CDC survey, kept SEPARATE from clinical-trial evidence. Small/unstable
 *  cells are suppressed with an honest message — never a fabricated number. */

export function NhanesContext({ drugClass }: { drugClass: string }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setCtx(null); setErr(false);
    getNhanes(drugClass).then(setCtx).catch(() => setErr(true));
  }, [drugClass]);

  if (err) return null;

  return (
    <section className="card nhanes" id="nhanes" style={{ marginTop: 22 }}>
      <div className="nhanes-head">
        <div>
          <div className="section-title">Population Context — NHANES</div>
          <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
            How often women in the U.S. population report using this class of medicine, from the CDC
            National Health and Nutrition Examination Survey. This is population context, <b>separate from
            clinical-trial evidence</b> — not a measure of effectiveness, safety, or prescribing.
          </p>
        </div>
        <span className="nhanes-tag">CDC survey data</span>
      </div>

      {!ctx && <p className="muted" style={{ marginTop: 12 }}>Loading population context…</p>}

      {ctx && ctx.available === false && (
        <div className="callout" style={{ marginTop: 12 }}>{ctx.note}</div>
      )}

      {ctx && ctx.available && ctx.result && (
        <>
          <div className="nhanes-grid">
            {ctx.result.suppressed ? (
              <div className="nhanes-suppressed">
                <div className="nh-big">Estimate not displayed</div>
                <p>{ctx.result.suppression_reason}</p>
              </div>
            ) : (
              <>
                <div className="nhanes-stat">
                  <div className="nh-big">{ctx.result.weighted_use_percent}%</div>
                  <div className="nh-lab">of women report using a {ctx.result.drug_class.toLowerCase()}</div>
                  <div className="nh-sub">± {ctx.result.standard_error} (SE); weighted to the U.S. population</div>
                </div>
                <div className="nhanes-stat">
                  <div className="nh-big">{ctx.result.unweighted_users.toLocaleString()}</div>
                  <div className="nh-lab">women in the survey reported use (unweighted)</div>
                  <div className="nh-sub">{ctx.result.older_women_share_note}</div>
                </div>
              </>
            )}
          </div>

          <div className="nhanes-method">
            <div><span className="nh-k">Cycle</span> {ctx.cycle}</div>
            <div><span className="nh-k">Domain</span> {ctx.domain}</div>
            <div><span className="nh-k">Weight</span> {ctx.weight_variable}</div>
            <div><span className="nh-k">Design</span> strata {ctx.design_variables?.strata}, PSU {ctx.design_variables?.psu}</div>
            <div><span className="nh-k">Variance</span> {ctx.variance_method}</div>
            <div><span className="nh-k">Suppression</span> n &lt; {ctx.suppression_rule?.min_unweighted_numerator} or RSE &gt; {Math.round((ctx.suppression_rule?.max_relative_standard_error || 0) * 100)}%</div>
          </div>

          <div className="nhanes-foot">
            <p className="muted">{ctx.usage_boundary}</p>
            <div className="nhanes-files">
              {ctx.files?.map((f) => (
                <a key={f.name} href={f.data_url} target="_blank" rel="noopener noreferrer" className="src-link">
                  {f.name} ↗
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
