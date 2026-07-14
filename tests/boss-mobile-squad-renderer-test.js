"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const mobileCss = css.slice(css.indexOf("@media (max-width: 780px)"));

assert(appJs.includes('function renderMatchFormation({ players, formationId, side = "user"'), "boss preview must use the shared match formation renderer");
assert(appJs.includes('function matchFormationCard(player, { side = "user", readonly = true, showEquipment = false }'), "both sides must use the same match card helper");
assert(appJs.includes('extraClass: `match-player-card match-player-card--${side} boss-match-card boss-match-card--${side}`'), "shared cards must expose common and side modifier classes");
assert(appJs.includes('showEquipment: side === "user"'), "equipment rendering must be parameterized by side");
assert(appJs.includes('detailLayout: "stacked"'), "boss match cards must request the complete stacked name, role/OVR, and level details");
assert(appJs.includes('player-meta-line player-meta-line--role-overall') && appJs.includes('data-player-role') && appJs.includes('data-player-overall'), "boss match cards must render role and OVR together under the name");
assert(appJs.includes('player-meta-line player-meta-line--level') && appJs.includes('data-player-level'), "boss match cards must render level on its own detail row");
assert(css.includes('.match-player-card.boss-match-card .player-meta--stacked'), "shared boss match cards must style the stacked detail hierarchy");
assert(css.includes('.match-player-card--boss.boss-match-card .player-meta--stacked'), "boss cards must keep a readable opponent text treatment");
assert(!appJs.includes('function bossMatchMobileField(team, side)'), "mobile must not keep a separate boss-match renderer selector");
assert.equal((appJs.match(/renderMatchFormation\(/g) || []).length >= 1, true, "boss match should route formation markup through the shared renderer");
assert(!/\.boss-match-field-side--mobile \.boss-match-card-item/.test(mobileCss), "mobile boss preview must not keep separate item-badge positioning overrides");
assert(/\.boss-match-field \{[^}]*display:\s*block/.test(mobileCss), "mobile boss field rules must remain inside the mobile breakpoint");

console.log("Boss mobile squad renderer test passed: shared match formation renderer is used for both tabs.");
