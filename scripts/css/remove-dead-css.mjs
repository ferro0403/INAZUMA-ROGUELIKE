#!/usr/bin/env node
// Toglie dai file CSS le regole classificate "morta-certa" da `npm run css:usage`.
// Uso: node scripts/css/remove-dead-css.mjs [--report=test-results/css-usage/report.json]
//        [--exclude=css/rtg-halloween-event.css,css/rtg-coaches.css] [--dry-run]
// Una regola e' "morta-certa" se in ogni suo selettore c'e' una classe o un id che non esiste in nessun file js/
// ne' in index.html. Lo script toglie solo quelle, poi i blocchi @media/@supports rimasti vuoti.
// Dopo averlo usato: screenshot di confronto, npm test e npm run test:browser.
import { readFileSync, writeFileSync } from "node:fs";
import { parseCss } from "./css-parse.mjs";

const args = process.argv.slice(2);
const opt = (n, f) => (args.find((a) => a.startsWith(`--${n}=`)) || `=${f}`).split("=").slice(1).join("=");
const REPORT = opt("report", "test-results/css-usage/report.json");
const EXCLUDE = new Set(opt("exclude", "").split(",").filter(Boolean));
const DRY = args.includes("--dry-run");

const report = JSON.parse(readFileSync(REPORT, "utf8"));
const key = (file, line, selector) => `${file}:${line}:${selector.replace(/\s+/g, " ")}`;
const dead = new Set(report.rules.filter((r) => r.status === "morta-certa").map((r) => key(r.file, r.line, r.selector)));

const summary = [];
for (const file of [...new Set(report.rules.filter((r) => r.status === "morta-certa").map((r) => r.file))].sort()) {
  if (EXCLUDE.has(file)) {
    summary.push({ file, removed: 0, note: "escluso" });
    continue;
  }
  const text = readFileSync(file, "utf8");
  const rules = parseCss(text).filter((r) => dead.has(key(file, r.line, r.selector)));
  let out = text;
  let important = 0;
  // Dalla fine all'inizio, cosi' le posizioni delle regole precedenti restano valide.
  for (const r of [...rules].sort((a, b) => b.start - a.start)) {
    let start = r.start;
    let end = r.end;
    const lineStart = out.lastIndexOf("\n", start - 1) + 1;
    const nextNewline = out.indexOf("\n", end);
    const lineEnd = nextNewline === -1 ? out.length : nextNewline + 1;
    // Se la regola occupa righe intere, toglie anche gli a capo (niente righe vuote rimaste).
    if (/^\s*$/.test(out.slice(lineStart, start)) && /^\s*$/.test(out.slice(end, lineEnd))) {
      start = lineStart;
      end = lineEnd;
    } else {
      while (out[end] === " ") end += 1;
    }
    important += r.important;
    out = out.slice(0, start) + out.slice(end);
  }
  // Blocchi @media / @supports rimasti vuoti.
  let before;
  do {
    before = out;
    out = out.replace(/^[ \t]*@(media|supports)[^{;]*\{\s*\}[ \t]*\n?/gm, "");
  } while (out !== before);
  const linesBefore = text.split("\n").length;
  const linesAfter = out.split("\n").length;
  summary.push({ file, removed: rules.length, important, lines: linesBefore - linesAfter });
  if (!DRY) writeFileSync(file, out);
}
for (const s of summary) {
  console.log(`${s.file}: ${s.note || `${s.removed} regole tolte, ${s.lines} righe in meno, ${s.important} !important`}`);
}
const tot = summary.reduce((a, s) => ({ removed: a.removed + s.removed, lines: a.lines + (s.lines || 0), important: a.important + (s.important || 0) }), { removed: 0, lines: 0, important: 0 });
console.log(`\nTotale: ${tot.removed} regole, ${tot.lines} righe, ${tot.important} !important${DRY ? " (prova, nessun file scritto)" : ""}`);
