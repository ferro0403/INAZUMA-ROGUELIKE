"use strict";

const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");
const season = require("../data/IE2_season_compact.json");

function resultRun(state, log) {
  const boss = season.bossOrder[0];
  return {
    runId: `boss-result-${state || "legacy"}`, seasonId: season.seasonId || "ie2", phase: "match",
    lives: 2, bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], inventory: [], roster: [], lineup: [], bench: [], formationId: "4-3-3",
    teamIdentity: { name: "Raimon" }, statistics: {}, currentZone: { nodes: [{ id: "boss-node", type: "boss" }], path: [], completedNodeIds: [] },
    activeMatch: { matchId: "stable-boss-result", type: "boss", bossIndex: 0, nodeId: "boss-node", result: "victory", state, log, simulation: { state: "completed", resolutionApplied: true, score: { user: 2, opponent: 1 } } },
    pendingBossVictory: { bossIndex: 0, bossId: boss.teamId, nodeId: "boss-node", rewardsRemaining: 2, excludedIds: [], rerolls: 0, candidateIds: [] },
    postBossFlow: { status: "result", bossIndex: 0, bossTeamId: boss.teamId, matchNodeId: "boss-node", remainingRewards: 2, rewardNumber: 1, excludedIds: [], rerolls: 0, candidateIds: [], completed: false },
  };
}

function mountResult(state, log) {
  const runtime = load(new BudgetStorage(2_000_000), { run: resultRun(state, log), seasonDb: season });
  runtime.seam.getUi().bossMatchLog = ["legacy mounted log"];
  const before = structuredClone(runtime.canonical.activeMatch);
  const flow = runtime.seam.resolvePendingRunFlow({ clearMatch: false });
  assert.equal(flow.destination, "boss-result");
  runtime.seam.navigateBossVictoryDestination(flow);
  const after = runtime.canonical.activeMatch;
  assert.equal(after.matchId, before.matchId, "canonical match identity is not regenerated");
  assert.equal(after.result, "victory");
  assert.equal(after.simulation.resolutionApplied, true, "resolution is not applied twice");
  assert.equal(runtime.canonical.postBossFlow.remainingRewards, 2, "rewards are not consumed or duplicated");
  return runtime;
}

const legacy = mountResult(null, null);
assert.equal(legacy.seam.getUi().bossMatchState, "completed-victory", "legacy result never remounts as pre-match");
assert.deepEqual(legacy.seam.getUi().bossMatchLog, ["legacy mounted log"], "legacy UI log fallback is preserved");

const normal = mountResult("completed-victory", ["final whistle"]);
assert.equal(normal.seam.getUi().bossMatchState, "completed-victory");
assert.deepEqual(normal.seam.getUi().bossMatchLog, ["final whistle"]);

const recoveryRun = resultRun("pre-match", []);
recoveryRun.runId = "boss-entry-recovery"; recoveryRun.phase = "map"; recoveryRun.activeMatch.result = null;
recoveryRun.activeMatch.simulation = null; recoveryRun.pendingBossVictory = null; recoveryRun.postBossFlow = null;
const recovery = load(new BudgetStorage(2_000_000), { run: recoveryRun, seasonDb: season });
assert.equal(recovery.seam.recoverInterruptedBossAccess(), true);
assert.equal(recovery.seam.getUi().bossMatchState, "pre-match", "entry recovery retains its distinct pre-match fallback");
assert.equal(recovery.canonical.activeMatch.matchId, "stable-boss-result");

console.log("boss result mount parity: legacy, completed result and entry recovery OK");
