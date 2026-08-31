"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = positions.map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const fiveFormation = { id: "five", name: "2-1-1", summary: "Test", slots: [
  { key: "GK", role: "GK", line: "goal" }, { key: "DF1", role: "DF", line: "defense" }, { key: "DF2", role: "DF", line: "defense" },
  { key: "MF", role: "MF", line: "midfield" }, { key: "FW", role: "FW", line: "attack" },
] };
const FiveVFive = {
  formations: [fiveFormation],
  ensure: run => run.fiveVFive,
  formationById: () => fiveFormation,
  validate: run => ({ valid: true, formation: fiveFormation, assignedCount: 5, messages: [], slots: run.fiveVFive.slots }),
  assign() {}, clearSlot() {}, changeFormation() {}, removeUnavailable() {},
};
const seasonDb = {
  seasonId: "ie1", players,
  formations: { eleven: [{ id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: positions }] },
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-3-3", bossLevel: 1, startingXIPlayerIds: players.map(player => player.playerId) }],
};

function zone() {
  return { bossIndex: 0, bossId: "boss", seed: "zone", currentNodeId: "start", startNodeId: "start", pendingNodeId: null, completedNodeIds: [], path: ["start"],
    nodes: [{ id: "start", type: "start", layer: 0 }, { id: "five-node", type: "five_v_five", layer: 1 }, { id: "boss-node", type: "boss", layer: 1 }],
    edges: [["start", "five-node"], ["start", "boss-node"]] };
}

function frozenMatch(type = "five_v_five") {
  return { matchId: `stable-${type}`, type, nodeId: type === "boss" ? "boss-node" : "five-node", previousNodeId: "start", state: "simulating", result: null, log: [],
    opponents: type === "five_v_five" ? fiveFormation.slots.map((slot, index) => ({ slotKey: slot.key, playerId: `opponent-${index}` })) : undefined,
    simulation: { valid: true, state: "simulating", seed: `seed-${type}`, winner: "user", score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 },
      revealedCount: 0, resolutionApplied: false, timeline: [{ minute: 8, type: "goal", team: "user", text: "Gol" }] } };
}

function runFor({ phase = "map", activeMatch = null } = {}) {
  return { runId: "failure-lock-five", seasonId: "ie1", phase, lives: 3, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [],
    formationId: "4-3-3", fiveVFive: { formation: "five", slots: { GK: "p0", DF1: "p1", DF2: "p2", MF: "p5", FW: "p8" } },
    teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, currentZone: zone(), activeMatch };
}

function runtime(run) {
  const storage = new BudgetStorage(Infinity);
  const fetch = async url => ({ ok: true, json: async () => String(url).includes("FREE_AGENTS") ? { players: [] } : { players: {} } });
  const rt = load(storage, { run, seasonDb, contextOverrides: { FiveVFive, fetch } });
  rt.context.MapEngine.normalizeSpecialMatchNode = () => false;
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1, playbackMs: 1 };
  rt.context.setTimeout = () => 1;
  rt.context.clearTimeout = () => {};
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
  rt.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  return { storage, rt };
}

function mapButton(nodeId) {
  const listeners = [];
  return { dataset: { nodeId }, addEventListener(type, listener) { if (type === "click") listeners.push(listener); }, click() { for (const listener of listeners) listener({ currentTarget: this, target: this, preventDefault() {} }); }, get listenerCount() { return listeners.length; } };
}

