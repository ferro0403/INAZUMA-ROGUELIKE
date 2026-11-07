"use strict";
// 7 nov 2026: riquadri vuoti di David Arrows e Mister Yi tra gli allenatori. Le immagini esistono e il collegamento e'
// giusto (controllato qui); la causa e' Safari, che a volte non disegna un ritratto bloccato (filtro grigio) fuori dalla
// parte visibile di una finestra che scorre. Ogni ritratto bloccato ha ora un suo livello di disegno.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = vm.createContext({});
context.globalThis = context;
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-coaches.js", "utf8"), context);
const catalog = Array.from(context.RoadToGloryCoaches.CATALOG);
for (const coach of catalog) {
  for (const key of ["imageUrl", "frontFullbodyUrl"]) {
    assert.match(String(coach[key] || ""), /^https:\/\/dxi4wb638ujep\.cloudfront\.net\/1\/k\/[\w/-]+\.(png|webp)$/,
      `${coach.name}: ${key} mancante o non valido`);
  }
}
for (const name of ["David Arrows", "Mister Yi"]) assert(catalog.some((c) => c.name === name), `${name} nel catalogo`);
const css = fs.readFileSync("css/rtg-coaches.css", "utf8");
for (const selector of [".rtg-coaches-modal .rtg-coach-entry.is-locked .player-portrait-wrap",
  ".rtg-coaches-album .rtg-coach-album-entry.is-locked .player-portrait-wrap"]) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(css, new RegExp(`${escaped}[^{]*\\{transform:translateZ\\(0\\);backface-visibility:hidden\\}`),
    `livello di disegno proprio per ${selector}`);
}
console.log(`rtg-coach-images-test: PASS (${catalog.length} allenatori con immagini; ritratti bloccati su un loro livello)`);
