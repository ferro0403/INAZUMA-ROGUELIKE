const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const css = fs.readFileSync(require.resolve("../css/game.css"), "utf8");

assert.match(app, /const SEASON_CARD_PRESENTATION = Object\.freeze\(\{/);
assert.match(app, /ie1_s2: Object\.freeze\(\{ coverUrl: "https:\/\/static\.wikia\.nocookie\.net\/inazuma-eleven\/images\/9\/9b\/%28Artwork%29_Aliea_Gakuen_captains\.jpg/);
assert.match(app, /ie1_s3: Object\.freeze\(\{ coverUrl: "https:\/\/static\.wikia\.nocookie\.net\/inazuma-eleven-fanon/);
assert.match(app, /ie2: Object\.freeze\(\{ coverUrl: "https:\/\/www\.akibagamers\.it/);
assert.match(app, /loading="lazy" decoding="async"/);
assert.match(app, /<p class="eyebrow">MODALITÀ<\/p><h1>SELEZIONA SEASON<\/h1>/);
assert.doesNotMatch(app.slice(app.indexOf("async function renderSeasonSelect"), app.indexOf("function eligibleFreeAgentIds")), /CENTRO DI SVILUPPO|open-development/);
assert.match(css, /\.season-select-screen \.season-choice-grid \{[^}]*grid-template-columns: repeat\(2/);
assert.match(css, /@media \(max-width: 780px\)[\s\S]*\.season-select-screen \.season-choice-grid \{ grid-template-columns: minmax\(0,1fr\)/);

console.log("season-select-illustrated-test: covers, focal points and Season-only layout OK");
