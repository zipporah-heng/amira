/**
 * BROWSER DOWNLOAD TEST — the PRODUCTION BUNDLE, in a real browser.
 *
 * jsdom can prove the download path is wired correctly; only a browser can prove a file
 * actually lands on disk. This drives headless Chrome over the DevTools Protocol against
 * the built bundle (ui/dist, served by the FastAPI app), clicks each of the three export
 * controls, and waits for Chrome's own downloadProgress event to report completion.
 *
 * Each downloaded file is then verified: %PDF signature, %%EOF trailer, a real size, and
 * selectable text containing the expected medicine names.
 *
 * Dependency-free: Node's global WebSocket and zlib only — no Playwright/Puppeteer
 * install, so it runs in CI or offline.
 *
 *   node ui/tests/browser-download.mjs [baseUrl] [outDir]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:8141";
const OUT = resolve(process.argv[3] || join(tmpdir(), "amira-downloads"));
const PORT = 9333;
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/* ----------------------------- CDP plumbing ------------------------------ */
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; }
  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new Cdp(ws);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && cdp.pending.has(msg.id)) {
        const { res, rej } = cdp.pending.get(msg.id);
        cdp.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) {
        for (const l of cdp.listeners) l(msg);
      }
    };
    return cdp;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
}

/* --------------------------- PDF verification ---------------------------- */
/** Recover drawn text from a PDF's content streams (hex and literal Tj operands). */
function pdfText(buf) {
  const latin1 = buf.toString("latin1");
  const chunks = [];
  const re = /stream\r?\n?([\s\S]*?)endstream/g;
  let m;
  while ((m = re.exec(latin1)) !== null) {
    const raw = Buffer.from(m[1], "latin1");
    let body = raw;
    try { body = inflateSync(raw); } catch { /* uncompressed or not a text stream */ }
    chunks.push(body.toString("latin1"));
  }
  const out = [];
  for (const c of chunks) {
    for (const t of c.matchAll(/(?:<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^()\\])*)\))\s*Tj/g)) {
      if (t[1] !== undefined) {
        const hex = t[1].replace(/\s+/g, "");
        let s = "";
        for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        out.push(s);
      } else out.push((t[2] || "").replace(/\\([()\\])/g, "$1"));
    }
  }
  return out.join(" ").replace(/\s+/g, " ");
}

function verifyPdf(path, mustContain) {
  const buf = readFileSync(path);
  const head = buf.subarray(0, 5).toString("latin1");
  const tail = buf.subarray(-1024).toString("latin1");
  const text = pdfText(buf);
  const missing = mustContain.filter((s) => !text.includes(s));
  return {
    path, bytes: statSync(path).size, signature: head, endsWithEof: tail.includes("%%EOF"),
    selectableTextChars: text.length, missing,
    ok: head === "%PDF-" && tail.includes("%%EOF") && buf.length > 1000 && text.length > 200 && missing.length === 0,
  };
}

/* ------------------------------- the runs -------------------------------- */
const FLOWS = [
  {
    name: "Check Evidence → Export PDF",
    url: `${BASE}/amira/check-evidence?medicine=Digoxin&healthArea=Cardiovascular&condition=Heart%20failure&drugClass=Cardiac%20glycoside&lifeStage=not_specified`,
    click: "document.querySelector('.ev-export-btn').click()",
    ready: "!!document.querySelector('.ev-export-btn')",
    expect: ["Digoxin", "Women included", "Limitations"],
  },
  {
    name: "Compare Evidence → Export Comparison PDF",
    url: `${BASE}/amira/compare-evidence?healthArea=Cardiovascular&condition=Heart%20failure&medicine=Digoxin`,
    ready: "[...document.querySelectorAll('button')].some(b => /Export Comparison PDF/i.test(b.textContent))",
    click: "[...document.querySelectorAll('button')].find(b => /Export Comparison PDF/i.test(b.textContent)).click()",
    expect: ["Evidence comparison", "Digoxin", "Aligned evidence comparison"],
  },
  {
    name: "Compare Evidence → individual Evidence Brief PDF",
    url: `${BASE}/amira/compare-evidence?healthArea=Cardiovascular&condition=Heart%20failure&medicine=Digoxin`,
    ready: "[...document.querySelectorAll('button')].some(b => /Export Evidence Brief PDF/i.test(b.textContent))",
    click: "[...document.querySelectorAll('button')].find(b => /Export Evidence Brief PDF/i.test(b.textContent)).click()",
    expect: ["Evidence brief", "Digoxin"],
  },
];

