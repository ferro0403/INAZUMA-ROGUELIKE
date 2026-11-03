#!/usr/bin/env node
// Legge i file prodotti dal raccoglitore (CSS_USAGE_OUT) e scrive il rapporto sul CSS morto.
// Uso: node scripts/css/css-usage-report.mjs <cartella-raccolta> [--md=docs/CSS_MORTO.md] [--json=file]
//
// Si parte dalle regole SCRITTE nei file CSS caricati dal gioco. Per ognuna:
//   usata        almeno un suo selettore ha trovato un elemento in almeno una schermata visitata;
//   morta-certa  nessun selettore usato, e in ogni selettore c'e' una classe/id che non compare in nessun
//                file js/ o in index.html: quell'elemento non puo' esistere;
//   non-vista    nessun selettore usato, ma le classi compaiono nel codice: forse uno stato non visitato;
//   scartata     il browser non l'ha caricata (selettore non valido): non ha effetto.
// I `!important` sono contati nel testo (occorrenze), come nell'audit. I file CSS mai caricati sono a parte.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseCss, splitSelectors } from "./css-parse.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
if (!dir) {
  console.error("Uso: node scripts/css/css-usage-report.mjs <cartella-raccolta> [--md=file] [--json=file]");
  process.exit(2);
}

// Normalizzazione: il browser riscrive spazi, virgolette e media query; qui si riporta tutto alla stessa forma.
const norm = (x) => String(x || "").toLowerCase().replace(/['"]/g, "")
  .replace(/::?(before|after|first-line|first-letter)/g, "::$1")
  .replace(/\(\s*odd\s*\)/g, "(2n+1)").replace(/\(\s*even\s*\)/g, "(2n)")
  .replace(/\s+/g, " ").replace(/\s*([>+~,()=:])\s*/g, "$1").trim();
const normMedia = (x) => String(x || "").toLowerCase().replace(/\s+/g, "");

// 1. Misure del browser, selettore per selettore (usato se lo e' in almeno una raccolta).
const seen = new Map(); // file|media|selettore -> usato?
const loadedFiles = new Set();
const visitedStates = new Map(); // stato -> raccolte in cui compare
const visitedMarks = new Set();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const source = f.startsWith("browser") ? "prove" : "screenshot";
  for (const st of data.states || []) visitedStates.set(st, new Set([...(visitedStates.get(st) || []), source]));
  for (const m of data.marks || []) visitedMarks.add(m);
  for (const r of Array.isArray(data) ? data : data.rules) {
    loadedFiles.add(r.file);
    const key = `${r.file}|${normMedia(r.media)}|${norm(r.selector)}`;
    seen.set(key, Boolean(seen.get(key)) || r.used);
  }
}

// 2. Testo di tutto il codice che puo' creare classi e id.
const walkFiles = (root, ext) => {
  const out = [];
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p, ext));
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
};
const codeText = [...walkFiles("js", [".js", ".mjs"]), "index.html"].map((p) => readFileSync(p, "utf8")).join("\n");
const tokenCache = new Map();
// Una classe "esiste" se compare intera nel codice, oppure se un suo prefisso che finisce con "-" o "_" e' seguito
// da un pezzo dinamico (es. `rarity-${...}`, "rarity-" + x): in quel caso potrebbe essere costruita a runtime.
const dynamicPrefix = (prefix) => [`${prefix}\${`, `${prefix}" +`, `${prefix}"+`, `${prefix}' +`, `${prefix}'+`]
  .some((p) => codeText.includes(p));
const tokenExists = (token) => {
  if (!tokenCache.has(token)) {
    let found = codeText.includes(token);
    for (let i = 0; !found && i < token.length - 1; i += 1) {
      if (token[i] === "-" || token[i] === "_") found = dynamicPrefix(token.slice(0, i + 1));
    }
    tokenCache.set(token, found);
  }
  return tokenCache.get(token);
};
const impossible = (selector) => [...selector.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)].some((m) => !tokenExists(m[1]));

// 3. Stato di ogni regola scritta nei file caricati.
const rules = [];
for (const file of [...loadedFiles].filter((f) => f.endsWith(".css")).sort()) {
  for (const r of parseCss(readFileSync(file, "utf8"))) {
    const selectors = splitSelectors(r.selector).map((s) => ({ s, used: seen.get(`${file}|${normMedia(r.media)}|${norm(s)}`) }));
    let status;
    if (selectors.every((x) => x.used === undefined)) status = "scartata";
    else if (selectors.some((x) => x.used)) status = "usata";
    else if (selectors.every((x) => impossible(x.s))) status = "morta-certa";
    else status = "non-vista";
    rules.push({ file, line: r.line, media: r.media, selector: r.selector.replace(/\s+/g, " "), important: r.important, status });
  }
}

