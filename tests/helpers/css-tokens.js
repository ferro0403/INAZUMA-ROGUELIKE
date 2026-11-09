"use strict";
// Dal 4 novembre 2026 i colori e le ombre ripetuti sono variabili "--ir-*" definite in testa a css/game.css
// (scripts/css/color-tokens.mjs). I test che controllano un colore nel testo del CSS usano withLiteralTokens:
// rimette al posto di ogni var(--ir-...) il suo valore, cosi' il controllo resta sullo stesso colore.
const fs = require("fs");
const path = require("path");

const game = fs.readFileSync(path.resolve(__dirname, "..", "..", "css", "game.css"), "utf8");
const TOKENS = new Map([...game.matchAll(/^\s*(--ir-[\w-]+)\s*:\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));

function withLiteralTokens(css) {
  return String(css).replace(/var\((--ir-[\w-]+)\)/g, (all, name) => TOKENS.get(name) || all);
}

module.exports = { withLiteralTokens, TOKENS };
