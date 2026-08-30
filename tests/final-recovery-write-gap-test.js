"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = positions.map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const formation = { id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: positions };
const seasonDb = { seasonId: "ie1", players, teams: [{ teamId: "boss", playerIds: players.map(player => player.playerId) }], bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-3-3", startingXIPlayerIds: players.map(player => player.playerId) }], formations: { eleven: [formation] } };
function runFor(type, activeMatch = null) {
  const node = { id: "node", type, layer: 1 };
  return { runId: `resume-${type}`, seasonId: "ie1", phase: "map", lives: 2, bossIndex: 0, roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [], statistics: {}, formationId: "4-3-3", teamIdentity: { name: "Raimon" }, activeMatch,
    currentZone: { bossIndex: 0, bossId: "boss", seed: "zone", currentNodeId: "start", startNodeId: "start", pendingNodeId: "node", completedNodeIds: [], path: ["start"], nodes: [{ id: "start", type: "start", layer: 0 }, node], edges: [["start", "node"]] } };
}
function harness(type, activeMatch = null) {
  const storage = new BudgetStorage(Infinity); const rt = load(storage, { run: runFor(type, activeMatch), seasonDb }); const c = rt.context;
  c.SpecialMatchRuntime.byId = () => ({ teamName: "Special", matchLevel: 1 }); c.SpecialMatchRuntime.teamPlayers = () => [];
  c.SpecialMatchRuntime.fromNode = (_run, _db, node, previousNodeId) => ({ matchId: "stable-special", type: "special_match", nodeId: node.id, previousNodeId, state: "pre-match", log: [] });
  c.RunStatistics.createStableMatchId = () => "stable-boss";
  c.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
  c.MapEngine.normalizeSpecialMatchNode = () => false;
  c.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  c.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  c.MatchSimulator.simulate = ({ seed }) => ({ valid: true, seed, winner: "user", score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 }, timeline: [], probabilities: { userChance: 50, opponentChance: 50 }, userStrength: {}, opponentStrength: {} });
  return { rt, c };
}

(async () => {
  for (const type of ["special_match", "boss"]) {
    const { rt, c } = harness(type); const save = c.RunState.save.bind(c.RunState); let writes = 0;
    c.RunState.save = () => { writes += 1; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
    await rt.seam.resumeRun();
    assert.equal(writes, 1, `${type}: failed resume performs one recovery write only`); assert.equal(rt.canonical.activeMatch, null); assert.equal(rt.canonical.phase, "map");
    c.RunState.save = value => { writes += 1; return save(value); }; rt.seam.setContext({ run: c.RunState.load("ie1"), seasonDb }); writes = 0; await rt.seam.resumeRun();
    assert.equal(writes, 1, `${type}: retry commits one recovery write`); assert.equal(rt.canonical.phase, "match"); assert.equal(rt.canonical.activeMatch.matchId, type === "boss" ? "stable-boss" : "stable-special"); if (type === "boss") assert.equal(rt.seam.getRun().activeMatch.simulation?.valid, true, "Boss preview is renderable without a second save");
  }

  for (const type of ["special_match", "boss"]) {
    const id = type === "boss" ? "stable-boss" : "stable-special";
    const active = { matchId: id, type, nodeId: "node", previousNodeId: "start", state: "pre-match", log: [] };
    const { rt, c } = harness(type, active); const save = c.RunState.save.bind(c.RunState); let writes = 0;
    c.RunState.save = () => { writes += 1; throw Object.assign(new Error("stale"), { code: "stale-write" }); };
    await rt.seam.resumeRun(); assert.equal(writes, 1); assert.equal(rt.canonical.phase, "map"); assert.equal(rt.canonical.activeMatch.matchId, id);
    c.RunState.save = value => { writes += 1; return save(value); }; rt.seam.setContext({ run: c.RunState.load("ie1"), seasonDb }); writes = 0; await rt.seam.resumeRun(); assert.equal(writes, 1, `${type}: phase repair uses one write`); assert.equal(rt.canonical.phase, "match"); assert.equal(rt.canonical.activeMatch.matchId, id); if (type === "boss") assert.equal(rt.seam.getRun().activeMatch.simulation?.valid, true);
  }

  const item = harness("item"); const current = item.rt.seam.getRun(); current.inventory = []; item.c.RunState.save(current);
  const save = item.c.RunState.save.bind(item.c.RunState); let writes = 0;
  item.c.RunState.save = () => { writes += 1; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  item.rt.seam.resolveItemNode(item.rt.seam.getRun().currentZone.nodes[1]);
  assert.equal(writes, 1, "failed item offer performs one write only"); assert.equal(item.rt.canonical.pendingItemReward, undefined); assert.equal(item.rt.canonical.inventory.length, 0); assert.equal(item.rt.canonical.currentZone.completedNodeIds.length, 0); assert.equal(item.rt.canonical.phase, "map");
  item.c.RunState.save = save; item.rt.seam.resolveItemNode(item.rt.seam.getRun().currentZone.nodes[1]);
  assert.equal(item.rt.canonical.pendingItemReward.status, "offered"); assert.equal(item.rt.canonical.pendingItemReward.candidateIds.length, 3);
  console.log("final recovery write gaps: resume fail-stop and item offer single-write retry OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
