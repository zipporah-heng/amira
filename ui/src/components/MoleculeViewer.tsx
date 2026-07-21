import { useEffect, useRef, useState } from "react";

/** Dependency-free interactive molecular structure viewer (2D canvas, no external
 *  3D library — the component itself is lazy-loaded so it never blocks evidence
 *  content). Renders the REAL PubChem structure for the selected medicine:
 *   - drag to rotate, wheel/pinch to zoom
 *   - slow auto-rotation, paused while the user interacts
 *   - honours prefers-reduced-motion
 *   - static fallback if the structure or canvas is unavailable
 *  Coordinates are never invented; a planar (2D) PubChem record is rendered as-is
 *  and labelled as such. */

interface MoleculeMeta {
  cid: number; file: string; record_type: string; atoms: number;
  source: string; source_url: string;
}
type Manifest = Record<string, MoleculeMeta>;

interface Atom { x: number; y: number; z: number; el: string; }
interface Bond { a: number; b: number; order: number; }

const CPK: Record<string, string> = {
  C: "#c7b8f0", O: "#ff6b6b", N: "#5b8def", H: "#e8e2fb", S: "#f2c94c",
  P: "#f2994a", Cl: "#2fd6a6", F: "#2fd6a6", Br: "#c0743a", default: "#9aa0b5",
};

function parseSdf(text: string): { atoms: Atom[]; bonds: Bond[] } {
  const lines = text.split(/\r?\n/);
  const counts = lines[3] || "";
  const nA = parseInt(counts.slice(0, 3), 10);
  const nB = parseInt(counts.slice(3, 6), 10);
  const atoms: Atom[] = [];
  for (let i = 0; i < nA; i++) {
    const l = lines[4 + i];
    atoms.push({
      x: parseFloat(l.slice(0, 10)), y: parseFloat(l.slice(10, 20)), z: parseFloat(l.slice(20, 30)),
      el: l.slice(31, 34).trim(),
    });
  }
  const bonds: Bond[] = [];
  for (let i = 0; i < nB; i++) {
    const l = lines[4 + nA + i];
    bonds.push({ a: parseInt(l.slice(0, 3), 10) - 1, b: parseInt(l.slice(3, 6), 10) - 1, order: parseInt(l.slice(6, 9), 10) || 1 });
  }
  return { atoms, bonds };
}

export function MoleculeViewer({ medicine }: { medicine: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [meta, setMeta] = useState<MoleculeMeta | null>(null);
  const [error, setError] = useState(false);
  const mol = useRef<{ atoms: Atom[]; bonds: Bond[] } | null>(null);
  const rot = useRef({ x: -0.35, y: 0.4 });
  const zoom = useRef(1);
  const dragging = useRef(false);
  const auto = useRef(true);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    setError(false); mol.current = null; setMeta(null);
    fetch("/molecules/index.json")
      .then((r) => r.json())
      .then((mfst: Manifest) => {
        const m = mfst[medicine];
        if (!m) throw new Error("no structure for medicine");
        if (cancelled) return;
        setMeta(m);
        return fetch(`/molecules/${m.file}`).then((r) => r.text()).then((sdf) => {
          if (cancelled) return;
          mol.current = parseSdf(sdf);
        });
      })
      .catch(() => !cancelled && setError(true));
    return () => { cancelled = true; };
  }, [medicine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setError(true); return; }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) auto.current = false;
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const m = mol.current;
      if (!m) { raf = requestAnimationFrame(draw); return; }
      if (auto.current && !dragging.current) rot.current.y += 0.006;

      const cx = Math.cos(rot.current.x), sx = Math.sin(rot.current.x);
      const cy = Math.cos(rot.current.y), sy = Math.sin(rot.current.y);
      // centre + scale
      const xs = m.atoms.map((a) => a.x), ys = m.atoms.map((a) => a.y), zs = m.atoms.map((a) => a.z);
      const mid = (arr: number[]) => (Math.min(...arr) + Math.max(...arr)) / 2;
      const mcx = mid(xs), mcy = mid(ys), mcz = mid(zs);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
      const scale = (Math.min(W, H) * 0.42 * zoom.current) / span;

      const proj = (a: Atom) => {
        let x = a.x - mcx, y = a.y - mcy, z = a.z - mcz;
        // rotate about Y then X
        let x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        let y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        return { px: W / 2 + x1 * scale, py: H / 2 - y1 * scale, pz: z2 };
      };
      const pts = m.atoms.map(proj);

      // bonds
      ctx.lineWidth = 3; ctx.lineCap = "round";
      for (const b of m.bonds) {
        const p1 = pts[b.a], p2 = pts[b.b];
        if (!p1 || !p2) continue;
        const depth = (p1.pz + p2.pz) / 2;
        ctx.strokeStyle = `rgba(180,170,225,${0.35 + 0.4 * norm(depth, pts)})`;
        ctx.beginPath(); ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py); ctx.stroke();
      }
      // atoms (painter's order back-to-front)
      const order = m.atoms.map((_, i) => i).sort((i, j) => pts[i].pz - pts[j].pz);
      for (const i of order) {
        const p = pts[i]; const el = m.atoms[i].el;
        if (el === "H") continue; // hide hydrogens for clarity
        const r = (el === "O" || el === "N" ? 5.5 : 5) * (0.7 + 0.5 * norm(p.pz, pts));
        ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        ctx.fillStyle = CPK[el] || CPK.default; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const norm = (z: number, pts: { pz: number }[]) => {
      const zs = pts.map((p) => p.pz); const lo = Math.min(...zs), hi = Math.max(...zs);
      return hi === lo ? 0.5 : (z - lo) / (hi - lo);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [meta]);

  // interactions
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true; auto.current = false;
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    rot.current.y += (e.clientX - last.current.x) * 0.01;
    rot.current.x += (e.clientY - last.current.y) * 0.01;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => { dragging.current = false; };
  const onWheel = (e: React.WheelEvent) => {
    auto.current = false;
    zoom.current = Math.min(3, Math.max(0.5, zoom.current - e.deltaY * 0.001));
  };

  if (error) {
    return (
      <div className="mol-panel mol-fallback" role="img" aria-label={`Molecular structure of ${medicine} unavailable`}>
        <div className="mol-fallback-ic" aria-hidden>⬡</div>
        <div className="mol-fallback-txt">Molecular structure preview unavailable.<br />See the source for {medicine}.</div>
      </div>
    );
  }

  return (
    <figure className="mol-panel" aria-label={`Interactive molecular structure of ${medicine}.`}>
      <canvas
        ref={canvasRef}
        className="mol-canvas"
        role="img"
        aria-label={`Interactive molecular structure of ${medicine}.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      />
      <figcaption className="mol-cap">
        <div>
          {meta ? `${meta.record_type.toUpperCase()} structure · PubChem CID ${meta.cid}` : "Loading structure…"}
        </div>
        <div className="mol-note">Drag to rotate · scroll to zoom. Molecular visualization for identification and education; not evidence of clinical performance.</div>
        {meta && <a href={meta.source_url} target="_blank" rel="noopener noreferrer" className="src-link">PubChem source ↗</a>}
      </figcaption>
    </figure>
  );
}

export default MoleculeViewer;
