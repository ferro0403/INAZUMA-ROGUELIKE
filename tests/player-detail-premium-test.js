"use strict";
const assert = require("assert");
const fs = require("fs");

const view = fs.readFileSync("js/player/player-view.js", "utf8");
const controller = fs.readFileSync(
  "js/player/player-detail-controller.js",
  "utf8",
);
const css = fs.readFileSync("css/player-detail-premium.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.match(
  html,
  /player-detail-premium\.css/,
  "the premium sheet stylesheet is loaded",
);
assert.match(
  view,
  /detailVisual\.detailImageUrl/,
  "resolved detail image remains the first-class visual source",
);
assert.match(
  view,
  /detailVisual\.detailFallbacks/,
  "fullbody errors retain portrait and placeholder fallbacks",
);
assert.match(
  view,
  /historicalTeamIdentity[\s\S]*playerTeamIdentity/,
  "detail retains injected team identity resolution",
);
assert.match(
  view,
  /Object\.entries\(STAT_LABELS\)/,
  "all eight canonical stats are rendered",
);
assert.match(
  view,
  /--stat-value:\$\{barValue\}%/,
  "real stat values drive progress bars",
);
assert.match(
  view,
  /data-detail-unequip/,
  "the unequip control remains present",
);
assert.match(
  controller,
  /unequipPlayerItem\(opts\.playerId/,
  "unequip remains wired through the injected adapter",
);
assert.match(
  view,
  /Nessun equipaggiamento/,
  "the empty equipment state remains present",
);
assert.doesNotMatch(
  view.match(/const equipmentMarkup[\s\S]*?;\n/)?.[0] || "",
  /itemImageFallbackSvg/,
);
assert.match(view, /player-detail-hero--long-name/);
assert.match(view, /mode === "historical"/);
assert.match(view, /mode === "album"/);
assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /grid-template-columns: 47% 53%/);
assert.doesNotMatch(view, /Scheda completa/i);
console.log(
  "player-detail-premium-test: extracted premium dynamic player sheet guards OK",
);
