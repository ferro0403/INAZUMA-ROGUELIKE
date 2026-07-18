"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");

["4-3-3", "4-4-2", "3-4-3", "5-4-1", "4-5-1", "4-2-4"].forEach((formation) => {
  assert(appJs.includes(formation) || fs.readFileSync(path.join(root, "data/IE1_season_compact.json"), "utf8").includes(`\"id\":\"${formation}\"`), `${formation} must remain available to the 11v11 renderer`);
});

assert(appJs.includes('class="boss-match-heading"'), "Boss 11v11 must render a compact challenge header");
assert(!appJs.includes('class="boss-match-header-stats"'), "Boss header must not duplicate boss level, team name, OVR, or lives chips");
assert(!appJs.includes('<h2>Sfida Boss 11v11</h2>'), "Boss title must be simplified to Sfida Boss");
assert(appJs.includes('<h2>Sfida Boss</h2>'), "Boss hero must render the simplified title");
assert(appJs.includes('class="boss-match-team boss-match-team--boss"'), "Boss hero must visually identify the opposing boss team");
assert(appJs.includes('aria-label="Formazioni 11v11"'), "Boss formations panel must be accessible");
assert(appJs.includes('role="tablist"') && appJs.includes('La tua squadra') && appJs.includes('data-boss-tab="boss"'), "mobile team tabs must remain explicit and accessible");
assert(appJs.includes('${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user")}') && appJs.includes('${bossMatchField({ players: bossPlayers, formationId: boss.bossFormation }, "boss")}'), "desktop boss match must render both sides with the shared formation renderer");
assert(appJs.includes('showEquipment: side === "user"'), "Boss cards must only show equipment for the user side");
assert(appJs.includes('fiveMatchComparisonMarkup(userPlayers, bossPlayers)'), "tactical comparison must use existing real player attributes");
assert(appJs.includes('aria-live="polite"') && appJs.includes('scoreLabel'), "score and commentary must be announced without duplicating simulation events");
assert(appJs.includes('boss-match-result-panel--victory') && appJs.includes('boss-match-result-panel--defeat'), "final result must distinguish victory and defeat without color-only copy");
assert(appJs.includes('Doppia pick boss'), "victory result must advertise the existing double-pick post-boss flow");
assert(appJs.includes('Finalizzazione protetta'), "pre-result panel must communicate one-time finalization safeguards");
assert(appJs.includes('forceMatchOutcome("victory", { boss })'), "Vittoria sicura must continue through the centralized forced outcome flow");
assert(appJs.includes('startMatchSimulation(ui.match, { boss })'), "Simula partita must continue using the existing simulator entry point");
assert(!appJs.includes('function bossMatchMobileField(team, side)'), "Boss mobile tabs must not introduce a duplicate formation renderer");

assert(css.includes('.boss-match-screen { background: radial-gradient'), "Boss screen must have a dedicated boss-fight atmosphere");
assert(css.includes('.boss-match-hero::before'), "Boss hero must use a decorative non-interactive layer");
assert(css.includes('.boss-match-team-tab:focus-visible'), "Boss tabs must expose a visible focus state");
assert(css.includes('.boss-tactics-showdown'), "Boss tactical comparison must be grouped in its own section");
assert(css.includes('.boss-match-result-panel--victory') && css.includes('.boss-match-result-panel--defeat'), "Boss result states must have explicit styles");
assert(!/boss-match-controls[\s\S]{0,160}position:\s*(fixed|sticky)/.test(css), "Boss action bar must remain in normal document flow");
assert(/@media \(max-width: 780px\)[\s\S]*?\.boss-match-tabs \{ display: grid/.test(css), "mobile boss tabs must be visible only in the mobile layout");
assert(css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.boss-match-hero'), "Boss presentation must respect reduced motion preferences");

console.log("Boss 11v11 polish regression checks passed");
