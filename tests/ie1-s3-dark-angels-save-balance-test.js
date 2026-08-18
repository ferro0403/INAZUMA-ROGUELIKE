'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const season = JSON.parse(fs.readFileSync('data/IE1_S3_season_compact.json', 'utf8'));
const context = {
  console,
  SEASON1_CONFIG: {
    nodeCounts: [2, 3, 3, 2, 3, 2],
    disabledNodeTypes: [],
    legendaryUnlockBossIndex: 4,
    nodeWeights: { five_v_five: 32, item: 15, pull_free_agents: 17, pull_unlocked_teams: 8, pull_legendary: 3, trade: 10, random: 15 },
    stageNodeWeightTiers: [
      { minStage: 1, maxStage: 3, pull_free_agents: 17, pull_unlocked_teams: 8 },
      { minStage: 4, maxStage: 4, pull_free_agents: 8, pull_unlocked_teams: 17 },
      { minStage: 5, maxStage: 5, pull_free_agents: 7, pull_unlocked_teams: 16, pull_legendary: 5 },
      { minStage: 6, maxStage: 7, pull_free_agents: 4, pull_unlocked_teams: 19, pull_legendary: 5 },
      { minStage: 8, maxStage: 10, pull_free_agents: 2, pull_unlocked_teams: 20, pull_legendary: 6 },
    ],
  },
  SeasonRegistry: { database: id => id === 'ie1_s3' ? season : null },
};
context.globalThis = context;
vm.createContext(context);
for (const file of ['js/draft.js', 'js/map-generator.js', 'js/recruitment-pool.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const bosses = season.bossOrder;
const ids = bosses.map(boss => boss.teamId);
const completeBefore = index => ids.slice(0, index);
const makeZone = (index, bossId = bosses[index]?.teamId) => ({
  bossIndex: index, bossId, marker: 'preserve-me', nodes: [], edges: [], completedNodeIds: [], path: [],
});
const runtimeFields = { unlockedTeamIds: [], randomEventHistory: [] };
const normalize = run => context.MapEngine.ensureCurrentZone(run, season);

assert.strictEqual(bosses.length, 12);
assert.deepStrictEqual(bosses.map(boss => [boss.teamId, boss.order, boss.bossLevel]).slice(7), [
  ['the_kingdom', 8, 15], ['dark_angels', 9, 16], ['little_gigantes', 10, 17],
  ['team_ogre', 11, 19], ['inazuma_national', 12, 20],
]);

// A: a coherent pre-Kingdom save remains byte-for-byte on its current zone.
const beforeKingdomZone = makeZone(6);
const beforeKingdom = { ...runtimeFields, runId: 'A', seasonId: 'ie1_s3', bossIndex: 6, completedBossIds: completeBefore(6), currentZone: beforeKingdomZone };
let result = normalize(beforeKingdom);
assert.deepStrictEqual([result.changed, result.generated, result.boss.teamId], [false, false, 'orpheus']);
assert.strictEqual(beforeKingdom.bossIndex, 6);
assert.strictEqual(beforeKingdom.currentZone, beforeKingdomZone);

const legacyCases = [
  ['B-post-kingdom', 8, 'little_gigantes', completeBefore(8)],
  ['C-little-complete', 9, 'team_ogre', [...completeBefore(8), 'little_gigantes']],
  ['D-ogre-complete', 10, 'inazuma_national', [...completeBefore(8), 'little_gigantes', 'team_ogre']],
  ['E-reached-final', 10, 'inazuma_national', [...completeBefore(8), 'little_gigantes', 'team_ogre']],
];
for (const [runId, oldIndex, oldBossId, completedBossIds] of legacyCases) {
  const run = { ...runtimeFields, runId, seasonId: 'ie1_s3', bossIndex: oldIndex, completedBossIds, currentZone: makeZone(oldIndex, oldBossId), retained: { lives: 1, inventory: ['sentinel'] } };
  const retained = run.retained;
  result = normalize(run);
  assert(result.generated, `${runId}: stale zone must be regenerated`);
  assert.strictEqual(run.bossIndex, 8, `${runId}: first missing boss must win over the old index`);
  assert.strictEqual(run.currentZone.bossId, 'dark_angels');
  assert.strictEqual(run.currentZone.bossIndex, 8);
  assert.strictEqual(run.retained, retained, `${runId}: unrelated run state must be preserved`);
}

// F plus idempotency: a coherent post-patch zone is retained on every pass.
const coherentZone = makeZone(8, 'dark_angels');
const coherent = { ...runtimeFields, runId: 'F', seasonId: 'ie1_s3', bossIndex: 8, completedBossIds: completeBefore(8), currentZone: coherentZone };
result = normalize(coherent);
assert.deepStrictEqual([result.changed, result.generated, result.boss.teamId], [false, false, 'dark_angels']);
const once = JSON.stringify(coherent);
result = normalize(coherent);
assert.deepStrictEqual([result.changed, result.generated, result.boss.teamId], [false, false, 'dark_angels']);
assert.strictEqual(JSON.stringify(coherent), once);
assert.strictEqual(coherent.currentZone, coherentZone);

// Same numeric index with the legacy boss id, and a fully stale index/id pair, are both invalid.
for (const zone of [makeZone(8, 'little_gigantes'), makeZone(9, 'little_gigantes')]) {
  const run = { ...runtimeFields, runId: `zone-${zone.bossIndex}`, seasonId: 'ie1_s3', bossIndex: 8, completedBossIds: completeBefore(8), currentZone: zone };
  assert(normalize(run).generated);
  assert.notStrictEqual(run.currentZone, zone);
  assert.deepStrictEqual([run.currentZone.bossIndex, run.currentZone.bossId], [8, 'dark_angels']);
}

const expectedLate = { pull_free_agents: 2, pull_unlocked_teams: 20, pull_legendary: 6 };
const expectedBase = { pull_free_agents: 17, pull_unlocked_teams: 8, pull_legendary: 3 };
for (const [index, effectiveStage, expected] of [[8, 9, expectedLate], [9, 10, expectedLate], [10, 10, expectedLate], [11, 11, expectedBase]]) {
  const run = { seasonId: 'ie1_s3', bossIndex: index };
  assert.strictEqual(context.MapEngine.effectiveNodeWeightStage(run), effectiveStage);
  const weights = context.MapEngine.nodeWeightsForStage(run);
  assert.deepStrictEqual(Object.fromEntries(Object.keys(expected).map(key => [key, weights[key]])), expected);
}

const thresholds = season.recruitmentRules.pullFreeAgents.minimumFinalOverallByBossIndex;
assert.deepStrictEqual(Array.from(thresholds), [72, 73, 74, 75, 76, 77, 78, 79, 80, 80, 81, 82]);
const eligible = (overall, index) => context.RecruitmentPoolRuntime.eligibleForSeason3FreeAgentPull({ sourceKind: 'global_free_agent', finalOverall: overall }, index, season);
for (const [index, threshold] of [[8, 80], [9, 80], [10, 81], [11, 82]]) {
  assert(!eligible(threshold - 1, index), `index ${index}: ${threshold - 1} must be rejected`);
  assert(eligible(threshold, index), `index ${index}: ${threshold} must be accepted`);
}

console.log('ie1-s3-dark-angels-save-balance-test: behavioral saves, zones, map weights and pull thresholds OK');
