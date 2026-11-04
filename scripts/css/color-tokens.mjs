#!/usr/bin/env node
// Passo 1 punto 6: sostituisce i colori e le ombre ripetuti con variabili CSS (token "--ir-*") definite una volta
// in testa a game.css. Tocca solo i VALORI delle dichiarazioni: mai selettori, @media, stringhe, url() o commenti.
// Uso:
//   node scripts/css/color-tokens.mjs --report [--skip=a.css,b.css]   conta i valori ripetuti
//   node scripts/css/color-tokens.mjs --apply  [--skip=a.css,b.css]   sostituisce (con la tabella TOKENS sotto)
// Una dichiarazione che il browser considera non valida resta com'e' (con var() cambierebbe comportamento).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.find((a) => a.startsWith(`--${name}=`)) || `=${fallback}`).split("=").slice(1).join("=");
const SKIP = new Set(opt("skip", "").split(",").filter(Boolean));
const FILES = readdirSync("css").filter((f) => f.endsWith(".css") && !SKIP.has(f)).sort();
const TOKEN_FILE = "game.css";

// Valore letterale -> nome del token. Colori: confronto senza spazi e minuscolo. Ombre: valore intero di box-shadow.
export const TOKENS = {
  colors: {
    "#111216": "ink", "#111": "ink-111", "#101116": "ink-deep", "#111318": "ink-soft", "#050506": "ink-black",
    "#000": "black", "#fff": "white",
    "#fffdf6": "paper", "#fffdf7": "paper-warm", "#fffaf0": "paper-cream", "#fffdf5": "paper-light", "#f7f1df": "cream",
    "#ffd21f": "yellow", "#ffd34f": "yellow-soft", "#ffd326": "yellow-bright", "#d4a017": "gold", "#8b6814": "gold-dark",
    "#625e55": "copy-muted", "#929ba8": "grey-blue", "#9aa7b8": "grey-steel", "#646464": "grey",
    "#2fa866": "green", "#27a8e8": "blue", "#8254d1": "purple", "#d93842": "red",
    "rgba(17,18,22,.12)": "ink-a12", "rgba(17,18,22,.14)": "ink-a14", "rgba(17,18,22,.16)": "ink-a16",
    "rgba(17,18,22,.18)": "ink-a18", "rgba(17,18,22,.2)": "ink-a20", "rgba(17,18,22,.22)": "ink-a22",
    "rgba(17,18,22,.24)": "ink-a24", "rgba(17,18,22,.28)": "ink-a28",
    "rgba(255,255,255,.08)": "white-a08", "rgba(255,255,255,.18)": "white-a18", "rgba(255,255,255,.24)": "white-a24",
    "rgba(0,0,0,.28)": "black-a28",
  },
  shadows: {
    "2px 2px 0 #111216": "shadow-ink-2", "2px 3px 0 #111216": "shadow-ink-2-3", "3px 3px 0 #111216": "shadow-ink-3",
    "3px 4px 0 #111216": "shadow-ink-3-4", "4px 4px 0 #111216": "shadow-ink-4", "4px 5px 0 #111216": "shadow-ink-4-5",
    "5px 6px 0 #111216": "shadow-ink-5-6",
    "3px 3px 0 #111": "shadow-111-3", "3px 4px 0 #111": "shadow-111-3-4", "4px 4px 0 #111": "shadow-111-4",
    "2px 2px 0 rgba(17,18,22,.24)": "shadow-soft-2", "3px 4px 0 rgba(17,18,22,.12)": "shadow-soft-3-4-a12",
    "3px 4px 0 rgba(17,18,22,.16)": "shadow-soft-3-4-a16", "4px 5px 0 rgba(17,18,22,.14)": "shadow-soft-4-5",
    "5px 6px 0 rgba(17,18,22,.18)": "shadow-soft-5-6", "3px 4px 0 rgba(17,18,22,.18)": "shadow-soft-3-4-a18",
    "4px 5px 0 rgba(17,18,22,.16)": "shadow-soft-4-5-a16", "5px 6px 0 rgba(17,18,22,.2)": "shadow-soft-5-6-a20",
    "2px 3px 0 rgba(17,18,22,.18)": "shadow-soft-2-3", "5px 5px 0 #111": "shadow-111-5", "1px 2px 0 #111216": "shadow-ink-1-2",
  },
};

const normColor = (c) => c.toLowerCase().replace(/\s+/g, "");
const normShadow = (v) => v.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").replace(/\(\s*/g, "(").replace(/\s*\)/g, ")").toLowerCase();
const COLOR_RE = /(?<![\w#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])|\brgba?\([^()]*\)/g;

// Copia del testo con commenti, stringhe e contenuto di url() coperti (stessa lunghezza): posizioni invariate.
function mask(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  out = out.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => `"${"x".repeat(m.length - 2)}"`);
  out = out.replace(/url\([^)]*\)/gi, (m) => `url(${"x".repeat(m.length - 5)})`);
  return out;
}

