/** The hormonal-health focus statement, shown near the top of the app and the
 *  Methodology page (identical wording lives in the README). It states AMIRA's
 *  specific problem and its guardrails in GENERIC terms — no medicine-specific
 *  copy lives in this shared component. */
export function HormonalFocus({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`hormonal-focus${compact ? " compact" : ""}`} aria-label="Hormonal health focus">
      <p className="hf-lead">
        AMIRA addresses a specific hormonal health evidence problem: researchers cannot
        consistently determine whether <strong>menopause</strong> and <strong>hormone therapy</strong>{" "}
        were represented in medication studies. AMIRA uses AI to extract and structure these fields
        while preserving what was <strong>not reported</strong> or <strong>could not be located</strong>.
      </p>
      <p className="hf-note">
        AMIRA shows what published research reports about women, including whether menopause and
        hormone therapy were <strong>reported</strong>, <strong>not reported</strong>, or{" "}
        <strong>could not be located</strong>. It does not diagnose, prescribe, or recommend treatment.
      </p>
    </aside>
  );
}
