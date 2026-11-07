#!/usr/bin/env node
// Toglie dai file CSS le regole "battute" trovate da capture.mjs --rule-effect=<file>: regole che, tolte tutte
// insieme, non cambiano lo stile calcolato di nessun elemento in nessuna schermata visitata.
// Uso: node scripts/css/remove-overridden-css.mjs --effect=<file.json> [--exclude=a.css,b.css] [--only=a.css] [--dry-run]
// Dopo averlo usato: confronto dello stile calcolato (compare-styles.mjs), screenshot, npm test, prove nel browser.
import { readFileSync, writeFileSync } from "node:fs";
import { parseCss } from "./css-parse.mjs";

const args = process.argv.slice(2);
const opt = (n, f = "") => (args.find((a) => a.startsWith(`--${n}=`)) || `=${f}`).split("=").slice(1).join("=");
const EFFECT = opt("effect");
const EXCLUDE = new Set(opt("exclude").split(",").filter(Boolean));
const ONLY = new Set(opt("only").split(",").filter(Boolean));
const DRY = args.includes("--dry-run");
if (!EFFECT) {
  console.error("Uso: node scripts/css/remove-overridden-css.mjs --effect=<file.json> [--exclude=..] [--only=..] [--dry-run]");
  process.exit(2);
}

// Stessa normalizzazione del rapporto: il browser riscrive spazi, virgolette, media query e :nth-child(odd).
const norm = (x) => String(x || "").toLowerCase().replace(/['"]/g, "")
  .replace(/::?(before|after|first-line|first-letter)/g, "::$1")
  .replace(/\(\s*odd\s*\)/g, "(2n+1)").replace(/\(\s*even\s*\)/g, "(2n)")
  .replace(/\s+/g, " ").replace(/\s*([>+~,()=:])\s*/g, "$1").trim();
const normMedia = (x) => String(x || "").toLowerCase().replace(/\s+/g, "");

// Chiavi del browser: file|media|selettore|n  ->  normalizzate.
const effect = JSON.parse(readFileSync(EFFECT, "utf8"));
const target = new Set();
for (const key of effect.battute) {
  const parts = key.split("|");
  const n = parts.pop();
  const file = parts.shift();
  const selector = parts.pop();
  const media = parts.join("|");
  target.add(`${file}|${normMedia(media)}|${norm(selector)}|${n}`);
}
const files = [...new Set(effect.battute.map((k) => k.split("|")[0]))]
  .filter((f) => f.endsWith(".css") && !EXCLUDE.has(f) && (!ONLY.size || ONLY.has(f))).sort();

let total = { rules: 0, lines: 0, important: 0 };
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const counts = new Map();
  const picked = [];
  for (const r of parseCss(text)) {
    const base = `${file}|${normMedia(r.media)}|${norm(r.selector)}`;
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    if (target.has(`${base}|${n}`)) picked.push(r);
  }
  let out = text;
  let important = 0;
  for (const r of [...picked].sort((a, b) => b.start - a.start)) {
    let start = r.start;
    let end = r.end;
    const lineStart = out.lastIndexOf("\n", start - 1) + 1;
    const nl = out.indexOf("\n", end);
    const lineEnd = nl === -1 ? out.length : nl + 1;
    if (/^\s*$/.test(out.slice(lineStart, start)) && /^\s*$/.test(out.slice(end, lineEnd))) {
      start = lineStart;
      end = lineEnd;
    } else while (out[end] === " ") end += 1;
    important += r.important;
    out = out.slice(0, start) + out.slice(end);
  }
  let before;
  do {
    before = out;
    out = out.replace(/^[ \t]*@(media|supports)[^{;]*\{\s*\}[ \t]*\n?/gm, "");
  } while (out !== before);
  const lines = text.split("\n").length - out.split("\n").length;
  console.log(`${file}: ${picked.length} regole, ${lines} righe, ${important} !important`);
  total = { rules: total.rules + picked.length, lines: total.lines + lines, important: total.important + important };
  if (!DRY) writeFileSync(file, out);
}
console.log(`\nTotale: ${total.rules} regole su ${effect.battute.length} battute misurate, ${total.lines} righe, ${total.important} !important${DRY ? " (prova)" : ""}`);
