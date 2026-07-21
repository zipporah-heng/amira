import { useEffect, useState } from "react";
import { getAssets, type AssetsResponse } from "../api";

/** Section 11 — Reusable Scientific Assets. Only assets that actually exist (as
 *  reported by the API) are shown. Honest status is displayed verbatim; no open
 *  license is claimed unless a LICENSE file exists. */

const KIND_ICON: Record<string, string> = {
  schema: "🧩", data: "🗂️", prompt: "📝", code: "⚙️", doc: "📄", download: "⬇️",
};

export function ReusableAssets() {
  const [data, setData] = useState<AssetsResponse | null>(null);

  useEffect(() => { getAssets().then(setData).catch(() => setData(null)); }, []);
  if (!data) return null;

  return (
    <section className="card reusable-assets" id="assets" style={{ marginTop: 22 }}>
      <div className="section-title">Reusable Scientific Assets</div>
      <p className="muted" style={{ marginTop: 6, maxWidth: 700 }}>
        The reusable contribution is the schema, prompts, validation, scoring rules and evaluation
        pipeline — not one proprietary model. These are the assets researchers can build on.
      </p>

      <div className="assets-grid">
        {data.assets.map((a) => {
          const href = a.path.startsWith("http") ? a.path
            : a.path.startsWith("/api/") ? a.path
            : `https://github.com/zipporah-heng/amira/blob/video-redesign/${a.path.replace(/\/$/, "")}`;
          return (
            <a className="asset-tile" key={a.key} href={href} target="_blank" rel="noopener noreferrer">
              <div className="asset-tile-ic" aria-hidden>{KIND_ICON[a.kind] || "•"}</div>
              <div className="asset-tile-title">{a.title}</div>
              <div className="asset-tile-path">{a.path}</div>
              {a.status && <span className="asset-tile-status">{a.status.replace(/_/g, " ")}</span>}
            </a>
          );
        })}
      </div>

      <div className="assets-status">
        <div className="section-title">Honest status</div>
        <ul>{data.honest_status.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
    </section>
  );
}
