const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/player-detail-premium.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /player-detail-premium\.css/, "the premium sheet stylesheet is loaded");
assert.match(app, /detailVisual\.frontFullbodyUrl/, "front fullbody remains the first-class visual source");
assert.match(app, /detailVisual\.detailFallbacks/, "fullbody errors retain portrait and placeholder fallbacks");
assert.match(app, /playerDetailMarkup[\s\S]*playerTeamIdentity/, "the detail keeps dynamic team identity resolution");
assert.match(app, /Object\.entries\(STAT_LABELS\)/, "all eight canonical stats are rendered from the existing values");
assert.match(app, /--stat-value:\$\{barValue\}%/, "real stat values drive the progress bars");
assert.match(app, /data-detail-unequip/, "the existing unequip control remains wired");
assert.match(app, /Nessun equipaggiamento/, "the designed empty equipment state is present");
assert.match(app, /mode === "historical"/, "historical mode remains supported");
assert.match(app, /mode === "album"/, "album mode remains supported");
assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/, "wide cards use a four-by-two stat grid");
assert.match(css, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/, "narrow cards use a two-by-four stat grid");
const detailSource = app.slice(app.indexOf("function playerDetailMarkup"), app.indexOf("function showPlayerDetailsFor"));
assert.doesNotMatch(detailSource, /Scheda completa/i, "no full-sheet CTA is introduced");

console.log("player-detail-premium-test: premium dynamic player sheet guards OK");
