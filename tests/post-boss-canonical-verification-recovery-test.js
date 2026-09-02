"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

class OneShotReadbackStorage extends BudgetStorage {
  armVerificationFailure(primaryWriteNumber) {
    this.armedWrite = primaryWriteNumber;
    this.primaryWrites = 0;
    this.failReadback = false;
  }
  setItem(key, value) {
    super.setItem(key, value);
    if (this.armedWrite && String(key).endsWith(":ie1")) {
      this.primaryWrites += 1;
      if (this.primaryWrites === this.armedWrite) this.failReadback = true;
    }
  }
  getItem(key) {
    if (this.failReadback && String(key).endsWith(":ie1")) {
      this.failReadback = false;
      const error = new Error("one-shot primary readback failure");
      error.name = "SecurityError";
      throw error;
    }
    return super.getItem(key);
  }
}

const roles = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = roles.map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const rewards = roles.map((position, index) => ({ playerId: `b${index}`, name: `B${index}`, position, category: "Normale", overall: 55, finalOverall: 55, stats: {} }));
const formation = { id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: roles };
const seasonDb = { seasonId: "ie1", players: [...players, ...rewards], profiles: [...players, ...rewards], formations: { eleven: [formation] },
  teams: [{ teamId: "boss", playerIds: rewards.map((player) => player.playerId) }, { teamId: "next", playerIds: rewards.map((player) => player.playerId) }],
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossLevel: 1 }, { teamId: "next", teamName: "Next", bossLevel: 2 }] };

function victoryRun(runId) {
  return { version: 2, runId, seasonId: "ie1", phase: "match", lives: 2, gameOver: false, bossIndex: 0, consecutiveLosses: 0, completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map((player) => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map((player) => player.playerId), bench: [], inventory: [], formationId: formation.id, fiveVFive: { formation: "none", slots: {} }, teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0,
    activeMatch: { matchId: `${runId}-match`, type: "boss", nodeId: "boss-node", previousNodeId: "start", bossIndex: 0, state: "simulating", log: [], simulation: { resolutionApplied: false, score: { user: 1, opponent: 0 } } },
    currentZone: { bossIndex: 0, bossId: "boss", currentNodeId: "boss-node", startNodeId: "start", path: ["start", "boss-node"], completedNodeIds: [], nodes: [{ id: "start", type: "start", layer: 0 }, { id: "boss-node", type: "boss", layer: 1 }], edges: [["start", "boss-node"]] } };
}

function open(storage, run) {
  const runtime = load(storage, { run, seasonDb });
  runtime.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  runtime.context.SeasonRegistry.player = (id) => seasonDb.players.find((player) => player.playerId === String(id));
  runtime.context.DraftEngine.selectCandidates = (available) => available.slice(0, 3);
  return runtime;
}

function reachRewardTwo(runtime) {
  runtime.seam.completeBossMatch("victory");
  runtime.seam.resolvePendingRunFlow({ clearMatch: true });
  runtime.seam.navigateBossVictoryDestination({ destination: "boss-rewards" });
  runtime.seam.advanceBossReward();
  assert.equal(runtime.canonical.postBossFlow.rewardNumber, 2);
}

// True RunState failure window: the handoff primary is durable, its immediate
// readback fails once, and GameplayPersistence's following canonical load works.
{
  const storage = new OneShotReadbackStorage(Infinity);
  const runtime = open(storage, victoryRun("verification"));
  reachRewardTwo(runtime);
  const productionSave = runtime.context.RunState.save.bind(runtime.context.RunState);
  let observedError = null;
  runtime.context.RunState.save = (...args) => { try { return productionSave(...args); } catch (error) { observedError = error; throw error; } };
  storage.armVerificationFailure(2); // reward advance succeeds; handoff verification fails
  runtime.seam.advanceBossReward();
  assert.equal(observedError?.name, "RunPersistenceError");
  assert.equal(observedError?.code, "canonical-verification-failed");
  assert.equal(runtime.canonical.bossIndex, 1);
  assert.equal(runtime.canonical.postBossFlow, null);
  const retry = runtime.context.document.getElementById("retry-post-boss-flow");
  retry.click();
  assert.doesNotMatch(runtime.seam.getAppMarkup(), /Ripresa ricompense/);
  assert.equal(runtime.seam.getRun().bossIndex, 1);
  assert.deepEqual([...runtime.seam.getRun().completedBossIds], ["boss"]);
}

// A stale PostBoss callback must recover externally advanced canonical B and
// the same recovery button must route B without replaying either reward.
{
  const storage = new OneShotReadbackStorage(Infinity);
  const runtimeA = open(storage, victoryRun("stale"));
  reachRewardTwo(runtimeA);
  const staleGeneration = runtimeA.seam.getRun().storageGeneration;
  const external = runtimeA.context.RunState.load("ie1", { readOnly: true });
  external.postBossFlow.remainingRewards = 0;
  external.postBossFlow.status = "next-zone";
  runtimeA.context.BossGameOverRuntime.applyBossVictoryHandoffMutation({ run: external, seasonDb, ensureCurrentZoneMutation: () => { external.currentZone = { bossIndex: 1, currentNodeId: "canonical-next", nodes: [], completedNodeIds: [] }; }, buildFinalization: () => { throw new Error("not final"); } });
  runtimeA.context.RunState.save(external);
  assert.equal(runtimeA.seam.getRun().storageGeneration, staleGeneration);
  const productionSave = runtimeA.context.RunState.save.bind(runtimeA.context.RunState);
  let observedError = null;
  runtimeA.context.RunState.save = (...args) => { try { return productionSave(...args); } catch (error) { observedError = error; throw error; } };
  runtimeA.seam.advanceBossReward();
  assert.equal(observedError?.code, "stale-write");
  const retry = runtimeA.context.document.getElementById("retry-post-boss-flow");
  retry.click();
  assert.doesNotMatch(runtimeA.seam.getAppMarkup(), /Ripresa ricompense/);
  assert.equal(runtimeA.seam.getRun().postBossFlow, null);
  assert.equal(runtimeA.seam.getRun().bossIndex, 1);
  assert.equal(runtimeA.seam.getRun().currentZone.currentNodeId, "canonical-next");
  assert.deepEqual([...runtimeA.seam.getRun().completedBossIds], ["boss"]);
}

console.log("post-boss canonical recovery: real verification failure and stale canonical advancement preserve B");
