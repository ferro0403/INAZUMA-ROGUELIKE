'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const matchViewStart = app.indexOf('function fiveMatchCard');
const matchView = app.slice(matchViewStart, app.indexOf('const userPlayers = userTeamPlayers()', matchViewStart));

for (const target of ['id="simulate-boss-match"', 'id="edit-five-team"', 'id="skip-match-result"', 'id="continue-match-result"']) {
  assert.ok(matchView.includes(target), `5v5 match control ${target} is missing`);
}
assert.match(matchView, /class="five-match-field" aria-label="Campo partita 5v5"/);
assert.match(matchView, /fiveMatchField\(userPlayersBySlot, run\.fiveVFive\.formation, "user"\)/);
assert.match(matchView, /fiveMatchField\(opponentPlayersBySlot, match\.opponentFormation, "opponent"\)/);
assert.match(matchView, /data-five-match-tab="user"/);
assert.match(matchView, /data-five-match-tab="opponent"/);
assert.match(app, /formation === "1-2-1"|"1-2-1"/);
assert.match(app, /"1-1-2"/);
assert.doesNotMatch(matchView, /Snapshot pronta|Finalizzazione protetta|result-badges/);
assert.doesNotMatch(matchView, /scrollIntoView/);
assert.match(matchView, /getElementById\("simulate-boss-match"\)\.addEventListener/);
assert.match(matchView, /getElementById\("edit-five-team"\)\.addEventListener/);
assert.match(matchView, /querySelector\("\.five-match-values-button"\).*addEventListener/);
assert.match(css, /\.five-match-screen \.five-match-field \{ height:clamp\(300px,32vw,350px\); min-height:0; overflow:hidden; \}/);
assert.match(css, /\.five-match-screen \.five-match-field-side--mobile \{[^}]*height:100%;[^}]*padding:10px 8px/s);

console.log('five-v-five-match-ui-regression-test: ok');
