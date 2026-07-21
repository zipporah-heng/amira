/** Segmented arc "Evidence Maturity" meter, matching the approved mockup:
 *  a partial-circle gauge of five rounded segments — first pink, second amber,
 *  the rest pale lavender/grey — with "N / 5" centred and "Women analyzed"
 *  beneath. This is the verified 1–5 maturity level (the only prominent score);
 *  it is not the experimental 0–100 pilot score. */

const CX = 110, CY = 104, R = 80, STROKE = 17;
const START = 212, SWEEP_TOTAL = 244; // degrees; opening at the bottom
const SEG = SWEEP_TOTAL / 5;
const GAP = 7;
// On-colours per segment index; off-segments are pale lavender/grey.
const ON = ["#d6398c", "#e0952a", "#2f8f83", "#2f8f83", "#2f8f83"];
const OFF = "#e7e1f6";

function polar(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}
function arc(fromDeg: number, toDeg: number) {
  const a = polar(fromDeg), b = polar(toDeg);
  const largeArc = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function MaturityMeter({ level, maxLevel = 5, label }: {
  level: number; maxLevel?: number; label: string;
}) {
  const segments = Array.from({ length: 5 }, (_, i) => {
    const from = START - i * SEG;
    const to = from - (SEG - GAP);
    const on = i < level;
    return { d: arc(from, to), color: on ? ON[i] : OFF };
  });
  return (
    <svg className="maturity-meter" viewBox="0 0 220 150" role="img"
         aria-label={`Evidence maturity ${level} of ${maxLevel}: ${label}`}>
      {segments.map((s, i) => (
        <path key={i} d={s.d} stroke={s.color} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      ))}
      <text x={CX} y={CY - 2} textAnchor="middle" className="mm-value">
        {level}<tspan className="mm-den"> / {maxLevel}</tspan>
      </text>
      <text x={CX} y={CY + 26} textAnchor="middle" className="mm-label">{label}</text>
    </svg>
  );
}
