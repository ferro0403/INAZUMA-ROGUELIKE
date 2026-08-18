'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const season = read('data/IE1_S3_season_compact.json');
const source = read('data/DARK_ANGELS_team.json')[0];
const lineup = read('data/DARK_ANGELS_lineup.json').teams[0];

(async () => {
  const registryContext = { console, fetch: async () => ({ ok: true, json: async () => season }) };
  registryContext.globalThis = registryContext;
  vm.createContext(registryContext);
  vm.runInContext(fs.readFileSync('js/season-registry.js', 'utf8'), registryContext);
  assert.strictEqual(await registryContext.SeasonRegistry.loadDatabase('ie1_s3'), season);

  const dark = season.bossOrder.find(boss => boss.teamId === 'dark_angels');
  assert.deepStrictEqual([dark.order, dark.bossLevel, dark.bossFormation], [9, 16, '4-2-4']);
  assert.deepStrictEqual(dark.startingXIPlayerIds, lineup.startingXI);
  assert.deepStrictEqual(dark.rewardPoolPlayerIds, source.players.map(player => String(player.playerId)));
  assert.deepStrictEqual(season.bossOrder.slice(7).map(boss => [boss.teamId, boss.order, boss.bossLevel]), [
    ['the_kingdom', 8, 15], ['dark_angels', 9, 16], ['little_gigantes', 10, 17],
    ['team_ogre', 11, 19], ['inazuma_national', 12, 20],
  ]);

  const mapContext = {
    console,
    SEASON1_CONFIG: {
      nodeCounts: [2, 3, 3, 2, 3, 2], disabledNodeTypes: [],
      nodeWeights: { five_v_five: 1 }, stageNodeWeightTiers: [], legendaryUnlockBossIndex: 4,
    },
    SeasonRegistry: { database: () => season },
  };
  mapContext.globalThis = mapContext;
  vm.createContext(mapContext);
  vm.runInContext(fs.readFileSync('js/draft.js', 'utf8'), mapContext);
  vm.runInContext(fs.readFileSync('js/map-generator.js', 'utf8'), mapContext);
  for (const bossIndex of [10, 11]) {
    const run = { runId: 'dark-angels-stage-regression', seasonId: 'ie1_s3', bossIndex, unlockedTeamIds: [], randomEventHistory: [] };
    const zone = mapContext.MapEngine.generate(run, season.bossOrder[bossIndex]);
    assert.strictEqual(zone.bossIndex, bossIndex);
    assert.strictEqual(zone.bossId, season.bossOrder[bossIndex].teamId);
    assert(zone.nodes.some(node => node.type === 'boss' && node.bossId === zone.bossId));
  }

  for (const file of ['data/IE1_season_compact.json', 'data/IE1_S2_season_compact.json', 'data/IE2_season_compact.json']) assert.doesNotThrow(() => read(file));
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /bossIndex >= seasonDb\.bossOrder\.length - 1/);
  assert.match(app, /run\.bossIndex >= seasonDb\.bossOrder\.length/);
  assert.match(app, /firstIncompleteBoss = seasonDb\.bossOrder\.findIndex/);
  console.log('ie1-s3-dark-angels-regression-test: campaign, rewards, maps, completion and saves OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
