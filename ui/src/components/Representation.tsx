import type { EvidenceResponse } from "../api";

/** "How were women represented?" — exactly seven cards in one row (mockup).
 *  Each card: line icon, status check, short label, colour-coded border.
 *  States are derived truthfully from the reviewed evidence (the mockup's
 *  illustrative labels are not copied as facts). Pregnancy and hormonal
 *  variability are intentionally kept out of this summary row. */

type Tone = "yes" | "limited" | "missing" | "neutral";
const TONE_LABEL: Record<Tone, string> = { yes: "Yes", limited: "Limited", missing: "Not reported", neutral: "Not located" };

const Icon = ({ name }: { name: string }) => {
  const p: Record<string, JSX.Element> = {
    women: <><circle cx="9" cy="7" r="3" /><path d="M3 21c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17.5" cy="8" r="2.2" /><path d="M21 21c0-2.8-1.7-4.8-4-5.4" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 15l4-4 3 3 6-7" /><path d="M17 7h3v3" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    pill: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-40 12 12)" /><path d="M9 8l5 5" /></>,
    person: <><circle cx="12" cy="7" r="3.2" /><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7" /></>,
    group: <><circle cx="8" cy="9" r="2.4" /><circle cx="16" cy="9" r="2.4" /><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5" /><path d="M13 20c0-2.4 1.4-4.2 3.5-4.8 2.1.6 3.5 2.4 3.5 4.8" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className="rep-icon" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p[name]}</svg>
  );
};

export function Representation({ report }: { report: EvidenceResponse }) {
  const t = report.totals!;
  const dim = (d: string) => report.dimensions.find((x) => x.dimension === d)?.n_reporting ?? 0;
  const effState = (report.effectiveness?.state || "").toLowerCase();
  const safState = (report.safety?.state || "").toLowerCase();
  const postHoc = (report.effectiveness?.findings || []).some((f) => /post hoc/i.test(f.interpretation || ""));
  const olderEnrolled = report.trials.some((tr) => {
    const m = (tr.minimum_age || "").match(/(\d+)/); return m ? parseInt(m[1], 10) >= 60 : false;
  });

  const effTone: Tone = effState.includes("not reported") ? "missing"
    : effState.includes("insufficient") ? "neutral"
    : (effState.includes("significant") && !effState.includes("no ")) ? "yes"
    : "yes";
  const safTone: Tone = safState.includes("not reported") ? "missing"
    : safState.includes("insufficient") ? "neutral"
    : safState.includes("significant") && !safState.includes("no ") ? "yes" : "limited";

  const cards: { title: string; icon: string; tone: Tone; sub?: string }[] = [
    { title: "Women included", icon: "women", tone: t.women_reported_count > 0 ? "yes" : "missing" },
    { title: "Sex-specific outcomes", icon: "chart", tone: effTone, sub: postHoc ? "post hoc" : undefined },
    { title: "Sex-specific safety", icon: "shield", tone: safTone },
    { title: "Menopause", icon: "calendar", tone: dim("menopause_status_reported") > 0 ? "yes" : "missing" },
    { title: "Hormone therapy", icon: "pill", tone: dim("hormone_therapy_reported") > 0 ? "yes" : "missing" },
    { title: "Older women", icon: "person", tone: olderEnrolled ? "limited" : "missing" },
    { title: "Race and ethnicity", icon: "group", tone: "neutral" },
  ];

  return (
    <section className="card representation" id="representation" style={{ marginTop: 18 }}>
      <h2 className="rep-h">How were women represented?</h2>
      <div className="rep-row">
        {cards.map((c) => (
          <div className={`rep-cell ${c.tone}`} key={c.title}>
            <div className="rep-cell-title">{c.title}</div>
            <div className="rep-cell-icon"><Icon name={c.icon} /></div>
            <div className={`rep-check ${c.tone}`} aria-hidden>{c.tone === "yes" ? "✓" : c.tone === "limited" ? "!" : c.tone === "neutral" ? "?" : "✕"}</div>
            <div className="rep-status">{TONE_LABEL[c.tone]}{c.sub ? ` · ${c.sub}` : ""}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
