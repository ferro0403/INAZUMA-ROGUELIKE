#!/usr/bin/env node
// Toglie dal testo dei file CSS i `!important` risultati inutili (capture.mjs --important-effect=<file>).
// Uso: node scripts/css/remove-useless-important.mjs --effect=<file.json> [--exclude=a.css] [--only=a.css] [--dry-run]
// Una dichiarazione "prop: valore !important" perde il `!important` solo se TUTTE le proprieta' in cui il browser
// la scompone (es. margin -> margin-top/right/bottom/left) sono risultate inutili in quella regola.
// Dopo: confronto dello stile calcolato, screenshot, npm test, prove nel browser.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { parseCss } from "./css-parse.mjs";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n, f = "") => (args.find((a) => a.startsWith(`--${n}=`)) || `=${f}`).split("=").slice(1).join("=");
const EFFECT = opt("effect");
const EXCLUDE = new Set(opt("exclude").split(",").filter(Boolean));
const ONLY = new Set(opt("only").split(",").filter(Boolean));
const DRY = args.includes("--dry-run");
if (!EFFECT) {
  console.error("Uso: node scripts/css/remove-useless-important.mjs --effect=<file.json> [--exclude=..] [--only=..] [--dry-run]");
  process.exit(2);
}
const norm = (x) => String(x || "").toLowerCase().replace(/['"]/g, "")
  .replace(/::?(before|after|first-line|first-letter)/g, "::$1")
  .replace(/\(\s*odd\s*\)/g, "(2n+1)").replace(/\(\s*even\s*\)/g, "(2n)")
  .replace(/\s+/g, " ").replace(/\s*([>+~,()=:])\s*/g, "$1").trim();
const normMedia = (x) => String(x || "").toLowerCase().replace(/\s+/g, "");

// Inutili per regola: "file|media|selettore|n" normalizzato -> insieme di proprieta'.
const effect = JSON.parse(readFileSync(EFFECT, "utf8"));
const useless = new Map();
for (const key of effect.inutili) {
  const [ruleKey, prop] = key.split("::");
  const parts = ruleKey.split("|");
  const n = parts.pop();
  const file = parts.shift();
  const selector = parts.pop();
  const media = parts.join("|");
  const k = `${file}|${normMedia(media)}|${norm(selector)}|${n}`;
  if (!useless.has(k)) useless.set(k, new Set());
  useless.get(k).add(prop);
}

// Dichiarazioni di un corpo di regola, con posizione (separate da ";" fuori da parentesi e stringhe).
function declarations(body) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i <= body.length; i += 1) {
    const c = body[i];
    if (quote) { if (c === "\\") i += 1; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if ((c === ";" || i === body.length) && depth === 0) {
      const text = body.slice(start, i);
      const m = text.match(/^\s*(--[\w-]+|[a-zA-Z-]+)\s*:/);
      if (m) out.push({ prop: m[1].toLowerCase(), start, end: i, text });
      start = i + 1;
    }
  }
  return out;
}

// Proprieta' "lunghe" di ogni proprieta' usata, chieste al browser.
const files = [...new Set(effect.inutili.map((k) => k.split("|")[0]))]
  .filter((f) => f.endsWith(".css") && !EXCLUDE.has(f) && (!ONLY.size || ONLY.has(f))).sort();
const props = new Set();
for (const f of files) for (const r of parseCss(readFileSync(f, "utf8"))) {
  for (const d of declarations(readFileSync(f, "utf8").slice(r.start, r.end))) props.add(d.prop);
}
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const longhands = await page.evaluate((list) => Object.fromEntries(list.map((p) => {
  if (p.startsWith("--")) return [p, [p]];
  const el = document.createElement("div");
  el.style.setProperty(p, "inherit");
  const out = [];
  for (let i = 0; i < el.style.length; i += 1) out.push(el.style[i]);
  return [p, out.length ? out : [p]];
})), [...props]);
await browser.close();

let total = 0;
let protectedCount = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const counts = new Map();
  const edits = []; // [inizio, fine] dei "!important" da togliere
  for (const r of parseCss(text)) {
    const base = `${file}|${normMedia(r.media)}|${norm(r.selector)}`;
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    const set = useless.get(`${base}|${n}`);
    if (!set) continue;
    const open = text.indexOf("{", r.start);
    const body = text.slice(open + 1, r.end - 1);
    const decls = declarations(body);
    for (const [index, d] of decls.entries()) {
      const m = d.text.match(/\s*!\s*important\s*$/i);
      if (!m) continue;
      const hands = longhands[d.prop] || [d.prop];
      if (!hands.every((h) => set.has(h))) continue;
      // Protezione (4 nov 2026): se piu' avanti nella stessa regola c'e' una dichiarazione NORMALE che tocca una
      // delle stesse proprieta', oggi perde contro questo !important e il browser la scarta (quindi la misura non
      // la vede); togliendo !important vincerebbe lei. Esempio: "background-image:x!important; background:#123".
      const laterNormal = decls.slice(index + 1).some((e) => !/!\s*important\s*$/i.test(e.text)
        && (longhands[e.prop] || [e.prop]).some((h) => hands.includes(h)));
      if (laterNormal) { protectedCount += 1; continue; }
      const absEnd = open + 1 + d.end;
      edits.push([absEnd - m[0].length, absEnd]);
    }
  }
  let out = text;
  for (const [s, e] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + out.slice(e);
  console.log(`${file}: ${edits.length} !important tolti`);
  total += edits.length;
  if (!DRY) writeFileSync(file, out);
}
console.log(`\nTotale: ${total} !important tolti${DRY ? " (prova)" : ""}; ${protectedCount} lasciati perche' seguiti da una dichiarazione normale sulla stessa proprieta'`);
