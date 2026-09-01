"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = positions.map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const seasonDb = {
  seasonId: "ie1",
  players,
  formations: { eleven: [{ id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: positions }] },
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-3-3", bossLevel: 1, startingXIPlayerIds: players.map(player => player.playerId) }],
};

function zone(type = "item") {
  return { bossIndex: 0, bossId: "boss", seed: "zone", currentNodeId: "start", startNodeId: "start", pendingNodeId: "node", completedNodeIds: [], path: ["start"],
    nodes: [{ id: "start", type: "start", layer: 0 }, { id: "node", type, layer: 1 }], edges: [["start", "node"]] };
}

function match(type, state = "simulating") {
  const completed = state === "completed";
  return { matchId: `stable-${type}`, type, nodeId: "node", previousNodeId: "start", bossIndex: 0, specialMatchId: type === "special_match" ? "special" : undefined,
    state: completed ? "completed-victory" : "simulating", result: completed ? "victory" : null, log: [],
    simulation: { valid: true, state, seed: `seed-${type}`, winner: "user", score: { user: 2, opponent: 1 }, displayedScore: { user: 2, opponent: 1 }, revealedCount: 1,
      resolutionApplied: false, timeline: [{ minute: 7, type: "goal", team: "user", text: "Gol stabile" }] } };
}

function runFor(activeMatch = null, currentZone = zone(activeMatch?.type)) {
  return { runId: `orphan-${activeMatch?.type || "map"}`, seasonId: "ie1", phase: "map", lives: 3, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [],
    formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, currentZone, activeMatch };
}

function harness(activeMatch = null, currentZone) {
  const storage = new BudgetStorage(Infinity);
  const rt = load(storage, { run: runFor(activeMatch, currentZone === undefined ? zone(activeMatch?.type) : currentZone), seasonDb });
  const c = rt.context;
  c.RunStatistics.applyCompletedMatchStatistics = current => { current.statistics.matches = Number(current.statistics.matches || 0) + 1; };
  c.RunStatistics.recordRunAction = () => {};
  c.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  c.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
  c.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  c.MapEngine.completeNode = (currentZoneValue, nodeId) => { if (!currentZoneValue.completedNodeIds.includes(nodeId)) currentZoneValue.completedNodeIds.push(nodeId); };
  c.SpecialMatchRuntime.complete = current => { current.pendingSpecialMatchReward = { specialMatchId: "special", status: "pending" }; };
  return { storage, rt, c };
}

function rawStorage(storage) { return JSON.stringify([...storage.map.entries()].sort(([a], [b]) => a.localeCompare(b))); }

// A presentation-only map render must not invoke any write-capable ancestor,
// even when normalization would report a changed or newly generated zone.
for (const scenario of ["changed", "generated"]) {
  const h = harness(null, scenario === "generated" ? null : zone());
  let touches = 0, ensures = 0, saves = 0, checkpoints = 0;
  h.c.RunState.touch = value => { touches += 1; return value; };
  h.c.MapEngine.ensureCurrentZone = () => { ensures += 1; return scenario === "generated" ? { generated: true, changed: true } : { generated: false, changed: true }; };
  h.c.RunState.save = () => { saves += 1; };
  h.c.RunState.createCheckpoint = () => { checkpoints += 1; };
  const before = rawStorage(h.storage);
  const epoch = h.c.PersistenceRecoveryGuard.readEpoch();
  h.rt.seam.renderMap({ persist: false });
  assert.equal(touches, 0, `${scenario}: read-only render does not touch the run`);
  assert.equal(ensures, 0, `${scenario}: read-only render does not normalize/generate a zone`);
  assert.equal(saves, 0, `${scenario}: read-only render does not save`);
  assert.equal(checkpoints, 0, `${scenario}: read-only render does not checkpoint`);
  assert.equal(rawStorage(h.storage), before, `${scenario}: canonical storage is unchanged`);
  assert.equal(h.c.PersistenceRecoveryGuard.readEpoch(), epoch, `${scenario}: mutation epoch is unchanged`);
}

