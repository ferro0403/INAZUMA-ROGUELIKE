'use strict';

const assert = require('assert');
const fs = require('fs');

require('../js/season1-config.js');

const app = fs.readFileSync('js/app.js', 'utf8');
const pool = global.SEASON1_CONFIG.itemPool;
const bandage = pool.find((item) => item.id === 'medical_kit');

assert.ok(bandage, 'sports bandage remains in the item pool');
assert.strictEqual(bandage.name, 'Bendaggio sportivo');
assert.strictEqual(bandage.weight, 3, 'sports bandage has the approved rare weight');
assert.strictEqual(bandage.effect, 'restore_life', 'sports bandage still restores lives');
assert.strictEqual(bandage.amount, 1, 'sports bandage still restores exactly one life');
assert.strictEqual(global.SEASON1_CONFIG.startingLives, 2, 'runs still start with two lives');
assert.strictEqual(global.SEASON1_CONFIG.maxRunLives, 2, 'sports bandage cannot exceed two lives');

const expectedOtherWeights = {
  energy_drink: 10,
  training_manual: 12,
  scout_token: 9,
  intensive_training: 7,
  lucky_charm: 3,
  boots_attack: 8,
  boots_control: 8,
  boots_defense: 8,
  keeper_gloves: 8,
  grit_band: 8,
  physical_band: 8,
  speed_necklace: 8,
  stamina_necklace: 8,
};
assert.deepStrictEqual(
  Object.fromEntries(pool.filter((item) => item.id !== 'medical_kit').map((item) => [item.id, item.weight])),
  expectedOtherWeights,
  'all other item weights remain unchanged'
);

const weightedSource = app.slice(
  app.indexOf('function weightedItemCandidates'),
  app.indexOf('\n  function receiveItem', app.indexOf('function weightedItemCandidates'))
);
const weightedItemCandidates = Function('global', `return (${weightedSource});`)(global);
for (const roll of [0, 0.1, 0.25, 0.5, 0.75, 0.999999]) {
  const candidates = weightedItemCandidates(() => roll, 3);
  assert.strictEqual(candidates.length, 3, 'item nodes still offer three candidates');
  assert.strictEqual(new Set(candidates.map((item) => item.id)).size, 3, 'item candidates remain unique');
}

const rewardSource = app.slice(
  app.indexOf('function itemRewardCandidates'),
  app.indexOf('\n  function itemRewardOwnedQuantity', app.indexOf('function itemRewardCandidates'))
);
assert.match(rewardSource, /existing\.candidateIds[\s\S]*if \(savedCandidates\.length\) return savedCandidates;/, 'saved candidates are reused after refresh');
assert.match(rewardSource, /weightedItemCandidates\(random, 3\)/, 'new item rewards still draw three candidates');
assert.match(rewardSource, /run\.pendingItemReward = \{[\s\S]*candidateIds,[\s\S]*\};[\s\S]*global\.RunState\.save\(run\)/, 'candidate IDs remain persisted');

const restoreLifeSource = app.slice(
  app.indexOf('if (item.effect === "restore_life")'),
  app.indexOf('if (item.effect === "lucky_pull")', app.indexOf('if (item.effect === "restore_life")'))
);
assert.match(restoreLifeSource, /Math\.min\(maxRunLives, run\.lives \+ Number\(item\.amount \|\| 1\)\)/, 'life restoration remains capped by maxRunLives');

console.log('sports-bandage-weight-test: weight, effect, cap, choices and persistence OK');
