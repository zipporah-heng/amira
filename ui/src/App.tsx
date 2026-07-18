import { useEffect, useState } from "react";
import { checkEvidence, getBenchmark, type EvidenceReport } from "./api";
import { Dashboard } from "./Dashboard";

type Page = "home" | "check" | "research" | "methodology" | "about";

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "check", label: "Check the Evidence", icon: "🔬" },
  { id: "research", label: "How AMIRA Performs", icon: "📊" },
  { id: "methodology", label: "Methodology", icon: "📐" },
  { id: "about", label: "About AMIRA", icon: "💜" },
];

const HERO_DEFAULTS = {
  medicine: "Atorvastatin",
  condition: "Cardiovascular disease",
  life_stage: "postmenopause",
  hormone_therapy: "not_specified",
};

const DEMO_CASES = [
  { ...HERO_DEFAULTS, label: "Atorvastatin — hero (LIMITED)" },
  {
    medicine: "Icosapent ethyl",
    condition: "Cardiovascular disease",
    life_stage: "postmenopause",
    hormone_therapy: "yes",
    label: "Icosapent ethyl + HT — no evidence found",
  },
  {
    medicine: "Conjugated equine estrogens + medroxyprogesterone (menopausal hormone therapy)",
    condition: "Cardiovascular disease",
    life_stage: "postmenopause",
    hormone_therapy: "yes",
    label: "Menopausal hormone therapy — evidence of no effect",
  },
];

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [form, setForm] = useState({ ...HERO_DEFAULTS });
  const [report, setReport] = useState<EvidenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (payload = form) => {
    setLoading(true);
    setError(null);
    try {
      const r = await checkEvidence(payload);
      setReport(r);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const go = (id: Page) => {
    setPage(id);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <div className="mark">A</div>
          <div>
            <div className="name">AMIRA</div>
            <div className="tag">Clearer evidence for women's health</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`navitem ${page === n.id ? "active" : ""}`}
            onClick={() => go(n.id)}
          >
            <span>{n.icon}</span>
            {n.label}
          </button>
        ))}
        <div className="navfoot">
          Every statement links back to a source. If AMIRA cannot find the evidence, it says so.
        </div>
      </nav>

      <main className="main">
        <div className="container">
          {page === "home" && <Home onStart={() => go("check")} onDemo={(c) => { setForm(c); go("check"); run(c); }} />}
          {page === "check" && (
            <CheckPage
              form={form}
              setForm={setForm}
              onSubmit={() => run()}
              loading={loading}
              error={error}
              report={report}
              onDemo={(c) => { setForm(c); run(c); }}
            />
          )}
          {page === "research" && <BenchmarkPage />}
          {page === "methodology" && <MethodologyPage />}
          {page === "about" && <AboutPage />}

          <div className="footer-note">
            Every statement links back to a source. If AMIRA cannot find the evidence, it says so.
            <br />
            AMIRA reviews research evidence. It does not diagnose, prescribe, or recommend treatment.
          </div>
        </div>
      </main>
    </div>
  );
}

