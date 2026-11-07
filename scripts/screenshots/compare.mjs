#!/usr/bin/env node
// Confronta due cartelle di screenshot (prima/dopo) pixel per pixel, usando il browser di Playwright.
// Uso: node scripts/screenshots/compare.mjs <cartella-prima> <cartella-dopo> [--out=cartella-diff] [--soglia=0.1]
// Per ogni immagine riporta la % di pixel diversi e salva un'immagine "diff" (rosso = diverso).
// Esce con codice 1 se almeno una schermata supera la soglia (in %).
import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const [before, after] = args.filter((a) => !a.startsWith("--"));
const opt = (n, f) => (args.find((a) => a.startsWith(`--${n}=`)) || `=${f}`).split("=").slice(1).join("=");
const OUT = opt("out", "test-results/screenshots/diff");
const THRESHOLD = Number(opt("soglia", "0.1"));
if (!before || !after) {
  console.error("Uso: node scripts/screenshots/compare.mjs <prima> <dopo> [--out=diff] [--soglia=0.1]");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const names = [...new Set([...readdirSync(before), ...readdirSync(after)])].filter((f) => f.endsWith(".png")).sort();
const rows = [];
for (const name of names) {
  const a = join(before, name);
  const b = join(after, name);
  if (!existsSync(a) || !existsSync(b)) {
    rows.push({ name, status: existsSync(a) ? "manca dopo" : "nuova", percent: null });
    continue;
  }
  const result = await page.evaluate(
    async ([da, db]) => {
      const load = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const ctx = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const pa = ctx(ia), pb = ctx(ib);
      const out = new OffscreenCanvas(w, h); const ox = out.getContext("2d"); const od = ox.createImageData(w, h);
      let diff = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) + Math.abs(pa[i + 3] - pb[i + 3]);
        if (d > 24) { diff += 1; od.data.set([255, 0, 0, 255], i); }
        else { const g = (pb[i] + pb[i + 1] + pb[i + 2]) / 3; od.data.set([g, g, g, 70], i); }
      }
      ox.putImageData(od, 0, 0);
      const blob = await out.convertToBlob({ type: "image/png" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = ""; for (const x of bytes) bin += String.fromCharCode(x);
      return { percent: (diff / (w * h)) * 100, sizeChanged: ia.width !== ib.width || ia.height !== ib.height, png: btoa(bin) };
    },
    [`data:image/png;base64,${readFileSync(a).toString("base64")}`, `data:image/png;base64,${readFileSync(b).toString("base64")}`],
  );
  if (result.percent > 0) writeFileSync(join(OUT, name), Buffer.from(result.png, "base64"));
  rows.push({ name, status: result.percent > THRESHOLD || result.sizeChanged ? "CAMBIATA" : "uguale", percent: result.percent });
}
await browser.close();

for (const r of rows) console.log(`${r.status.padEnd(10)} ${r.percent == null ? "   -   " : `${r.percent.toFixed(3)}%`.padStart(8)}  ${r.name}`);
writeFileSync(join(OUT, "summary.json"), JSON.stringify(rows, null, 2));
const changed = rows.filter((r) => r.status !== "uguale");
console.log(`\n${changed.length} schermate diverse su ${rows.length}. Immagini diff in ${OUT}`);
process.exit(changed.length ? 1 : 0);
