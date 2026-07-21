/** Provenance badges. AMIRA never labels unverified data as human-verified. */

export function SourceVerifiedBadge({ label = "Source verified" }: { label?: string }) {
  return (
    <span className="badge verified" title="Value matched against the retrieved primary source">
      <span className="dot" /> {label}
    </span>
  );
}

export function HumanReviewBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="badge verified"><span className="dot" /> Human verified</span>
  ) : (
    <span className="badge demo" title="Awaiting named human sign-off">
      <span className="dot" /> Human review pending
    </span>
  );
}

export function BasisBadge({ basis }: { basis: string }) {
  const map: Record<string, { cls: string; label: string; title: string }> = {
    reported: { cls: "verified", label: "Reported", title: "Stated verbatim in the cited source" },
    derived: { cls: "demo", label: "Derived", title: "Computed by AMIRA from reported values" },
    not_reported: { cls: "asset", label: "Not reported", title: "A source was reviewed and reports none" },
    not_located: { cls: "asset", label: "Not located", title: "No accessible source with this value was retrieved" },
  };
  const m = map[basis] || { cls: "asset", label: basis, title: "" };
  return (
    <span className={`badge ${m.cls}`} title={m.title}>
      <span className="dot" /> {m.label}
    </span>
  );
}

export function AssetBadge({ label = "Reusable scientific asset" }: { label?: string }) {
  return (
    <span className="badge asset">
      <span className="dot" /> {label}
    </span>
  );
}

export function DatasetStamp({
  version, cutoff, commit,
}: { version: string; cutoff: string; commit: string }) {
  return (
    <span className="badge asset" title="Dataset version - source cutoff - commit">
      <span className="dot" /> v{version} · cutoff {cutoff} · {commit.slice(0, 7)}
    </span>
  );
}
