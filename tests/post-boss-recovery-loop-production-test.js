"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const roles = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = roles.map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const bossPlayers = roles.map((position, index) => ({ playerId: `b${index}`, name: `B${index}`, position, category: "Normale", overall: 55, finalOverall: 55, stats: {} }));
const formation = { id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: roles };
const seasonDb = {
  seasonId: "ie1", players: [...players, ...bossPlayers], profiles: [...players, ...bossPlayers], formations: { eleven: [formation] },
  teams: [{ teamId: "boss", playerIds: bossPlayers.map((player) => player.playerId) }, { teamId: "next", playerIds: bossPlayers.map((player) => player.playerId) }],
  bossOrder: [
    { teamId: "boss", teamName: "Boss", bossFormation: formation.id, bossLevel: 1, startingXIPlayerIds: bossPlayers.map((player) => player.playerId) },
    { teamId: "next", teamName: "Next", bossFormation: formation.id, bossLevel: 2, startingXIPlayerIds: bossPlayers.map((player) => player.playerId) },
  ],
};

function bossVictoryRun() {
  const match = { matchId: "boss-victory", type: "boss", nodeId: "boss-node", previousNodeId: "start", bossIndex: 0, state: "simulating", log: [], simulation: { resolutionApplied: false, score: { user: 1, opponent: 0 } } };
  return {
    version: 2, runId: "post-boss-recovery", seasonId: "ie1", phase: "match", lives: 2, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map((player) => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map((player) => player.playerId), bench: [], inventory: [], formationId: formation.id,
    fiveVFive: { formation: "none", slots: {} }, teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, activeMatch: match,
    currentZone: { bossIndex: 0, bossId: "boss", currentNodeId: "boss-node", pendingNodeId: null, startNodeId: "start", path: ["start", "boss-node"], completedNodeIds: [], nodes: [{ id: "start", type: "start", layer: 0 }, { id: "boss-node", type: "boss", layer: 1 }], edges: [["start", "boss-node"]] },
  };
}

const storage = new BudgetStorage(Infinity);
const runtime = load(storage, { run: bossVictoryRun(), seasonDb });
runtime.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
runtime.context.SeasonRegistry.player = (id) => seasonDb.players.find((player) => player.playerId === String(id));
runtime.context.DraftEngine.selectCandidates = (available) => available.slice(0, 3);

runtime.seam.completeBossMatch("victory");
assert.equal(runtime.canonical.activeMatch.simulation.resolutionApplied, true);
assert.equal(runtime.canonical.postBossFlow.status, "result");
assert.equal(runtime.canonical.pendingBossVictory.rewardsRemaining, 2);

runtime.seam.resolvePendingRunFlow({ clearMatch: true });
runtime.seam.navigateBossVictoryDestination({ destination: "boss-rewards" });
assert.equal(runtime.canonical.activeMatch, null);
assert.equal(runtime.canonical.postBossFlow.status, "reward");
assert.equal(runtime.canonical.postBossFlow.rewardNumber, 1);

runtime.seam.advanceBossReward();
assert.equal(runtime.canonical.postBossFlow.rewardNumber, 2);
assert.equal(runtime.canonical.postBossFlow.remainingRewards, 1);

// Model RunState's ambiguous-commit failure window: canonical storage accepted
// boss-victory-handoff, but the persistence boundary reports a transient error.
// GameplayPersistence must recover from the canonical copy, not the older UI.
const realSave = runtime.context.RunState.save.bind(runtime.context.RunState);
let writes = 0;
runtime.context.RunState.save = (run, options) => {
  writes += 1;
  const saved = realSave(run, options);
  if (writes === 2) throw Object.assign(new Error("verification failed after canonical commit"), { name: "QuotaExceededError" });
  return saved;
};
runtime.seam.advanceBossReward();

assert.equal(writes, 2, "reward advance and boss-victory-handoff use distinct production boundaries");
assert.equal(runtime.canonical.postBossFlow, null, "canonical handoff is already complete");
assert.equal(runtime.canonical.bossIndex, 1);
assert.match(runtime.context.document.getElementById("app").innerHTML, /Ripresa ricompense/);
const sameMountedRetry = runtime.context.document.getElementById("retry-post-boss-flow");

runtime.context.RunState.save = realSave;
sameMountedRetry.click();

assert.doesNotMatch(runtime.context.document.getElementById("app").innerHTML, /Ripresa ricompense/, "same mounted retry must route the canonical map state");
assert.equal(runtime.seam.getRun().postBossFlow, null);
assert.equal(runtime.seam.getRun().bossIndex, 1);
assert.deepEqual([...runtime.seam.getRun().completedBossIds], ["boss"]);
assert.deepEqual([...runtime.seam.getRun().unlockedTeamIds], ["boss"]);
console.log("post-boss recovery: canonical handoff + same-mounted retry routes forward exactly once");
