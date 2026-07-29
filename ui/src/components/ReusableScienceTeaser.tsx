import { Link } from "react-router-dom";

/** A compact pointer to AMIRA's reusable scientific infrastructure.
 *
 *  Deliberately short: it names what exists and links to the Open Benchmark, which is
 *  the home for the full documentation. It claims no validation, no accuracy and no
 *  completed human review — the benchmark's real status is stated on the card. */

const ASSETS = [
  "Open Women's Evidence Schema",
  "Source-linked benchmark scaffold",
  "Reproducible evidence-extraction pipeline",
  "Transparent evaluation methodology",
];

export function ReusableScienceTeaser() {
  return (
    <section className="sci-teaser" aria-labelledby="sci-teaser-h">
      <div className="sci-teaser-main">
        <h2 className="sci-teaser-h" id="sci-teaser-h">Built as reusable scientific infrastructure</h2>
        <ul className="sci-teaser-list">
          {ASSETS.map((a) => (
            <li key={a}><span className="sci-teaser-dot" aria-hidden="true" />{a}</li>
          ))}
        </ul>
        <p className="sci-teaser-status">Benchmark records are pending human review.</p>
      </div>
      <Link className="cmp-btn primary sci-teaser-cta" to="/amira/open-benchmark">
        Explore the Open Benchmark
      </Link>
    </section>
  );
}
