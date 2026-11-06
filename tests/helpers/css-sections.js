"use strict";
// Dal 4 novembre 2026 alcuni file CSS "patch" sono stati uniti al loro file proprietario, nello stesso ordine
// (scripts/css/merge-patch-files.mjs). Ogni parte unita e' preceduta da un'intestazione
// "/* ===== (unito da <nome>.css il 4 nov 2026) ===== */".
// Questi aiuti permettono ai test scritti per i vecchi file di controllare esattamente lo stesso testo.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OWNERS = {
  "season-delete-modal-restyle": "game.css",
  "inventory-redesign": "game.css",
  "squad-formation-picker-restyle": "game.css",
  "match-ui-cleanup": "match.css",
  "five-simulation-polish": "match.css",
  "five-match-reference-polish": "match.css",
  "five-match-action-assets": "match.css",
  "five-match-banner-clean": "match.css",
  "five-match-rounded-rarity": "match.css",
  "five-formation-floating-picker": "match.css",
  "five-match-picker-tuning": "match.css",
  "boss-match-prematch-restyle": "match.css",
  "boss-match-action-parity-fit": "match.css",
  "boss-match-simulation-modal-bridge": "match.css",
  "player-detail-premium": "player-detail.css",
  "player-detail-premium-fixes": "player-detail.css",
  "player-detail-reference-final": "player-detail.css",
  "player-detail-reference-tuning": "player-detail.css",
  "shop-ui-polish": "shop.css",
  "shop-ui-fixes": "shop.css",
};

// Testo che un tempo era nel file <name>.css (ora una sezione del file proprietario).
function cssSection(name) {
  const owner = OWNERS[name];
  if (!owner) throw new Error(`file CSS sconosciuto: ${name}`);
  const text = fs.readFileSync(path.join(ROOT, "css", owner), "utf8");
  const marker = `(unito da ${name}.css `;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`sezione ${name} non trovata in ${owner}`);
  const bodyStart = text.indexOf("*/", start) + 2;
  const next = text.indexOf("/* ===== (unito da ", bodyStart);
  return text.slice(bodyStart, next < 0 ? text.length : next);
}

// Il CSS che un tempo era in <name>.css e' caricato da index.html (tramite il suo file proprietario).
function stylesheetLoaded(indexHtml, name) {
  const owner = OWNERS[name];
  return Boolean(owner) && new RegExp(`href=["']css/${owner.replace(".", "\\.")}(?:\\?[^"']*)?["']`).test(indexHtml);
}

module.exports = { cssSection, stylesheetLoaded, OWNERS };

// Il CSS che era in <a>.css viene applicato DOPO quello che era in <b>.css (ordine del link, poi della sezione).
function loadsAfter(indexHtml, a, b) {
  const position = (name) => {
    const owner = OWNERS[name] || `${name}.css`;
    const link = indexHtml.search(new RegExp(`href=["']css/${owner.replace(".", "\\.")}`));
    if (link < 0) return [-1, -1];
    if (!OWNERS[name]) return [link, 0];
    const text = fs.readFileSync(path.join(ROOT, "css", owner), "utf8");
    return [link, text.indexOf(`(unito da ${name}.css `)];
  };
  const [la, sa] = position(a);
  const [lb, sb] = position(b);
  if (la < 0 || lb < 0) return false;
  return la > lb || (la === lb && sa > sb);
}

module.exports.loadsAfter = loadsAfter;