// A failed item offer already rerenders the map through the production failure
// callback. The rerender must not turn the rollback into a second write.
{
  const h = harness();
  let writes = 0, ensures = 0, checkpoints = 0;
  const siblingListeners = [];
  const sibling = { dataset: { nodeId: "start" }, addEventListener(type, listener) { if (type === "click") siblingListeners.push(listener); }, click() { siblingListeners.forEach(listener => listener({ currentTarget: this, target: this, preventDefault() {} })); } };
  h.c.document.querySelectorAll = selector => selector === "[data-node-id]" ? [sibling] : [];
  h.c.MapEngine.ensureCurrentZone = () => { ensures += 1; return { generated: false, changed: true }; };
  h.c.RunState.createCheckpoint = () => { checkpoints += 1; };
  h.c.RunState.save = () => { writes += 1; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  const before = rawStorage(h.storage);
  h.rt.seam.resolveItemNode(h.rt.seam.getRun().currentZone.nodes[1]);
  assert.equal(writes, 1, "failure plus read-only rerender has only the failed transaction write");
  assert.equal(ensures, 0, "failure rerender does not normalize the zone");
  assert.equal(checkpoints, 0, "failure rerender does not checkpoint");
  assert.equal(rawStorage(h.storage), before, "rollback canonical storage remains unchanged");
  assert.match(h.rt.seam.getAppMarkup(), /SALVATAGGIO NON RIUSCITO/);
  assert.equal(siblingListeners.length, 0, "failed Item offer does not bind another map node");
  sibling.click();
  assert.equal(writes, 1, "clicking another node after Item failure cannot start a mutation");
}

// Existing matches of every supported family use one generic phase repair and
// preserve the frozen simulation byte-for-byte.
for (const type of ["five_v_five", "boss", "special_match"]) {
  for (const state of ["simulating", "completed"]) {
    const frozen = match(type, state);
    const h = harness(frozen);
    const before = structuredClone(h.rt.canonical.activeMatch);
    const realSave = h.c.RunState.save.bind(h.c.RunState);
    let writes = 0;
    h.c.RunState.save = value => { writes += 1; return realSave(value); };
    const recovered = h.rt.seam.recoverInterruptedMatchAccess();
    assert.deepEqual(recovered, { needed: true, ok: true, type }, `${type}/${state}: recovery is recognized`);
    assert.equal(writes, 1, `${type}/${state}: phase repair is one transaction`);
    assert.equal(h.rt.canonical.phase, "match");
    assert.deepEqual(h.rt.canonical.activeMatch, before, `${type}/${state}: frozen match is unchanged`);
    if (state === "completed") {
      h.rt.seam.resumeMatchSimulationIfNeeded(h.rt.seam.getRun().activeMatch);
      assert.equal(h.rt.canonical.activeMatch.simulation.resolutionApplied, true, `${type}: frozen result resolves`);
      assert.equal(h.rt.canonical.activeMatch.matchId, before.matchId);
      assert.equal(h.rt.canonical.activeMatch.simulation.seed, before.simulation.seed);
      assert.deepEqual(h.rt.canonical.activeMatch.simulation.timeline, before.simulation.timeline);
      assert.deepEqual(h.rt.canonical.activeMatch.simulation.score, before.simulation.score);
      assert.equal(h.rt.canonical.statistics.matches, 1, `${type}: statistics apply once`);
      h.rt.seam.resumeMatchSimulationIfNeeded(h.rt.seam.getRun().activeMatch);
      assert.equal(h.rt.canonical.statistics.matches, 1, `${type}: repeated resume is idempotent`);
    }
  }
}

// Failed repairs leave the canonical snapshot untouched; a later explicit
// retry performs one write and retains the stable identity for every family.
for (const type of ["five_v_five", "boss", "special_match"]) {
  const h = harness(match(type));
  const before = structuredClone(h.rt.canonical);
  const realSave = h.c.RunState.save.bind(h.c.RunState);
  let writes = 0;
  h.c.RunState.save = () => { writes += 1; throw Object.assign(new Error("stale"), { code: "stale-write" }); };
  const failed = h.rt.seam.recoverInterruptedMatchAccess();
  assert.equal(failed.ok, false); assert.equal(writes, 1);
  assert.deepEqual(h.rt.canonical, before, `${type}: failed repair preserves canonical state`);
  h.c.RunState.save = value => { writes += 1; return realSave(value); };
  writes = 0;
  const retried = h.rt.seam.recoverInterruptedMatchAccess();
  assert.equal(retried.ok, true); assert.equal(writes, 1);
  assert.equal(h.rt.canonical.phase, "match");
  assert.equal(h.rt.canonical.activeMatch.matchId, before.activeMatch.matchId);
  assert.equal(h.rt.canonical.activeMatch.simulation.seed, before.activeMatch.simulation.seed);
}

console.log("read-only map and generic orphan match recovery: zero-write rendering and stable phase repair OK");
