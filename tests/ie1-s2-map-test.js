const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const database = JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json", "utf8"));
const context = { console, SEASON1_CONFIG: { nodeCounts: [2, 3, 3, 2, 3, 2], disabledNodeTypes: [], nodeWeights: { five_v_five: 1 }, stageNodeWeightTiers: [], legendaryUnlockBossIndex: 4 } };
context.globalThis = context;
context.SeasonRegistry = { database: () => database };
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/draft.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/map-generator.js", "utf8"), context);
const expected = new Set([1, 2, 4, 5, 6, 8, 9]);
database.bossOrder.forEach((boss, bossIndex) => {
  const run = { runId: "stable-seed", seasonId: "ie1_s2", bossIndex, unlockedTeamIds: [], randomEventHistory: [] };
  const first = context.MapEngine.generate(run, boss);
  const second = context.MapEngine.generate(run, boss);
  assert.deepEqual(first, second);
  const specials = first.nodes.filter((node) => node.type === "special_match");
  assert.equal(specials.length, expected.has(bossIndex + 1) ? 1 : 0);
  if (specials.length) {
    assert(database.specialMatches.some((match) => match.specialMatchId === specials[0].specialMatchId));
    assert(first.edges.some((edge) => edge[1] === specials[0].id));
    assert(first.edges.some((edge) => edge[0] === specials[0].id));
  }
});
console.log("IE1 S2 deterministic special match map nodes: OK");
