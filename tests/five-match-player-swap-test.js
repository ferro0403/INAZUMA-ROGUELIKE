'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8') + '\n' + fs.readFileSync('js/match/match-controller.js', 'utf8');
const fiveView = fs.readFileSync('js/five-v-five/five-v-five-view.js', 'utf8');
const pickerBridge = fs.readFileSync('js/five-formation-floating-picker.js', 'utf8');
const pickerCss = fs.readFileSync('css/five-formation-floating-picker.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

function sourceBetween(startToken, endToken, source = app) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `${startToken} source is available`);
  return source.slice(start, end);
}

const prematchPicker = sourceBetween('function openFiveMatchPlayerSwap', 'function fiveMatchStatAverage');
const sharedRenderer = sourceBetween('function renderFivePlayerPicker', 'function syncFiveSlotSelection', fiveView);
const generalEditor = sourceBetween('function renderFiveVFive(options = {})', 'return { render:', fiveView);
const matchSource = fs.readFileSync('js/match/match-controller.js', 'utf8');
const snapshotSource = sourceBetween('function ensureMatchPreview', 'function simulationScoreArray', matchSource);

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

// Context and canonical action remain unchanged, but persistence is now transactional.
assert.match(prematchPicker, /match\?\.state === "pre-match"[\s\S]*match\.simulation\.state === "pre-match"/, 'editing is restricted to an unfrozen prematch');
assert.match(prematchPicker, /commitFiveEditorMutation\("five-match-quick-swap"[\s\S]*FiveVFive\.assign\(current, slotKey, playerId, \(id\) => fiveRoleForPlayerId\(id, current\)\)/, 'assignment uses the canonical helper on the transactional current run');
assert.doesNotMatch(prematchPicker, /RunState\.save\(run\)/, 'quick swap has no direct nested RunState save');
assert.match(prematchPicker, /onCommitted:[\s\S]*renderMatch\(\)[\s\S]*restorePageScroll/, 'swap rerenders only after commit and restores scroll');
assert.match(sharedRenderer, /fiveOverallForPlayerId\(b\.playerId\) - fiveOverallForPlayerId\(a\.playerId\)/, 'shared candidates sort by effective current overall');
assert.match(snapshotSource, /lineupSignature === teams\.userSnapshot\.lineupSignature/, 'prematch previews refresh after a lineup change');
assert.match(snapshotSource, /existingState !== "pre-match"[\s\S]*return match\.simulation/, 'a frozen simulation keeps its snapshot');

console.log('five-match-player-swap-test: shared picker, transactional canonical assignment, frozen state and removed modal OK');
