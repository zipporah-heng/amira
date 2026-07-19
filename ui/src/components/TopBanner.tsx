import type { Banner } from "../api";

/** State → visual tone. A confirmed sex difference is highlighted; unclear /
 *  insufficient / not-reported are neutral (never shown as reassuring). */
function tone(state: string): string {
  const s = state.toLowerCase();
  if (s.includes("significant sex") && !s.includes("no ")) return "warn";
  if (s.startsWith("no statistically") || s.startsWith("no significant")) return "ok";
  if (s.includes("trend")) return "trend";
  return "neutral";
}

function BannerCell({ label, value, sub, tone: t, onClick }: {
  label: string; value: string; sub?: string; tone?: string; onClick?: () => void;
}) {
  return (
    <button className={`banner-cell ${t || ""}`} onClick={onClick} type="button">
      <div className="bc-label">{label}</div>
      <div className="bc-value">{value}</div>
      {sub && <div className="bc-sub">{sub}</div>}
    </button>
  );
}

export function TopBanner({ banner, onJump }: { banner: Banner; onJump: (id: string) => void }) {
  return (
    <div className="top-banner">
      <div className="tb-head">
        <div>
          <div className="tb-medicine">{banner.medicine}</div>
          <div className="tb-meta">
            <span><b>Drug class:</b> {banner.drug_class}</span>
            {banner.indication && <span><b>Context:</b> {banner.indication}</span>}
          </div>
        </div>
      </div>

      <div className="banner-grid">
        <BannerCell
          label="Evidence maturity"
          value={banner.maturity.display || `${banner.maturity.level} / ${banner.maturity.max_level}`}
          sub={banner.maturity.scorable === false ? undefined : banner.maturity.label}
          tone={banner.maturity.scorable === false ? "neutral" : "score"}
          onClick={() => onJump("maturity")}
        />
        <BannerCell
          label="Sex-specific effectiveness"
          value={banner.effectiveness.state}
          tone={tone(banner.effectiveness.state)}
          onClick={() => onJump("effectiveness")}
        />
        <BannerCell
          label="Sex-specific side effects"
          value={banner.safety.state}
          tone={tone(banner.safety.state)}
          onClick={() => onJump("safety")}
        />
        <BannerCell
          label={`Class comparison — ${banner.class_comparison.drug_class}`}
          value={banner.class_comparison.this_rank || banner.class_comparison.summary}
          sub={banner.class_comparison.this_rank ? banner.class_comparison.basis : undefined}
          onClick={() => onJump("class")}
        />
      </div>

      <div className="why-line">
        <span className="why-k">Why this result</span>
        <p>{banner.why_this_result}</p>
      </div>
    </div>
  );
}
