'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}`);
  const end = app.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} source is available`);
  return app.slice(start, end);
}

const helper = functionSource('compactPlayerCardMarkup', 'playerCard');
const bossRenderer = functionSource('matchFormationCard', 'renderMatchFormation');
const matchRenderer = functionSource('fiveMatchCard', 'fiveMatchField');
const formationRenderer = functionSource('fiveSlotCard', 'fiveRosterCard');

for (const token of ['player-role', 'player-overall', 'player-title', 'player-equipment--footer']) {
  assert.ok(helper.includes(token), `shared tactical card is missing ${token}`);
}
assert.match(helper, /equipmentDefinition\s*\?/, 'equipment is rendered only when present');
for (const renderer of [bossRenderer, matchRenderer, formationRenderer]) {
  assert.match(renderer, /compactPlayerCardMarkup\(player/, 'every 5v5 renderer reuses the shared tactical card');
  assert.match(renderer, /equipmentInFooter: true/, 'every 5v5 renderer places equipment in the shared footer');
}
assert.doesNotMatch(app, /fivePlayerEquipmentMarkup/, '5v5 has no position-specific equipment renderer');
assert.doesNotMatch(css, /five-player-equipment/, 'obsolete free-floating 5v5 equipment CSS is removed');

assert.match(css, /:is\(\.five-screen,\.five-match-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-title strong \{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s);
assert.match(css, /:is\(\.five-screen,\.five-match-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-equipment--footer \{[^}]*position: static;[^}]*box-sizing: border-box;[^}]*overflow: hidden;[^}]*background: var\(--unified-card-yellow\);/s);
assert.doesNotMatch(css, /\.five-match-screen \.five-match-card\.run-tactical-card \.player-equipment--footer/, 'match cards have no divergent equipment badge override');

console.log('tactical-player-card-test: ok');
