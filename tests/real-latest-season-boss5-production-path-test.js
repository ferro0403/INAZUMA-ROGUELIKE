"use strict";
const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");
const season = require("../data/ORION_season_compact.json");
const run = { runId: "orion-boss-five", seasonId: "orion", lives: 3, bossIndex: 0, phase: "map", completedBossIds: [], unlockedTeamIds: [], inventory: [], roster: [], lineup: [], bench: [], statistics: {} };
const storage = new BudgetStorage(2_000_000);
let runtime = load(storage, { run, seasonDb: season });
function winNext(rt) {
  const current = rt.seam.getRun(), boss = season.bossOrder[current.bossIndex];
  current.currentZone = { nodes: [{ id: `node-${boss.teamId}`, type: "boss" }], completedNodeIds: [] };
  current.activeMatch = { matchId: `match-${boss.teamId}`, type: "boss", bossIndex: current.bossIndex, nodeId: `node-${boss.teamId}`, state: "playing", simulation: { resolutionApplied: false, score: { user: 1, opponent: 0 } } };
  rt.seam.setContext({ run: current, seasonDb: season });
  rt.seam.completeBossMatch("victory"); rt.seam.resolvePendingRunFlow({ clearMatch: true });
  while (rt.seam.getRun().postBossFlow?.remainingRewards > 0) rt.seam.advanceBossReward();
}
for (let completed = 0; completed < 4; completed++) winNext(runtime);
assert.equal(runtime.canonical.bossIndex, 4);
runtime = load(storage, { run: runtime.canonical, seasonDb: season });
runtime.seam.continueAfterMatch({ preventDefault() {} });
runtime.seam.resolvePendingRunFlow({ clearMatch: true });
assert.equal(runtime.seam.getRun().currentZone.zoneIndex, 4);
assert.equal(season.bossOrder[4].teamId, "avenging_acrobats");
winNext(runtime);
runtime = load(storage, { run: runtime.canonical, seasonDb: season });
assert(runtime.canonical.bossIndex > 4);
assert(runtime.canonical.completedBossIds.includes("avenging_acrobats"));
console.log("true boss 4 to boss 5 reload/continue app seam: ok");
