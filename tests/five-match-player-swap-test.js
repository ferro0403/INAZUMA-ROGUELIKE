'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/five-match-player-swap-modal.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

function sourceBetween(startToken, endToken) {
  const start = app.indexOf(startToken);
  const end = app.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `${startToken} source is available`);
  return app.slice(start, end);
}

const prematch = sourceBetween('if (!isBoss && !isSpecial)', 'const userPlayers = userTeamPlayers()');
const generalEditor = sourceBetween('function renderFiveVFive(options = {})', 'function renderInventory');
const candidatesSource = sourceBetween('function fiveMatchSwapCandidates', 'function fiveMatchSwapPlayerMarkup');
const snapshotSource = sourceBetween('function ensureMatchPreview', 'function simulationScoreArray');

// Context separation: only the match renderer binds the new flow.
assert.match(prematch, /side === "user" && openFiveMatchPlayerSwap\(slotKey, match\)/, 'user pitch cards open the swap dialog');
assert.match(prematch, /const players = side === "user" \? userPlayersBySlot : opponentPlayersBySlot/, 'opponents retain the informational detail flow');
assert.doesNotMatch(generalEditor, /openFiveMatchPlayerSwap|five-match-player-swap-modal|data-five-match-swap-player/, 'the general 5v5 editor is unchanged by the prematch modal');

assert.match(app, /data-five-match-slot="\$\{escapeHtml\(slot\.key\)\}"/, 'filled and empty pitch cards identify their real slot');
assert.match(app, /role="dialog" aria-modal="true" aria-labelledby="five-match-swap-title"/, 'dialog semantics and labelled title are present');
assert.match(app, /event\.key === "Escape"[\s\S]*closeModal\(\)/, 'Escape closes the swap modal');
assert.match(app, /match\?\.state === "pre-match"[\s\S]*match\.simulation\.state === "pre-match"/, 'editing is restricted to an unfrozen prematch');
assert.match(app, /FiveVFive\.assign\(run, slotKey, button\.dataset\.fiveMatchSwapPlayer, fiveRoleForPlayerId\)/, 'assignment uses the canonical 5v5 helper and effective role resolver');
assert.match(app, /RunState\.save\(run\)[\s\S]*renderMatch\(\)[\s\S]*restorePageScroll/, 'a swap saves, rerenders the match values, and restores scroll');
assert.match(snapshotSource, /lineupSignature === teams\.userSnapshot\.lineupSignature/, 'prematch previews refresh when the selected lineup changes');
assert.match(snapshotSource, /existingState !== "pre-match"[\s\S]*return match\.simulation/, 'a frozen simulation keeps its existing snapshot');

// Candidate policy: effective role, current-player exclusion, effective OVR, deterministic tie-breaks.
const players = {
  current: { playerId: 'current', name: 'Current', overall: 70 },
  low: { playerId: 'low', name: 'Zeta', overall: 72 },
  highB: { playerId: 'highB', name: 'Beta', overall: 90 },
  highA: { playerId: 'highA', name: 'Alfa', overall: 90 },
  wrong: { playerId: 'wrong', name: 'Wrong', overall: 99 },
};
const context = {
  run: { fiveVFive: { formation: 'test', slots: { MF1: 'current' } }, roster: Object.keys(players).map((playerId) => ({ playerId })) },
  global: { FiveVFive: { formationById: () => ({ slots: [{ key: 'MF1', role: 'MF' }] }) } },
  resolvedRosterPlayer: (id) => players[id],
  effectiveRosterRole: (id) => id === 'wrong' ? 'DF' : 'MF',
};
vm.runInNewContext(`${candidatesSource}; this.result = fiveMatchSwapCandidates('MF1');`, context);
assert.deepStrictEqual(Array.from(context.result, ({ entry }) => entry.playerId), ['highA', 'highB', 'low'], 'candidates are same-role only and sorted by effective OVR then name');

for (const token of ['TITOLARE ATTUALE', 'SOSTITUISCI CON', 'Slot ${escapeHtml(slot.key)} · ${escapeHtml(slot.role)}']) assert.ok(app.includes(token), `modal includes ${token}`);
assert.match(css, /width: calc\(100vw - 12px\)[\s\S]*100dvh[\s\S]*env\(safe-area-inset/, 'mobile modal is near-full-screen and safe-area aware');
assert.match(css, /min-height: 44px/, 'candidate actions meet the mobile touch target');
assert.ok(index.includes('css/five-match-player-swap-modal.css'), 'only the dedicated prematch stylesheet is loaded');

console.log('five-match-player-swap-test: context, candidates, assignment, snapshots and responsive dialog OK');
