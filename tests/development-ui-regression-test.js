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
assert.equal((app.match(/function renderDevelopmentCenter\(/g) || []).length, 1, "renderDevelopmentCenter must not be duplicated after conflict resolution");
assert.equal((app.match(/function developmentPlayers\(/g) || []).length, 1, "developmentPlayers must not be duplicated after conflict resolution");
assert.equal((app.match(/addEventListener\(\"click\", renderDevelopmentCenter\)/g) || []).length, 1, "the Development Center entry listener must be bound once in the renderer");
const index = fs.readFileSync("index.html", "utf8");
assert.equal((index.match(/js\/development-v2\.js/g) || []).length, 1, "DevelopmentV2 must be loaded exactly once");
for (const file of [app, css, index, fs.readFileSync("js/development-v2.js", "utf8")]) {
  assert(!file.includes("<<<<<<<") && !file.includes(">>>>>>>"), "unresolved conflict marker found");
}
console.log("development-ui-regression-test: center entry, navigation, live filtering and victory CTA OK");