// Elenco delle dichiarazioni: { prop, valueStart, valueEnd } (posizioni nel testo originale).
function declarations(text) {
  const m = mask(text);
  const out = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < m.length; i += 1) {
    const ch = m[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth || (ch !== "{" && ch !== "}" && ch !== ";")) continue;
    if (ch !== "{") {
      const seg = m.slice(start, i);
      const colon = seg.indexOf(":");
      const prop = colon < 0 ? "" : seg.slice(0, colon).trim();
      if (colon >= 0 && /^(--[\w-]+|-?[a-zA-Z][\w-]*)$/.test(prop)) out.push({ prop: prop.startsWith("--") ? prop : prop.toLowerCase(), valueStart: start + colon + 1, valueEnd: i });
    }
    start = i + 1;
  }
  return { list: out, masked: m };
}

// Sostituzioni proposte per un file: [{ start, end, text, prop, value }].
function plan(text) {
  const { list, masked } = declarations(text);
  const edits = [];
  for (const d of list) {
    const raw = text.slice(d.valueStart, d.valueEnd);
    const imp = raw.match(/\s*!\s*important\s*$/i);
    const value = imp ? raw.slice(0, imp.index) : raw;
    const custom = d.prop.startsWith("--");
    if (d.prop === "box-shadow") {
      const name = TOKENS.shadows[normShadow(value)];
      if (name && !/["'(]url/i.test(value)) {
        const lead = value.match(/^\s*/)[0];
        edits.push({ start: d.valueStart + lead.length, end: d.valueStart + value.trimEnd().length, text: `var(--ir-${name})`, prop: d.prop, value: value.trim() });
        continue;
      }
    }
    const vm = masked.slice(d.valueStart, d.valueStart + value.length);
    for (const c of vm.matchAll(COLOR_RE)) {
      const literal = text.slice(d.valueStart + c.index, d.valueStart + c.index + c[0].length);
      const name = TOKENS.colors[normColor(literal)];
      if (!name) continue;
      // In una variabile CSS il testo resta testo: si sostituisce solo se identico al valore del token.
      if (custom && literal !== Object.keys(TOKENS.colors).find((k) => TOKENS.colors[k] === name)) continue;
      edits.push({ start: d.valueStart + c.index, end: d.valueStart + c.index + c[0].length, text: `var(--ir-${name})`, prop: d.prop, value: value.trim() });
    }
  }
  return edits;
}

function report() {
  const colors = new Map();
  const shadows = new Map();
  for (const f of FILES) {
    const text = readFileSync(`css/${f}`, "utf8");
    const { list, masked } = declarations(text);
    for (const d of list) {
      const value = masked.slice(d.valueStart, d.valueEnd).replace(/\s*!\s*important\s*$/i, "");
      for (const c of value.matchAll(COLOR_RE)) colors.set(normColor(c[0]), (colors.get(normColor(c[0])) || 0) + 1);
      if (d.prop === "box-shadow") shadows.set(normShadow(value), (shadows.get(normShadow(value)) || 0) + 1);
    }
  }
  const top = (m, min) => [...m].filter((x) => x[1] >= min).sort((a, b) => b[1] - a[1]);
  console.log("Colori ripetuti (>=10):");
  for (const [k, n] of top(colors, 10)) console.log(`${String(n).padStart(5)}  ${k}${TOKENS.colors[k] ? `  -> --ir-${TOKENS.colors[k]}` : ""}`);
  console.log("Ombre ripetute (>=5):");
  for (const [k, n] of top(shadows, 5)) console.log(`${String(n).padStart(5)}  ${k}${TOKENS.shadows[k] ? `  -> --ir-${TOKENS.shadows[k]}` : ""}`);
}

async function apply() {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let total = 0;
  let invalid = 0;
  const used = new Set();
  for (const f of FILES) {
    const text = readFileSync(`css/${f}`, "utf8");
    const edits = plan(text);
    if (!edits.length) continue;
    const pairs = [...new Set(edits.filter((e) => !e.prop.startsWith("--")).map((e) => `${e.prop}\u0000${e.value}`))];
    const valid = new Set(await page.evaluate((list) => list.filter((p) => { const [prop, value] = p.split("\u0000"); return CSS.supports(prop, value); }), pairs));
    let out = text;
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      if (!e.prop.startsWith("--") && !valid.has(`${e.prop}\u0000${e.value}`)) { invalid += 1; continue; }
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
      used.add(e.text.slice("var(--ir-".length, -1));
      total += 1;
    }
    writeFileSync(`css/${f}`, out);
  }
  await browser.close();
  // Definizioni in testa al file dei token (caricato per primo).
  const defs = [];
  for (const [literal, name] of Object.entries(TOKENS.colors)) if (used.has(name)) defs.push(`  --ir-${name}: ${literal};`);
  for (const [value, name] of Object.entries(TOKENS.shadows)) if (used.has(name)) defs.push(`  --ir-${name}: ${value.replace(/,(?=\S)/g, ",")};`);
  const head = "/* Token condivisi: colori e ombre ripetuti in piu' file (scripts/css/color-tokens.mjs). */\n";
  const tokenText = readFileSync(`css/${TOKEN_FILE}`, "utf8");
  writeFileSync(`css/${TOKEN_FILE}`, `${head}:root {\n${defs.join("\n")}\n}\n\n${tokenText}`);
  console.log(`${total} valori sostituiti con ${used.size} token; ${invalid} lasciati (dichiarazione non valida per il browser)`);
}

if (args.includes("--report")) report();
else if (args.includes("--apply")) await apply();
else console.log("Uso: --report oppure --apply [--skip=a.css,b.css]");