// 4. File CSS mai caricati.
const unloaded = readdirSync("css").filter((f) => f.endsWith(".css")).map((f) => `css/${f}`)
  .filter((f) => !loadedFiles.has(f)).map((f) => {
    const text = readFileSync(f, "utf8");
    return { file: f, lines: text.split("\n").length, important: (text.match(/!important/g) || []).length };
  });

// 5. Riepiloghi.
const STATUSES = ["usata", "morta-certa", "non-vista", "scartata"];
const byFile = new Map();
for (const r of rules) {
  const s = byFile.get(r.file)
    || Object.fromEntries([["file", r.file], ["rules", 0], ["important", 0], ...STATUSES.flatMap((k) => [[k, 0], [`imp:${k}`, 0]])]);
  s.rules += 1;
  s.important += r.important;
  s[r.status] += 1;
  s[`imp:${r.status}`] += r.important;
  byFile.set(r.file, s);
}
const files = [...byFile.values()].sort((a, b) => (b.rules - b.usata) - (a.rules - a.usata));
const total = (k) => files.reduce((n, f) => n + f[k], 0);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "-");

const L = [];
L.push("# CSS morto — misura", "");
L.push(`Generato da \`npm run css:usage\` (\`scripts/css/css-usage-report.mjs\`) il ${new Date().toISOString().slice(0, 10)}.`, "");
L.push("Metodo: il browser visita tutte le schermate degli screenshot e delle prove nel browser (viewport 412x915);",
  "dopo ogni passo si controlla quali selettori trovano almeno un elemento. Stati come `:hover` e `::before` vengono",
  "ignorati (conta l'elemento). Categorie:", "",
  "- **usata**: almeno un selettore ha trovato un elemento;",
  "- **morta-certa**: in ogni selettore c'e' una classe o un id che non compare in nessun file `js/` ne' in",
  "  `index.html`: l'elemento non puo' esistere;",
  "- **non-vista**: le classi esistono nel codice ma nessuna schermata visitata le ha mostrate. Puo' essere uno",
  "  stato raro, una schermata non visitata o una regola solo desktop: **va controllata prima di toglierla**;",
  "- **scartata**: il browser non la carica (selettore non valido), non ha effetto.", "",
  "Limiti: le regole dentro `@media` per schermi larghi contano come usate se l'elemento esiste, anche se su",
  "telefono non si applicano; le classi costruite pezzo per pezzo nel JS (es. `'rarity-' + nome`) possono far",
  "sembrare \"impossibili\" regole vive: per questo la rimozione si fa a gruppi, con screenshot di confronto.", "");
L.push("## Schermate e pop-up visitati durante la misura", "");
L.push("| Stato | Visto da |", "|---|---|");
for (const [st, src] of [...visitedStates.entries()].sort()) L.push(`| ${st} | ${[...src].sort().join(", ")} |`);
L.push("", `Classi di stati notevoli viste a schermo (${visitedMarks.size}): ${[...visitedMarks].sort().map((m) => `\`${m}\``).join(", ")}`, "");
L.push("## Totale (fogli caricati dal gioco)", "");
L.push("| | Regole | `!important` |", "|---|---|---|");
for (const k of STATUSES) L.push(`| ${k} | ${total(k)} (${pct(total(k), total("rules"))}) | ${total(`imp:${k}`)} |`);
L.push(`| **totale** | ${total("rules")} | ${total("important")} |`, "");
L.push("## File CSS mai caricati", "");
if (unloaded.length) {
  L.push("Non compaiono in `index.html`, in nessun `@import` e in nessun file JS: il browser non li scarica mai.", "");
  L.push("| File | Righe | `!important` |", "|---|---|---|");
  for (const u of unloaded) L.push(`| ${u.file} | ${u.lines} | ${u.important} |`);
  L.push(`| **totale** | ${unloaded.reduce((n, u) => n + u.lines, 0)} | ${unloaded.reduce((n, u) => n + u.important, 0)} |`, "");
} else L.push("Nessuno.", "");
L.push("## Per file", "");
L.push("| File | Regole | usata | morta-certa | non-vista | scartata | `!important` | `!imp.` morti certi | `!imp.` non visti |",
  "|---|---|---|---|---|---|---|---|---|");
for (const f of files) {
  L.push(`| ${f.file} | ${f.rules} | ${f.usata} | ${f["morta-certa"]} | ${f["non-vista"]} | ${f.scartata} | ${f.important}`
    + ` | ${f["imp:morta-certa"]} | ${f["imp:non-vista"]} |`);
}
L.push("");
const md = L.join("\n");
console.log(md);
if (opt("md")) writeFileSync(opt("md"), md);
if (opt("json")) {
  writeFileSync(opt("json"), JSON.stringify({ states: [...visitedStates.keys()].sort(), marks: [...visitedMarks].sort(), unloaded, files, rules }, null, 1));
}
