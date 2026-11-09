#!/usr/bin/env node
// Passo 1 punto 5 (una tantum): unisce i file CSS "patch" ai file proprietari, SENZA cambiare l'ordine delle regole.
// Un file si unisce sempre a quello caricato subito prima (o subito dopo, in testa): l'ordine della cascata resta
// identico. Aggiorna index.html (link e ?v=) e i test che leggevano i file per nome.
// Verifica: stile calcolato (capture.mjs --styles + compare-styles.mjs) e foto identici.
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";

const VERSION = "20261104-css-owners-1";
const read = (f) => readFileSync(`css/${f}`, "utf8").replace(/\s+$/, "");
const section = (name) => `\n\n/* ===== (unito da ${name}.css il 4 nov 2026) ===== */\n`;
let html = readFileSync("index.html", "utf8");

// 1. Blocco <style> scritto in index.html: va in fondo a game.css (veniva subito dopo i file uniti a game.css).
const inline = html.match(/\n\s*<style>\n([\s\S]*?)\n\s*<\/style>/);
if (!inline) throw new Error("blocco <style> non trovato");

const groups = [
  { owner: "game.css", keepOwner: true, parts: ["season-delete-modal-restyle", "inventory-redesign", "squad-formation-picker-restyle"], inline: true },
  { owner: "match.css", parts: ["match-ui-cleanup", "five-simulation-polish", "five-match-reference-polish", "five-match-action-assets",
    "five-match-banner-clean", "five-match-rounded-rarity", "five-formation-floating-picker", "five-match-picker-tuning",
    "boss-match-prematch-restyle", "boss-match-action-parity-fit", "boss-match-simulation-modal-bridge"] },
  { owner: "player-detail.css", parts: ["player-detail-premium", "player-detail-premium-fixes", "player-detail-reference-final", "player-detail-reference-tuning"] },
  { owner: "shop.css", parts: ["shop-ui-polish", "shop-ui-fixes"] },
];
const moved = {}; // vecchio nome -> nuovo file (per i test)
for (const g of groups) {
  let out = g.keepOwner ? read(g.owner) : `/* ${g.owner}: proprietario unico (unione dei file elencati sotto, nello stesso ordine di caricamento). */`;
  for (const p of g.parts) {
    out += section(p) + read(`${p}.css`);
    moved[`${p}.css`] = g.owner;
  }
  if (g.inline) out += section("blocco <style> di index.html").replace(".css", "") + inline[1].split("\n").map((l) => l.replace(/^ {6}/, "")).join("\n");
  writeFileSync(`css/${g.owner}`, `${out}\n`);
  // index.html: il primo link del gruppo diventa il proprietario, gli altri spariscono.
  const linkRe = (name) => new RegExp(`\\n\\s*<link rel="stylesheet" href="css/${name.replace(/[.]/g, "\\.")}(\\?v=[^"]*)?" />`);
  const first = g.keepOwner ? g.owner : `${g.parts[0]}.css`;
  html = html.replace(linkRe(first), `\n    <link rel="stylesheet" href="css/${g.owner}?v=${VERSION}" />`);
  for (const p of g.parts) if (`${p}.css` !== first) html = html.replace(linkRe(`${p}.css`), "");
  for (const p of g.parts) if (`${p}.css` !== g.owner) unlinkSync(`css/${p}.css`);
}
html = html.replace(inline[0], "");

// 2. trade-result-card-fix.css: parte "scambio" -> trade-result.css; parte RTG (intervallo e rigori) ->
//    rtg-halftime-penalty.css, caricato subito dopo nello stesso punto (ordine della cascata identico).
const trade = read("trade-result-card-fix.css");
const cut = trade.search(/^\.rtg-/m);
if (cut < 0) throw new Error("parte RTG non trovata");
writeFileSync("css/trade-result.css", `/* trade-result.css: carta del risultato di uno scambio (era trade-result-card-fix.css). */\n${trade.slice(0, cut).trim()}\n`);
writeFileSync("css/rtg-halftime-penalty.css", `/* rtg-halftime-penalty.css: intervallo e rigori RTG (era in trade-result-card-fix.css). */\n${trade.slice(cut).trim()}\n`);
unlinkSync("css/trade-result-card-fix.css");
moved["trade-result-card-fix.css"] = "trade-result.css + rtg-halftime-penalty.css";
html = html.replace(/\n(\s*)<link rel="stylesheet" href="css\/trade-result-card-fix\.css(\?v=[^"]*)?" \/>/,
  `\n$1<link rel="stylesheet" href="css/trade-result.css?v=${VERSION}" />\n$1<link rel="stylesheet" href="css/rtg-halftime-penalty.css?v=${VERSION}" />`);
writeFileSync("index.html", html);

// 3. Test che leggevano i file per nome: ora leggono il nuovo file.
let tests = 0;
for (const f of readdirSync("tests").filter((x) => x.endsWith(".js") || x.endsWith(".mjs"))) {
  const path = `tests/${f}`;
  let text = readFileSync(path, "utf8");
  const before = text;
  for (const [oldName, newName] of Object.entries(moved)) {
    const target = newName.includes("+") ? "trade-result.css" : newName;
    text = text.split(`css/${oldName}`).join(`css/${target}`);
  }
  if (text !== before) { writeFileSync(path, text); tests += 1; }
}
console.log(JSON.stringify(moved, null, 1));
console.log(`index.html aggiornato, ${tests} test aggiornati`);
