const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const css = fs.readFileSync(require.resolve("../css/game.css"), "utf8");

assert.match(app, /data-development-selected-card aria-label="Apri la scheda di/);
assert.match(app, /data-development-selected-card[\s\S]*showPlayerDetailsFor\(current,[\s\S]*preserveScroll: scrollSnapshot\(\)/);
assert.match(app, /const preview = global\.InazumaProgression\.getPlayerAtLevel[\s\S]*optionsFromUpgrade/);
assert.match(app, /const statChanges = Object\.entries\(STAT_LABELS\)[\s\S]*delta = next - before/);
assert.match(app, /AUMENTO STATISTICHE/);
assert.match(app, /OVERALL[\s\S]*POTENZIALE/);
assert.match(app, /new URLSearchParams\(location\.search\)\.get\("dev"\) === "1" \? developmentDevMarkup/);
assert.match(app, /SBLOCCA TUTTI GLI SVINCOLATI/);
assert.match(app, /unlockAlbumPlayers\(global\.AlbumProgress\.DEFAULT_COLLECTION_ID,ids/);
assert.match(css, /development-stat-increases ul\{display:grid;grid-template-columns:1fr 1fr/);
assert.match(css, /max-height:calc\(100dvh - 24px\);overflow-y:auto/);
console.log("development-center-tools-test: detail, real stat preview, responsive modal and dev batch unlock OK");
