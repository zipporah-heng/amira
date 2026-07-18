export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <span className="badge demo" title="Deterministic sample data — not verified clinical evidence">
      <span className="dot" /> {label}
    </span>
  );
}

export function VerifiedBadge({ label = "Verified data" }: { label?: string }) {
  return (
    <span className="badge verified">
      <span className="dot" /> {label}
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
