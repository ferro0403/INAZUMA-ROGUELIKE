'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const simulatorContext = { console };
simulatorContext.globalThis = simulatorContext;
vm.runInNewContext(fs.readFileSync('js/match-simulator-config.js', 'utf8'), simulatorContext);
vm.runInNewContext(fs.readFileSync('js/match-simulator.js', 'utf8'), simulatorContext);
const { applyConsecutiveLossProtection: protect, determineUserWins } = simulatorContext.MatchSimulator;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

[[20, 0, 20], [50, 0, 50], [80, 0, 80], [20, 1, 80], [40, 1, 85], [50, 1, 87.5], [70, 1, 92.5], [80, 1, 95], [0, 2, 100], [20, 2, 100], [50, 2, 100], [100, 2, 100], [50, 3, 100]].forEach(([chance, streak, expected]) => close(protect(chance, streak), expected));
[[ -1, 0, 0], [101, 0, 100], ['50', 1, 87.5], ['bad', 0, 0], [50, -1, 50], [50, undefined, 50], [50, 1.9, 87.5], [50, '1', 87.5], [50, 'bad', 50], [50, 99, 100]].forEach(([chance, streak, expected]) => close(protect(chance, streak), expected));

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function rate(streak) {
  const rng = seeded(12345);
  const chance = protect(50, streak);
  let wins = 0;
  for (let index = 0; index < 10000; index += 1) wins += determineUserWins(chance, rng) ? 1 : 0;
  return wins / 10000;
}
assert.ok(Math.abs(rate(0) - 0.5) < 0.02, 'unprotected rate should approach 50%');
assert.ok(Math.abs(rate(1) - 0.875) < 0.02, 'one-loss rate should approach 87.5%');
assert.strictEqual(rate(2), 1, 'two losses must guarantee victory');

const values = new Map();
const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
const runContext = {
  console, localStorage,
  SEASON1_CONFIG: { saveKey: 'inazumaRoguelikeSeason1Run_v2', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
  SeasonRegistry: { normalizeSeasonId: (id) => id || 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }, { id: 'ie2' }] },
  DevelopmentV2: { read: () => ({ players: {} }) },
};
runContext.globalThis = runContext;
vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), runContext);
const ie1 = runContext.RunState.createRun({}, 'ie1');
const ie2 = runContext.RunState.createRun({}, 'ie2');
assert.strictEqual(ie1.consecutiveLosses, 0);
assert.strictEqual(ie2.consecutiveLosses, 0);
ie1.consecutiveLosses = 1;
runContext.RunState.save(ie1);
runContext.RunState.save(ie2);
assert.strictEqual(runContext.RunState.load('ie1', { readOnly: true }).consecutiveLosses, 1);
assert.strictEqual(runContext.RunState.load('ie2', { readOnly: true }).consecutiveLosses, 0);
const normalize = runContext.RunStorage.migrate;
const legacy = JSON.parse(JSON.stringify(ie2));
delete legacy.consecutiveLosses;
assert.strictEqual(normalize(legacy).consecutiveLosses, 0);
for (const [input, expected] of [[null, 0], [-1, 0], ['bad', 0], [1.9, 1], ['2', 2], [8, 2]]) {
  const candidate = JSON.parse(JSON.stringify(ie2));
  candidate.consecutiveLosses = input;
  const once = normalize(candidate);
  assert.strictEqual(once.consecutiveLosses, expected);
  assert.strictEqual(normalize(once).consecutiveLosses, expected, 'normalization must be idempotent');
}
ie1.lives = 1;
ie1.consecutiveLosses = 2;
ie1.lives = Math.min(2, ie1.lives + 1); // Bendaggio sportivo behavior: only the life changes.
assert.strictEqual(ie1.consecutiveLosses, 2);
assert.strictEqual(runContext.RunState.createRun({}, 'ie1').consecutiveLosses, 0, 'a replacement run starts clean');

const app = fs.readFileSync('js/app.js', 'utf8');
assert.match(app, /function applyConsecutiveLossResult\(result\) \{\s*run\.consecutiveLosses = result === "victory" \? 0 : Math\.min\(2, run\.consecutiveLosses \+ 1\)/, 'completed results must update the streak centrally');
assert.match(app, /simulation\.resolutionApplied = true;[\s\S]{0,400}applyConsecutiveLossResult\(result\)/, 'the idempotent resolution guard must precede streak updates');
assert.match(app, /simulate\(\{[^}]*consecutiveLosses: run\.consecutiveLosses/, 'real match snapshots must pass the saved streak into the simulator');
assert.match(app, /formatMatchProbability\(simPreview\.probabilities\?\.userChance\)/, '5v5 UI must show the effective chance');
assert.match(app, /formatMatchProbability\(simPreview\.probabilities\.userChance\)/, 'boss UI must show the effective chance');
assert.doesNotMatch(app.slice(app.indexOf('id="use-item"'), app.indexOf('function renderGameOver')), /consecutiveLosses\s*=/, 'life recovery must not reset the streak');

console.log('consecutive-loss-protection-test: ok');
