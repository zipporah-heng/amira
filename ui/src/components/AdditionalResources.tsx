export function AdditionalResources() {
  return (
    <section id="resources" className="card">
      <div className="section-title">Additional clinical resources</div>
      <p className="muted" style={{ marginTop: 4 }}>
        Pregnancy and breastfeeding are not core AMIRA scoring dimensions. Phase 3 trials rarely
        include them; relevant evidence usually comes from exposure registries, observational and
        post-marketing studies — clearly a different evidence type from Phase 3 RCTs.
      </p>
      <div className="resource-grid">
        <a className="resource-card" href="https://mothertobaby.org/fact-sheets/" target="_blank" rel="noopener noreferrer">
          <span className="rc-title">Pregnancy</span>
          <span className="rc-sub">MotherToBaby fact sheets (specialist teratogen information) ↗</span>
        </a>
        <a className="resource-card" href="https://www.ncbi.nlm.nih.gov/books/NBK501922/" target="_blank" rel="noopener noreferrer">
          <span className="rc-title">Breastfeeding</span>
          <span className="rc-sub">LactMed — Drugs and Lactation Database (NIH) ↗</span>
        </a>
      </div>
      <p className="disclaimer" style={{ marginTop: 10 }}>
        AMIRA links to established specialist resources rather than replacing them. A medicine's
        evidence maturity is never lowered solely because pregnancy trial evidence is absent.
      </p>
    </section>
  );
}
