/** The hormonal-health focus statement, shown near the top of the app and the
 *  Methodology page (identical wording lives in the README). It states AMIRA's
 *  specific problem and its guardrails: the Digoxin finding is sex-specific, not
 *  menopause-specific, and AMIRA never reinterprets it as hormonal evidence. */
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
        The Digoxin mortality finding is <strong>sex-specific, not menopause-specific</strong> — AMIRA
        does not reinterpret it as hormonal evidence. AMIRA identifies whether menopause and hormone
        therapy information was reported, not reported, or not located, and does not provide treatment
        recommendations.
      </p>
    </aside>
  );
}
