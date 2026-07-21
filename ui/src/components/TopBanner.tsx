import type { Banner, ContextBlock, Totals } from "../api";

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

function readable(value: string): string {
  if (value === "any" || value === "not_specified") return "Any";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" / ");
}

function reportingCount(context: ContextBlock | undefined, dimension: "life-stage" | "hormone-therapy"): number {
  if (!context) return 0;
  return dimension === "life-stage"
    ? context.trials_reporting_menopausal_status?.length || 0
    : context.trials_reporting_hormone_therapy?.length || 0;
}

function CoverageCell({ label, value, status, detail, tone: cellTone }: {
  label: string;
  value: string;
  status?: string;
  detail: string;
  tone?: "present" | "missing" | "neutral";
}) {
  return (
    <div className={`coverage-cell ${cellTone || "neutral"}`}>
      <div className="coverage-label">{label}</div>
      <div className="coverage-value-row">
        <div className="coverage-value">{value}</div>
        {status && <span className={`coverage-status ${cellTone || "neutral"}`}>{status}</span>}
      </div>
      <div className="coverage-detail">{detail}</div>
    </div>
  );
}

export function TopBanner({ banner, totals, lifeStage, hormoneTherapy, onJump }: {
  banner: Banner;
  totals: Totals;
  lifeStage?: ContextBlock;
  hormoneTherapy?: ContextBlock;
  onJump: (id: string) => void;
}) {
  const lifeStageStudies = reportingCount(lifeStage, "life-stage");
  const hormoneTherapyStudies = reportingCount(hormoneTherapy, "hormone-therapy");
  const lifeStageSpecific = !["not_specified", "any"].includes(lifeStage?.selected || "not_specified");
  const hormoneTherapySpecific = !["not_specified", "any"].includes(hormoneTherapy?.selected || "any");
  const womenCoverageComplete = (totals.trials_without_female_count_or_percentage?.length || 0) === 0;
  const classCount = banner.class_comparison.verified_count;
  const className = banner.class_comparison.drug_class.toLowerCase();

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
          label={`Compare within ${banner.class_comparison.drug_class}`}
          value={banner.class_comparison.this_rank || `${classCount} ${className}${classCount === 1 ? "" : "s"} to review`}
          sub="Evidence depth, not treatment performance"
          onClick={() => onJump("class")}
        />
      </div>

      <div className="coverage-head">
        <span>Selected evidence lens</span>
        <span>Counted is not the same as studied</span>
      </div>
      <div className="coverage-grid">
        <CoverageCell
          label="Women in reviewed evidence"
          value={totals.women_reported_count > 0 ? totals.women_reported_count.toLocaleString() : "Not reported"}
          status={totals.women_reported_count > 0 ? "Reported count" : "Evidence gap"}
          detail={womenCoverageComplete && totals.women_pct_of_participants != null
            ? `${totals.women_pct_of_participants}% of ${totals.participants_total.toLocaleString()} participants`
            : `Exact count reported in ${totals.trials_with_reported_female_count.length} of ${totals.trials} studies; combined percentage unavailable`}
          tone={totals.women_reported_count > 0 ? "present" : "missing"}
        />
        <CoverageCell
          label="Selected life stage"
          value={readable(lifeStage?.selected || "not_specified")}
          status={lifeStageSpecific
            ? (lifeStage?.supported ? "Evidence found" : "Not represented")
            : (lifeStageStudies > 0 ? `Reported in ${lifeStageStudies}` : "Not reported")}
          detail={lifeStageStudies > 0
            ? "Menopausal status is explicitly reported in the reviewed evidence."
            : "AMIRA never infers menopausal status from age."}
          tone={lifeStage?.supported && lifeStageStudies > 0 ? "present" : "missing"}
        />
        <CoverageCell
          label="Hormone therapy"
          value={readable(hormoneTherapy?.selected || "any")}
          status={hormoneTherapySpecific
            ? (hormoneTherapy?.supported ? "Evidence found" : "Not represented")
            : (hormoneTherapyStudies > 0 ? `Reported in ${hormoneTherapyStudies}` : "Not reported")}
          detail={hormoneTherapy?.status === "hormone_therapy_population_not_represented"
            ? "Hormone therapy was reported, but users were excluded from this study."
            : hormoneTherapyStudies > 0
            ? "Hormone therapy criteria are explicitly reported in the reviewed evidence."
            : "No hormone therapy reporting was found in the reviewed evidence."}
          tone={hormoneTherapy?.supported && hormoneTherapyStudies > 0 ? "present" : "missing"}
        />
      </div>

      <div className="why-line">
        <span className="why-k">Why this result</span>
        <p>{banner.why_this_result}</p>
      </div>
    </div>
  );
}
