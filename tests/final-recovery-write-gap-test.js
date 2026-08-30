"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const seasonDb = { seasonId: "ie1", players: [], teams: [], bossOrder: [{ teamId: "boss", teamName: "Boss" }], formations: { eleven: [] } };
function runFor(type, activeMatch = null) {
  const node = { id: "node", type, layer: 1 };
  return { runId: `resume-${type}`, seasonId: "ie1", phase: "map", lives: 2, bossIndex: 0, roster: [], lineup: [], bench: [], inventory: [], statistics: {}, activeMatch,
    currentZone: { bossIndex: 0, bossId: "boss", seed: "zone", currentNodeId: "start", startNodeId: "start", pendingNodeId: "node", completedNodeIds: [], path: ["start"], nodes: [{ id: "start", type: "start", layer: 0 }, node], edges: [["start", "node"]] } };
}
function harness(type, activeMatch = null) {
  const storage = new BudgetStorage(Infinity); const rt = load(storage, { run: runFor(type, activeMatch), seasonDb }); const c = rt.context;
  c.SpecialMatchRuntime.byId = () => ({ teamName: "Special", matchLevel: 1 }); c.SpecialMatchRuntime.teamPlayers = () => [];
  c.SpecialMatchRuntime.fromNode = (_run, _db, node, previousNodeId) => ({ matchId: "stable-special", type: "special_match", nodeId: node.id, previousNodeId, state: "pre-match", log: [] });
  c.RunStatistics.createStableMatchId = () => "stable-boss";
  c.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
  c.MapEngine.normalizeSpecialMatchNode = () => false;
  return { rt, c };
}

(async () => {
  for (const type of ["special_match", "boss"]) {
    const { rt, c } = harness(type); const save = c.RunState.save.bind(c.RunState); let writes = 0;
    c.RunState.save = () => { writes += 1; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
    await rt.seam.resumeRun();
    assert.equal(writes, 1, `${type}: failed resume performs one recovery write only`); assert.equal(rt.canonical.activeMatch, null); assert.equal(rt.canonical.phase, "map");
    c.RunState.save = value => { writes += 1; return save(value); }; rt.seam.setContext({ run: c.RunState.load("ie1"), seasonDb }); writes = 0; await rt.seam.resumeRun();
    assert.equal(writes, 1, `${type}: retry commits one recovery write`); assert.equal(rt.canonical.phase, "match"); assert.equal(rt.canonical.activeMatch.matchId, type === "boss" ? "stable-boss" : "stable-special");
  }

  for (const type of ["special_match", "boss"]) {
    const id = type === "boss" ? "stable-boss" : "stable-special";
    const active = { matchId: id, type, nodeId: "node", previousNodeId: "start", state: "pre-match", log: [] };
    const { rt, c } = harness(type, active); const save = c.RunState.save.bind(c.RunState); let writes = 0;
    c.RunState.save = () => { writes += 1; throw Object.assign(new Error("stale"), { code: "stale-write" }); };
    await rt.seam.resumeRun(); assert.equal(writes, 1); assert.equal(rt.canonical.phase, "map"); assert.equal(rt.canonical.activeMatch.matchId, id);
    c.RunState.save = save; rt.seam.setContext({ run: c.RunState.load("ie1"), seasonDb }); await rt.seam.resumeRun(); assert.equal(rt.canonical.phase, "match"); assert.equal(rt.canonical.activeMatch.matchId, id);
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