function Home({
  onStart,
  onDemo,
}: {
  onStart: () => void;
  onDemo: (c: typeof HERO_DEFAULTS) => void;
}) {
  return (
    <div>
      <span className="safety-line">
        <span>ℹ️</span> AMIRA reviews research evidence. It does not diagnose, prescribe, or
        recommend treatment.
      </span>
      <h1 className="hero-q">Was this medicine actually studied in women like me?</h1>
      <p className="hero-sub">
        AMIRA audits medical research to show whether women were represented — and whether
        sex-specific and hormone-relevant factors were actually analyzed and reported. It measures
        evidence completeness, so you can see what is known and what is missing.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <button className="cta" style={{ marginTop: 0 }} onClick={onStart}>
          Check the evidence →
        </button>
        <button
          className="cta"
          style={{ marginTop: 0, background: "var(--surface-2)", color: "var(--lav-700)", boxShadow: "none", border: "1px solid var(--border-strong)" }}
          onClick={() => onDemo(HERO_DEFAULTS)}
        >
          Run the hero example
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16, marginTop: 40 }}>
        {[
          { t: "Women were included", d: "AMIRA starts by checking whether women were represented at all." },
          { t: "But what was studied?", d: "Representation is not the same as sex-specific or hormone-aware analysis." },
          { t: "Here is what we know", d: "Every finding is backed by a citation you can open and read." },
          { t: "Here is what is missing", d: "Gaps are bounded to the sources reviewed — never presented as a verdict on the drug." },
        ].map((c) => (
          <div className="card" key={c.t}>
            <h3 style={{ fontSize: 16 }}>{c.t}</h3>
            <p style={{ marginTop: 8, fontSize: 14 }}>{c.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckPage({
  form,
  setForm,
  onSubmit,
  loading,
  error,
  report,
  onDemo,
}: {
  form: typeof HERO_DEFAULTS;
  setForm: (f: typeof HERO_DEFAULTS) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  report: EvidenceReport | null;
  onDemo: (c: any) => void;
}) {
  return (
    <div>
      <span className="safety-line">
        <span>ℹ️</span> AMIRA reviews research evidence. It does not diagnose, prescribe, or
        recommend treatment.
      </span>
      <h1 className="hero-q" style={{ fontSize: 26 }}>
        Was this medicine actually studied in women like me?
      </h1>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">Check the evidence</div>
        <div className="form-grid">
          <Field label="Condition">
            <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
              <option>Cardiovascular disease</option>
            </select>
          </Field>
          <Field label="Medicine">
            <select value={form.medicine} onChange={(e) => setForm({ ...form, medicine: e.target.value })}>
              <option>Atorvastatin</option>
              <option>Icosapent ethyl</option>
              <option>Conjugated equine estrogens + medroxyprogesterone (menopausal hormone therapy)</option>
            </select>
          </Field>
          <Field label="Life stage">
            <select value={form.life_stage} onChange={(e) => setForm({ ...form, life_stage: e.target.value })}>
              <option value="premenopause">Premenopause</option>
              <option value="perimenopause">Perimenopause</option>
              <option value="postmenopause">Postmenopause</option>
              <option value="not_specified">Not specified</option>
            </select>
          </Field>
          <Field label="Menopausal hormone therapy">
            <select value={form.hormone_therapy} onChange={(e) => setForm({ ...form, hormone_therapy: e.target.value })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_specified">Not specified</option>
            </select>
          </Field>
        </div>
        <button className="cta" onClick={onSubmit} disabled={loading}>
          {loading ? (
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <span className="spinner" /> Checking…
            </span>
          ) : (
            "CHECK THE EVIDENCE"
          )}
        </button>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Try:</span>
          {DEMO_CASES.map((c) => (
            <button
              key={c.label}
              className="badge demo"
              style={{ border: "1px solid var(--border-strong)", cursor: "pointer" }}
              onClick={() => onDemo(c)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="state-banner no-evidence" style={{ marginTop: 18 }}>
          <span className="sb-ic">⚠️</span>
          <div>
            <h3>AMIRA only reports on evidence it has reviewed</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {report && (
        <div style={{ marginTop: 26 }}>
          <Dashboard report={report} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function BenchmarkPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    getBenchmark().then(setData);
  }, []);

  if (!data) return <p>Loading benchmark…</p>;
  if (data.error)
    return (
      <div>
        <h1 className="hero-q" style={{ fontSize: 26 }}>How AMIRA performs</h1>
        <p>{data.error}</p>
      </div>
    );

  const all = data.splits.all;
  const held = data.splits.heldout;
  const metrics = [
    { lab: "Overall field accuracy", val: pct(all.overall_field_accuracy) },
    { lab: "Macro-F1 (reported fields)", val: all.macro_f1_reported.toFixed(2) },
    { lab: "Citation support", val: pct(all.citation_support_accuracy) },
    { lab: "Abstention accuracy", val: pct(all.abstention_accuracy) },
    { lab: "Numeric extraction", val: pct(all.numeric_accuracy_overall) },
    { lab: "Held-out field accuracy", val: pct(held.overall_field_accuracy) },
  ];

  return (
    <div>
      <h1 className="hero-q" style={{ fontSize: 26 }}>How AMIRA performs</h1>
      <p className="hero-sub">
        {data.note} Backend: <strong>{data.backend}</strong> baseline over {all.n_examples}{" "}
        human-labeled examples (20 development / 10 held-out).
      </p>
      <div className="metric-grid">
        {metrics.map((m) => (
          <div className="metric" key={m.lab}>
            <div className="m-val">{m.val}</div>
            <div className="m-lab">{m.lab}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Per-field accuracy (all examples)</div>
        <table className="bench">
          <thead>
            <tr>
              <th>Field</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(all.per_field_accuracy).map(([k, v]) => (
              <tr key={k}>
                <td>{k.replace(/_/g, " ")}</td>
                <td>{pct(v as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 20 }}>
        This is a <strong>pilot benchmark</strong>. Thirty examples do not prove broad
        generalization — it exists to make AMIRA's extraction quality measurable and reproducible,
        and to give a baseline the live model can be scored against.
      </div>
    </div>
  );
}

function MethodologyPage() {
  return (
    <div className="prose">
      <h1 className="hero-q" style={{ fontSize: 26 }}>Methodology</h1>
      <h2>What AMIRA measures</h2>
      <p>
        AMIRA evaluates <strong>evidence completeness</strong> for a medicine and condition through
        the lens of a woman's life stage and hormonal context. It reports whether women were
        represented and whether sex-specific and hormone-relevant factors were actually analyzed and
        reported — not whether a medicine is safe, effective, better, or worse.
      </p>
      <div className="callout">
        High female representation does not automatically mean complete women-specific or
        hormone-aware evidence. AMIRA is built to show that difference.
      </div>
      <h2>Evidence completeness tiers</h2>
      <ul>
        <li><strong>STRONG (T1)</strong> — multiple strong sources with sex-specific efficacy and safety analysis.</li>
        <li><strong>MODERATE (T2)</strong> — women adequately represented, but sex-specific/hormone analysis is incomplete.</li>
        <li><strong>LIMITED (T3)</strong> — women represented but underrepresented, or subgroup analysis limited.</li>
        <li><strong>INSUFFICIENT (T4)</strong> — women-specific evidence only through observational, label, or post-market sources.</li>
        <li><strong>NO RELEVANT EVIDENCE FOUND (T5)</strong> — no relevant women-specific evidence in the reviewed set.</li>
      </ul>
      <p>Tier rules live in configuration, not UI code, so they can be tuned without rebuilding the product.</p>
      <h2>Two states that are never confused</h2>
      <p>
        <strong>No evidence found</strong> means a search ran and returned nothing relevant — an
        evidence gap. <strong>Evidence of no effect</strong> means a study explicitly tested an
        outcome and reported a null or negative result. These are separate backend states with
        separate messages, by design.
      </p>
      <h2>Extraction &amp; abstention</h2>
      <p>
        Passages are extracted into a versioned schema. The model must abstain — returning
        “not reported” — whenever a passage does not explicitly support a claim, and never infers a
        biological fact from silence. Any affirmative claim without a verifiable in-passage citation
        is downgraded to abstention (fail closed). Numbers are only accepted when explicitly present.
      </p>
      <h2>Honest labeling</h2>
      <p>
        Every value is labeled by provenance — Live source, Verified demo data, AI extracted, or
        Human verified. Seeded demo data is never presented as live.
      </p>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="prose">
      <h1 className="hero-q" style={{ fontSize: 26 }}>About AMIRA</h1>
      <p>
        For decades, women were underrepresented in medical research, and even when they were
        included, sex-specific and hormone-relevant factors often went unreported. That leaves a
        quiet gap: a medicine can look well-studied overall while the evidence about women — and
        about perimenopause and postmenopause specifically — stays thin.
      </p>
      <p>
        AMIRA makes that gap visible. It asks a simple question — “was this medicine actually
        studied in women like me?” — and answers it with citations you can open and read.
      </p>
      <h2>What AMIRA does not do</h2>
      <ul>
        <li>It does not diagnose.</li>
        <li>It does not prescribe or recommend treatment.</li>
        <li>It does not tell you whether a medicine is safe or right for you.</li>
        <li>It does not rank medicines as better, safer, or more effective.</li>
      </ul>
      <div className="callout">
        AMIRA measures evidence coverage, not clinical performance. “Not reported in the sources
        reviewed” never means a medicine does not work or is unsafe.
      </div>
      <h2>Open foundation</h2>
      <p>
        AMIRA ships a versioned evidence schema, a human-labeled pilot benchmark, an extraction
        pipeline, and a reproducible evaluation runner — reusable infrastructure for auditing
        evidence completeness in women's health beyond this demo.
      </p>
    </div>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
