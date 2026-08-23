"use strict";
const assert = require("assert");
const data = require("../data/IE1_season_compact.json");
const { createCrashHarness, once } = require("./helpers/crash-harness");

const index = 8;
const boss = data.bossOrder[index];
assert.ok(boss, "the ninth (1-based) boss exists");
const previous = data.bossOrder.slice(0, index).map((entry) => String(entry.teamId));
const run = { runId: "boss9-regression", lives: 2, bossIndex: index, completedBossIds: previous, unlockedTeamIds: [...previous], roster: ["starter"], phase: "map", currentZone: { bossIndex: index, currentNodeId: "boss-9" }, postBossFlow: { status: "next-zone", bossIndex: index, remainingRewards: 0 }, pendingBossVictory: { bossIndex: index, bossId: boss.teamId, rewardsRemaining: 0 }, generation: 90, commitId: "before-boss-9" };
once(run.completedBossIds, String(boss.teamId)); once(run.unlockedTeamIds, String(boss.teamId)); once(run.roster, "boss9-reward");
run.bossIndex = index + 1; run.currentZone = { bossIndex: index + 1, currentNodeId: "zone-10-start" }; run.postBossFlow = run.pendingBossVictory = null; run.generation = 91; run.commitId = "after-boss-9";
const harness = createCrashHarness(run); harness.save(run, "boss9-next-zone");
for (let reopen = 1; reopen <= 2; reopen += 1) {
  const fresh = harness.fresh();
  assert.strictEqual(fresh.bossIndex, 9); assert.strictEqual(fresh.completedBossIds.filter((id) => id === String(boss.teamId)).length, 1);
  assert.strictEqual(fresh.postBossFlow, null); assert.ok(fresh.roster.includes("boss9-reward")); assert.strictEqual(fresh.lives, 2);
  assert.strictEqual(fresh.currentZone.bossIndex, 9); assert.strictEqual(fresh.generation, 91); assert.strictEqual(fresh.commitId, "after-boss-9");
  harness.save(fresh, `home-continue-${reopen}`);
}
console.log(`boss9-reopen-regression-test: ${boss.teamName} (${boss.teamId}), index 8 / position 9, two reopens OK`);
