'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const fiveStart = app.indexOf('if (!isBoss && !isSpecial)');
const fiveEnd = app.indexOf('const userPlayers = userTeamPlayers()', fiveStart);
const renderer = app.slice(fiveStart, fiveEnd);

for (const text of ['Azioni partita', 'Simula partita', 'Avvia la simulazione', 'Modifica squadra', 'Gestisci titolari', 'Strumenti di test', 'Vittoria sicura']) {
  assert.ok(renderer.includes(text), `the refined action panel is missing: ${text}`);
}
assert.match(renderer, /id="simulate-boss-match"[\s\S]*id="edit-five-team"[\s\S]*id="test-win"/, 'existing action ids remain on the new controls');
assert.match(renderer, /const canEditFiveMatch = match\.state === "pre-match"[\s\S]*ui\.bossMatchState === "pre-match"[\s\S]*match\.simulation\.state === "pre-match"/, 'team editing is available only before the 5v5 is frozen');
assert.match(renderer, /getElementById\("edit-five-team"\)\.addEventListener[\s\S]*commitMatchMutation\("five-match-edit-entry"[\s\S]*renderFiveVFive\(\{ persist: false, returnToMatch: true \}\)/, 'team editing enters through one canonical transaction and renders only after commit');
assert.doesNotMatch(renderer, /persistMatchState\(\);\s*renderFiveVFive\(\{ returnToMatch: true \}\)/, 'team editing must not restore the legacy double-save path');
assert.match(renderer, /getElementById\("test-win"\)\?\.addEventListener[\s\S]*forceMatchOutcome\("victory"\)/, 'safe victory retains its existing test flow');
assert.match(renderer, /getElementById\("simulate-boss-match"\)\.addEventListener[\s\S]*openFiveMatchSimulationModal[\s\S]*startMatchSimulation/, 'simulation retains its existing modal and playback flow');

assert.match(css, /\.five-match-screen > \.five-match-controls \{[\s\S]*border: 3px solid #111216;[\s\S]*background: linear-gradient/, 'action styling stays scoped to the 5v5 screen');
assert.match(css, /\.five-match-action-cta--primary[\s\S]*#ffc91b[\s\S]*#ffdd43/, 'primary simulation CTA uses the premium gold treatment');
assert.match(css, /\.five-match-action-cta--secondary[^{]*\{[^}]*#fffdf7/, 'team CTA uses the secondary ivory treatment');
assert.match(css, /\.five-match-screen \.five-match-controls \.match-test-tools \{[\s\S]*border: 1px dashed/, 'test tools remain visually subordinate');
assert.match(css, /@media \(max-width: 780px\)[\s\S]*\.five-match-screen > \.five-match-controls \{ width: calc\(100% - 12px\)/, 'action deck is bounded inside mobile viewports');
assert.match(css, /@media \(max-width: 370px\)[\s\S]*minmax\(0, 137px\)/, 'two-card rows fit the 360px viewport without horizontal overflow');
assert.match(css, /\.five-match-screen \.five-match-card::before \{[^}]*var\(--rarity-border/, 'rarity remains a dedicated geometric accent');
assert.match(css, /\.five-match-screen \.five-match-card\.is-active \{[^}]*#ffd21f/, 'selection uses its own yellow highlight');

console.log('five-match-action-panel-test: premium CTAs, transactional edit contract and responsive half cards OK');
