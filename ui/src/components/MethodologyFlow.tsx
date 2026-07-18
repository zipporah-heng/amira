const STEPS = [
  { t: "Collect research sources", d: "Trials, articles, and labels are gathered for a medicine and condition." },
  { t: "AI extracts structured evidence", d: "A model reads each source and fills the AMIRA schema, abstaining when a source is silent." },
  { t: "Schema validation", d: "Every extracted record is validated and fails closed if malformed — free text never populates trusted fields." },
  { t: "Human-labeled benchmark checks AI accuracy", d: "A held-out, human-labeled benchmark measures how accurately the AI extracts women's hormonal evidence." },
  { t: "AMIRA displays evidence and missing information", d: "Findings and gaps are shown, always bounded to the sources reviewed, with a link back to each source." },
  { t: "Researchers download the open dataset and benchmark", d: "The standardized dataset, schema, and benchmark are downloadable to extend and reuse." },
];

export function MethodologyFlow() {
  return (
    <div className="flow">
      {STEPS.map((s, i) => (
        <div className="flow-step" key={s.t}>
          <div className="step-n">{i + 1}</div>
          <div>
            <h4>{s.t}</h4>
            <p>{s.d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
