'use strict';
const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js','utf8');
const css = fs.readFileSync('css/game.css','utf8');
assert.match(app, /node-type-\$\{escapeHtml\(node\.type\)\}/);
assert.match(css, /\.map-node\.locked \{ filter: grayscale\(\.28\) saturate\(\.68\); opacity: \.5; \}/);
assert.match(app, /trade-selection-portrait/);
for (const copy of ['GIOCATORE SELEZIONATO','RINUNCIA ALLO SCAMBIO','aria-expanded="false"','aria-controls="five-match-values-content"']) assert.ok(app.includes(copy), `${copy} missing`);
assert.match(app, /five-match-values-content" id="five-match-values-content" hidden/);
assert.match(app, /openIndividualItemSelector\(item, "level"/);
assert.match(app, /openIndividualItemSelector\(item, "potential"/);
assert.match(app, /if \(item\.effect === "team_level"\)/);
assert.match(app, /if \(item\.effect === "restore_life"\)/);
assert.match(app, /data-item-target-player/);
assert.doesNotMatch(app.slice(app.indexOf('function setInventoryEquipmentTarget'), app.indexOf('function openInventoryConfirmation')), /renderApp\(/);
assert.match(css, /#cancel-trade \{[^}]*color: #111216/s);
for (const selector of ['.formation-choice-screen', '.initial-draft-screen', '.route-boss-preview-modal', '.random-event-modal']) {
  assert.ok(css.includes(selector), `${selector} restyle missing`);
}
assert.match(app, /class="screen onboarding-screen formation-choice-screen"/);
assert.match(app, /class="screen onboarding-screen initial-draft-screen"/);
assert.match(app, /const fallback = "⚽";/);
assert.doesNotMatch(app, /teamName\.trim\(\)\[0\]/);
console.log('ui-smoke-test: ok');
