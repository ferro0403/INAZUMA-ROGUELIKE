'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const values = new Map();
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const context = {
  console,
  localStorage,
  SEASON1_CONFIG: { saveKey: 'test-run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
  SeasonRegistry: { normalizeSeasonId: (id) => id || 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }, { id: 'ie2' }, { id: 'ie1_s2' }] },
  DevelopmentV2: { read: () => ({ players: {} }) },
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('js/run-statistics.js', 'utf8'), context);

function lose(lives, type) {
  values.clear();
  const run = context.RunState.createRun({}, 'ie1');
  run.lives = lives;
  run.currentZone = { currentNodeId: 'return-node', pendingNodeId: 'match-node' };
  run.activeMatch = { type, previousNodeId: 'return-node' };
  context.RunState.restoreAfterLoss(run, 'return-node', type);
  return run;
}

for (const [before, after, gameOver] of [[2, 1.5, false], [1.5, 1, false], [1, 0.5, false], [0.5, 0, true]]) {
  const run = lose(before, 'five_v_five');
  assert.strictEqual(run.lives, after, `5v5: ${before} -> ${after}`);
  assert.strictEqual(run.gameOver, gameOver, `5v5 game over at ${after}`);
}
for (const type of ['boss', 'special_match']) {
  for (const [before, after, gameOver] of [[2, 1, false], [1.5, 0.5, false], [1, 0, true], [0.5, 0, true]]) {
    const run = lose(before, type);
    assert.strictEqual(run.lives, after, `${type}: ${before} -> ${after}`);
    assert.strictEqual(run.gameOver, gameOver, `${type} game over at ${after}`);
  }
}
assert.strictEqual(context.RunState.getLifeDamageForMatch('five_v_five'), 0.5);
assert.strictEqual(context.RunState.getLifeDamageForMatch('boss'), 1);
assert.strictEqual(context.RunState.getLifeDamageForMatch('special_match'), 1);
assert.strictEqual(context.RunState.getLifeDamageForMatch('unknown'), 1, 'unknown match types preserve the old damage');

const statisticsRun = context.RunState.createRun({}, 'ie1');
const lineupSnapshot = [{ playerId: '1', name: 'Mark', position: 'FW' }];
context.RunStatistics.applyCompletedMatchStatistics(statisticsRun, { matchId: 'five-loss', matchType: 'five_v_five', result: 'defeat', score: { user: 0, opponent: 1 }, lineupSnapshot });
context.RunStatistics.applyCompletedMatchStatistics(statisticsRun, { matchId: 'boss-loss', matchType: 'boss', result: 'defeat', score: { user: 0, opponent: 1 }, lineupSnapshot });
assert.strictEqual(statisticsRun.statistics.livesLost, 1.5, 'run statistics use the same centralized damage values');

for (const [before, after] of [[0.5, 1.5], [1, 2], [1.5, 2], [2, 2]]) {
  assert.strictEqual(Math.min(context.RunState.runLivesLimit(), before + 1), after, `bandage: ${before} -> ${after}`);
}

for (const seasonId of ['ie1', 'ie2', 'ie1_s2']) {
  for (const lives of [1.5, 0.5]) {
    const run = context.RunState.createRun({}, seasonId);
    run.lives = lives;
    context.RunState.save(run, { replaceRun: true });
    assert.strictEqual(context.RunState.load(seasonId, { readOnly: true }).lives, lives, `${seasonId} persists ${lives}`);
  }
}

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
assert.match(app, /remaining >= 0\.5 \? "half"/, 'UI selects a half-heart state');
assert.match(css, /\.life-heart--half::before[^}]*width: 50%/s, 'half heart is visually clipped');
assert.match(app, /restoreAfterLoss\(run, match\.previousNodeId, match\.type\)/, 'real matches use their type for centralized damage');

console.log('half-heart-lives-test: damage, game over, bandage, persistence and UI OK');
