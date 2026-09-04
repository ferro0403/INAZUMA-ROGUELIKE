"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const formation = { id: "1-2-1", slots: [
  { key: "GK", role: "GK", line: "goal" }, { key: "DF", role: "DF", line: "defense" },
  { key: "MF1", role: "MF", line: "midfield" }, { key: "MF2", role: "MF", line: "midfield" }, { key: "FW", role: "FW", line: "attack" },
] };
const userPlayers = formation.slots.map((slot, index) => ({ playerId: `user-${index}`, name: `User ${index}`, position: slot.role, overall: 60, category: "Normale", stats: {} }));
const opponents = formation.slots.map((slot, index) => ({ playerId: `opponent-${index}`, name: `Opponent ${index}`, position: slot.role, overall: 60, category: "Normale", stats: {} }));
const node = { id: "five-node", type: "five_v_five", layer: 1 };
const run = {
  version: 2, runId: "prematch-characterization", seasonId: "ie1", phase: "map", bossIndex: 0, teamLevel: 0, lives: 2,
  roster: userPlayers.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: [], bench: [], inventory: [], statistics: {}, formationId: "4-3-3",
  fiveVFive: { formation: formation.id, slots: Object.fromEntries(formation.slots.map((slot, index) => [slot.key, userPlayers[index].playerId])) }, activeMatch: null,
  currentZone: { bossIndex: 0, bossId: "boss", seed: "zone", currentNodeId: "start", pendingNodeId: null, startNodeId: "start", path: ["start"], completedNodeIds: [], nodes: [{ id: "start", type: "start", layer: 0 }, node], edges: [["start", node.id]] },
};
const seasonDb = { seasonId: "ie1", players: userPlayers, formations: { eleven: [{ id: "4-3-3", requirements: {}, slotRoles: [] }] }, bossOrder: [{ teamId: "boss", teamName: "Boss" }] };
const FiveVFive = {
  formations: [formation], formationById: () => formation, emptySlots: () => ({}),
  ensure: current => current.fiveVFive,
  validate: current => ({ valid: Object.values(current.fiveVFive.slots).filter(Boolean).length === 5, formation, assignedCount: 5, messages: [] }),
};
const rt = load(new BudgetStorage(Infinity), { run, seasonDb, contextOverrides: { FiveVFive } });
rt.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: opponents } });
rt.context.SeasonRegistry.player = id => userPlayers.find(player => player.playerId === String(id));
rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
rt.context.RunStatistics.createStableMatchId = () => "five-prematch-stable";
let simulationStarts = 0;
// Traverse the production dispatch/entry seam only; deliberately never call startMatchSimulation.
rt.seam.dispatchNode(rt.seam.getRun().currentZone.nodes[1], "five_v_five", { previousNodeId: "start" });
const persisted = rt.canonical;
assert.equal(persisted.phase, "match"); assert.equal(persisted.activeMatch.type, "five_v_five"); assert.equal(persisted.activeMatch.state, "pre-match");
assert.equal(persisted.activeMatch.matchId, "five-prematch-stable"); assert.equal(persisted.activeMatch.nodeId, "five-node"); assert.equal(persisted.activeMatch.opponents.length, 5);
assert.deepEqual(persisted.activeMatch.score, [0, 0]); assert.deepEqual(persisted.activeMatch.log, []); assert.equal(persisted.activeMatch.result, null);
assert.equal(persisted.activeMatch.simulation, undefined, "the currently persisted entry state has no simulation snapshot before simulation start");
assert.equal(simulationStarts, 0);
console.log("five prematch production path: persisted match/pre-match state characterized before simulation start");
