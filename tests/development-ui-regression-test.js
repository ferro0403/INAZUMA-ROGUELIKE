const fs = require("fs");
const assert = require("assert");
const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/game.css", "utf8");

assert(app.includes('id="open-development"'));
assert(app.includes('addEventListener("click", renderDevelopmentCenter)'));
assert(app.includes('document.getElementById("development-back").onclick = renderSeasonSelect'));
assert(app.includes("ensureAlbumBackfill();"));
assert(!/function developmentPlayers\(\)[\s\S]{0,100}backfillAlbumProgress\(\)/.test(app));
assert(app.includes('id="development-player-results"'));
assert(app.includes('search?.addEventListener("input", updateResults)'));
assert(!app.includes('search.addEventListener("input", () => renderDevelopmentCenter'));
assert(app.includes("renderEvolutionConfirmation(player, target, cost)"));
assert(app.includes('id="final-project-pull"'));
assert(app.includes('class="home-hub-card season-select-card season-select-card--empty development-season-card"'));
assert(css.includes(".development-season-card"));
console.log("development-ui-regression-test: center entry, navigation, live filtering and victory CTA OK");