async function main() {
  if (!CHROME) throw new Error("No Chrome/Chromium binary found");
  // A reachable server serving the PRODUCTION bundle is a precondition.
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  log(`server ${BASE} · dataset ${health.dataset_version || "?"}`);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const profile = join(tmpdir(), `amira-cdp-${process.pid}`);
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--window-size=1440,1200",
  ], { stdio: "ignore" });

  let version;
  for (let i = 0; i < 40 && !version; i++) {
    try { version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()); }
    catch { await sleep(250); }
  }
  if (!version) throw new Error("Chrome did not expose a DevTools endpoint");

  const cdp = await Cdp.open(version.webSocketDebuggerUrl);
  const results = [];
  try {
    for (const [i, flow] of FLOWS.entries()) {
      // One directory per flow: two flows legitimately produce the same filename, and
      // an overwrite would look like a missing download.
      const dir = join(OUT, `flow-${i + 1}`);
      mkdirSync(dir, { recursive: true });
      await cdp.send("Browser.setDownloadBehavior", {
        behavior: "allow", downloadPath: dir, eventsEnabled: true,
      });
      const before = new Set(readdirSync(dir));
      const completed = [];
      const off = cdp.on((msg) => {
        if (msg.method === "Browser.downloadProgress" && msg.params.state === "completed") completed.push(msg.params);
        if (msg.method === "Browser.downloadWillBegin") log(`   downloadWillBegin: ${msg.params.suggestedFilename}`);
      });

      const { targetId } = await cdp.send("Target.createTarget", { url: flow.url });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Runtime.enable", {}, sessionId);

      // Wait for the export control to exist (data loaded, React rendered).
      let ready = false;
      for (let i = 0; i < 60 && !ready; i++) {
        const r = await cdp.send("Runtime.evaluate", { expression: flow.ready, returnByValue: true }, sessionId);
        ready = r.result?.value === true;
        if (!ready) await sleep(500);
      }
      if (!ready) throw new Error(`${flow.name}: export control never appeared`);

      const clicked = await cdp.send("Runtime.evaluate",
        { expression: flow.click, awaitPromise: true, returnByValue: true }, sessionId);
      if (clicked.exceptionDetails) throw new Error(`${flow.name}: click threw ${JSON.stringify(clicked.exceptionDetails)}`);

      // Wait for Chrome's own download-completed event, then for the file to settle.
      for (let i = 0; i < 60 && completed.length === 0; i++) await sleep(500);
      const added = readdirSync(dir).filter((f) => !before.has(f) && !f.endsWith(".crdownload"));
      off();
      await cdp.send("Target.closeTarget", { targetId });

      if (completed.length === 0 || added.length === 0) {
        results.push({ flow: flow.name, downloadEvent: completed.length > 0, file: null, ok: false });
        continue;
      }
      const check = verifyPdf(join(dir, added[0]), flow.expect);
      results.push({ flow: flow.name, downloadEvent: true, file: added[0], ...check });
    }
  } finally {
    chrome.kill();
    // Windows keeps the profile locked for a moment after the process exits; a failed
    // cleanup must never mask the download results.
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* temp dir, ignore */ }
  }

  log("\nBROWSER DOWNLOAD RESULTS");
  for (const r of results) {
    log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.flow}`);
    log(`        file=${r.file} bytes=${r.bytes} signature=${r.signature} eof=${r.endsWithEof} text=${r.selectableTextChars} missing=${JSON.stringify(r.missing || [])}`);
  }
  const failed = results.filter((r) => !r.ok);
  log(`\n${results.length - failed.length}/${results.length} export paths downloaded a valid PDF`);
  log(`files kept in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error("ERROR", e); process.exit(1); });
