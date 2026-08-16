'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const pickerBridge = fs.readFileSync('js/five-formation-floating-picker.js', 'utf8');
const pickerCss = fs.readFileSync('css/five-formation-floating-picker.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

function sourceBetween(startToken, endToken) {
  const start = app.indexOf(startToken);
  const end = app.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `${startToken} source is available`);
  return app.slice(start, end);
}

const prematchPicker = sourceBetween('function openFiveMatchPlayerSwap', 'function fiveMatchStatAverage');
const sharedRenderer = sourceBetween('function renderFivePlayerPicker', 'function syncFiveSlotSelection');
const generalEditor = sourceBetween('function renderFiveVFive(options = {})', 'function renderInventory');
const snapshotSource = sourceBetween('function ensureMatchPreview', 'function simulationScoreArray');

// Both contexts render the exact same picker markup and compact roster cards.
assert.match(prematchPicker, /renderFivePlayerPicker\(\{ selectedSlot: slotKey, selectedRole: slot\.role \}\)/, 'prematch calls the shared picker renderer');
assert.match(generalEditor, /renderFivePlayerPicker\(\{ selectedSlot, selectedRole, filter \}\)/, 'general formation calls the shared picker renderer');
for (const token of ['panel five-selector', 'five-roster-list', 'fiveRosterCard(entry, selectedSlot)', 'CAMBIA GIOCATORE · SLOT', 'GIOCATORE ATTUALE', 'SOSTITUISCI CON']) {
  assert.ok(sharedRenderer.includes(token), `shared renderer owns ${token}`);
}
assert.match(pickerBridge, /FiveFormationFloatingPicker = Object\.freeze[\s\S]*prepare: preparePicker[\s\S]*close: closePreparedPicker/, 'the same floating behavior and close control are exposed to prematch');
assert.match(pickerCss, /:is\(\.five-screen, \.five-match-screen\) \.five-selector\.five-selector-floating/, 'the existing picker CSS is shared across both screens');

// The rejected full-screen modal and its dedicated stylesheet are gone.
assert.doesNotMatch(app, /five-match-player-swap-modal|five-match-swap-dialog|data-five-match-swap-player|SOSTITUISCI<\/button>/, 'prematch no longer has separate modal markup');
assert.ok(!fs.existsSync('css/five-match-player-swap-modal.css'), 'dedicated modal CSS is removed');
assert.ok(!index.includes('five-match-player-swap-modal.css'), 'dedicated modal CSS is not loaded');

// Context and canonical action remain unchanged.
assert.match(prematchPicker, /match\?\.state === "pre-match"[\s\S]*match\.simulation\.state === "pre-match"/, 'editing is restricted to an unfrozen prematch');
assert.match(prematchPicker, /FiveVFive\.assign\(run, slotKey, button\.dataset\.fivePlayer, fiveRoleForPlayerId\)/, 'assignment uses the canonical helper');
assert.match(prematchPicker, /RunState\.save\(run\)[\s\S]*renderMatch\(\)[\s\S]*restorePageScroll/, 'swap saves, rerenders values, and restores scroll');
assert.match(sharedRenderer, /fiveOverallForPlayerId\(b\.playerId\) - fiveOverallForPlayerId\(a\.playerId\)/, 'shared candidates sort by effective current overall');
assert.match(snapshotSource, /lineupSignature === teams\.userSnapshot\.lineupSignature/, 'prematch previews refresh after a lineup change');
assert.match(snapshotSource, /existingState !== "pre-match"[\s\S]*return match\.simulation/, 'a frozen simulation keeps its snapshot');

console.log('five-match-player-swap-test: shared picker, canonical assignment, frozen state and removed modal OK');
