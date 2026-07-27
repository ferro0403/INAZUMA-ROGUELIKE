'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const helper = app.slice(
  app.indexOf('function compactPlayerCardMarkup'),
  app.indexOf('function playerCard', app.indexOf('function compactPlayerCardMarkup')),
);
const bossRenderer = app.slice(
  app.indexOf('function matchFormationCard'),
  app.indexOf('function renderMatchFormation'),
);
const fiveRenderer = app.slice(
  app.indexOf('function fiveSlotCard'),
  app.indexOf('function fiveRosterCard'),
);

for (const token of ['player-role', 'player-overall', 'player-title', 'player-equipment--footer']) {
  assert.ok(helper.includes(token), `shared tactical card is missing ${token}`);
}
assert.match(helper, /equipmentDefinition\s*\?/, 'equipment is rendered only when present');
assert.match(bossRenderer, /compactPlayerCardMarkup\(player/);
assert.match(bossRenderer, /equipmentInFooter: true/);
assert.match(fiveRenderer, /compactPlayerCardMarkup\(player/);
assert.match(fiveRenderer, /equipmentInFooter: true/);
assert.doesNotMatch(fiveRenderer, /fivePlayerEquipmentMarkup\(equipment\)/, '5v5 must not inject a position-specific equipment badge');

assert.match(css, /:is\(\.five-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-title strong \{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s);
assert.match(css, /:is\(\.five-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-equipment--footer \{[^}]*position: static;[^}]*flex: 0 0 22px;/s);

console.log('tactical-player-card-test: ok');