(async () => {
  // A failed orphan repair renders only the canonical retry screen. The map
  // never binds its sibling node, so clicking it cannot start another write.
  {
    const original = frozenMatch("boss");
    const h = runtime(runFor({ activeMatch: original }));
    const sibling = mapButton("five-node");
    h.rt.context.document.querySelectorAll = selector => selector === "[data-node-id]" ? [sibling] : [];
    const realSave = h.rt.context.RunState.save.bind(h.rt.context.RunState);
    let writes = 0;
    h.rt.context.RunState.save = () => { writes += 1; throw Object.assign(new Error("stale"), { code: "stale-write" }); };
    await new Promise(resolve => setImmediate(resolve));
    await h.rt.seam.resumeRun();
    const afterFailure = structuredClone(h.rt.canonical);
    assert.equal(writes, 1); assert.equal(sibling.listenerCount, 0);
    assert.match(h.rt.seam.getAppMarkup(), /SALVATAGGIO NON RIUSCITO/);
    assert.match(h.rt.seam.getAppMarkup(), /RIPROVA/);
    assert.doesNotMatch(h.rt.seam.getAppMarkup(), /data-node-id|bottom-nav/, "failure screen exposes no map or bottom navigation");
    sibling.click();
    assert.equal(writes, 1, "locked map click cannot add a write");
    assert.deepEqual(h.rt.canonical, afterFailure, "locked map click cannot change canonical state");
    assert.equal(h.rt.canonical.activeMatch.matchId, original.matchId);
    h.rt.context.RunState.save = value => { writes += 1; return realSave(value); };
    writes = 0;
    const retry = h.rt.context.document.getElementById("retry-failed-gameplay");
    retry.click(); retry.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes, 1, "double retry starts one phase-repair transaction");
    assert.equal(h.rt.canonical.phase, "match");
    assert.equal(h.rt.canonical.activeMatch.matchId, original.matchId);
  }

  // A successful post-commit read-only map remains interactive: rendering is
  // zero-write, while a subsequent user click enters the normal transaction.
  {
    const h = runtime(runFor());
    const button = mapButton("boss-node");
    h.rt.context.document.querySelectorAll = selector => selector === "[data-node-id]" ? [button] : [];
    const realSave = h.rt.context.RunState.save.bind(h.rt.context.RunState);
    let writes = 0;
    h.rt.context.RunState.save = value => { writes += 1; return realSave(value); };
    h.rt.seam.renderMap({ persist: false });
    assert.equal(writes, 0); assert.equal(button.listenerCount, 1);
    button.click();
    assert.equal(writes, 1); assert.equal(h.rt.canonical.phase, "match"); assert.equal(h.rt.canonical.activeMatch.type, "boss");
  }

  // A legitimate persisted 5v5 formation edit is not an orphan. A real reopen
  // routes back to the editor and its production return action preserves the
  // frozen match while durably restoring phase=match.
  {
    const original = frozenMatch();
    const h = runtime(runFor({ phase: "match", activeMatch: original }));
    h.rt.seam.renderMatch();
    h.rt.context.document.getElementById("edit-five-team").click();
    assert.equal(h.rt.canonical.phase, "five", "production edit action persists the legitimate five phase");
    assert.equal(h.rt.canonical.activeMatch.matchId, original.matchId);
    assert.deepEqual(h.rt.seam.recoverInterruptedMatchAccess(), { needed: false, ok: true });
    let reopened = h.rt.reopen({ seasonDb });
    reopened.context.MapEngine.normalizeSpecialMatchNode = () => false;
    reopened.context.MatchSimulatorConfig = { eventDelayMs: 1, playbackMs: 1 };
    reopened.context.setTimeout = () => 1;
    reopened.context.clearTimeout = () => {};
    reopened.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
    reopened.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
    reopened.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
    await new Promise(resolve => setImmediate(resolve));
    await reopened.seam.resumeRun();
    assert.equal(reopened.canonical.phase, "five");
    assert.equal(reopened.canonical.activeMatch.matchId, original.matchId);
    assert.equal(reopened.canonical.activeMatch.simulation.seed, original.simulation.seed);
    assert.match(reopened.seam.getAppMarkup(), /FORMAZIONE 5V5/);
    assert.match(reopened.seam.getAppMarkup(), /TORNA ALLA PARTITA/);
    reopened.context.document.getElementById("back-five-match").click();
    assert.equal(reopened.canonical.phase, "match");
    assert.equal(reopened.canonical.activeMatch.matchId, original.matchId);
    assert.deepEqual(reopened.canonical.activeMatch.simulation, original.simulation);
  }

  console.log("failure lock and legitimate 5v5 edit: blocked failure actions, interactive success map and stable return OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
