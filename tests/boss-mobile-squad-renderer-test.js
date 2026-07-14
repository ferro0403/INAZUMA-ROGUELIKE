"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const mobileCss = css.slice(css.indexOf("@media (max-width: 780px)"));

assert(appJs.includes('function bossMatchMobileField(team, side)'), "boss preview must expose a mobile-specific selector helper");
assert(appJs.includes('return `<div class="boss-match-shared-squad-field" data-boss-team="user">${squadPitchMarkup({ mode: "readonly-boss" })}</div>`;'), "mobile user boss tab must reuse the shared squad pitch markup");
assert(appJs.includes('mode === "readonly-boss"'), "readonly boss mode must be supported by tacticalMiniPlayer");
assert(appJs.includes('data-boss-player="${escapeHtml(id)}" data-boss-side="user"'), "shared squad cards in the boss tab must keep player detail hooks");
assert.equal((appJs.match(/squadPitchMarkup\(\{ mode: "readonly-boss" \}\)/g) || []).length, 1, "boss preview should use one shared squad renderer instance");
assert.equal((appJs.match(/equipmentBadgeMarkup\(equipment, "boss-match-card-item"\)/g) || []).length, 1, "legacy boss equipment badge markup should exist only for non-shared bossMatchCard rendering");
assert(mobileCss.includes('.boss-match-shared-squad-field .pitch'), "mobile CSS must adapt only the shared squad pitch wrapper in boss preview");
assert(!/\.boss-match-field-side--mobile \.boss-match-card-item/.test(mobileCss), "mobile boss preview must not keep separate item-badge positioning overrides");
assert(!/\.boss-match-shared-squad-field[\s\S]*?\.player-card-compact/.test(mobileCss), "boss preview must not redefine compact squad card sizing locally");
assert(/\.boss-match-field \{[^}]*display:\s*block/.test(mobileCss), "mobile boss field rules must remain inside the mobile breakpoint");

console.log("Boss mobile squad renderer test passed: shared readonly squad pitch is used for the user tab.");
