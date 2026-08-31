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
  return { bossIndex: 0, bossId: "boss", seed: "zone", currentNodeId: "start", startNodeId: "start", pendingNodeId: "five-node", completedNodeIds: ["start"], path: ["start"],
    nodes: [{ id: "start", type: "start", layer: 0 }, { id: "five-node", type: "five_v_five", layer: 1 }, { id: "boss-node", type: "boss", layer: 1 }],
    edges: [["start", "five-node"], ["start", "boss-node"]] };
}

function preMatch() {
  return {
    matchId: "stable-five-edit", type: "five_v_five", nodeId: "five-node", previousNodeId: "start", state: "pre-match", result: null, log: [],
    opponentFormation: "five", opponents: fiveFormation.slots.map((slot, index) => ({ slotKey: slot.key, playerId: `opponent-${index}` })), simulation: null,
  };
}

function simulatingMatch() {
  return {
    ...preMatch(), state: "simulating",
    simulation: { valid: true, state: "simulating", seed: "stable-five-seed", winner: "user", score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 }, revealedCount: 0, resolutionApplied: false, timeline: [{ minute: 8, type: "goal", team: "user", text: "Gol" }] },
  };
}

function runFor(activeMatch) {
  return { runId: "five-edit-final", seasonId: "ie1", phase: "match", lives: 2, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [],
    formationId: "4-3-3", fiveVFive: { formation: "five", slots: { GK: "p0", DF1: "p1", DF2: "p2", MF: "p5", FW: "p8" } },
    teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, currentZone: zone(), activeMatch };
}

function runtime(activeMatch) {
  const storage = new BudgetStorage(Infinity);
  const fetch = async url => ({ ok: true, json: async () => String(url).includes("FREE_AGENTS") ? { players: [] } : { players: {} } });
  const rt = load(storage, { run: runFor(activeMatch), seasonDb, contextOverrides: { FiveVFive, fetch } });
  rt.context.MapEngine.normalizeSpecialMatchNode = () => false;
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1, playbackMs: 1 };
  rt.context.setTimeout = () => 1;
  rt.context.clearTimeout = () => {};
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
  rt.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  return { storage, rt };
}

(async () => {
  // Success + double click: one durable entry transaction, then presentation only.
  {
    const h = runtime(preMatch());
    h.rt.seam.renderMatch();
    const liveBefore = structuredClone(h.rt.seam.getRun().activeMatch);
    const realSave = h.rt.context.RunState.save.bind(h.rt.context.RunState);
    let writes = 0;
    h.rt.context.RunState.save = (value, options) => { writes += 1; return realSave(value, options); };
    const button = h.rt.context.document.getElementById("edit-five-team");
    button.click(); button.click();
    assert.equal(writes, 1, "5v5 editor entry must commit exactly once even on double click");
    assert.equal(h.rt.canonical.phase, "five");
    assert.equal(h.rt.canonical.activeMatch.matchId, liveBefore.matchId);
    assert.equal(h.rt.canonical.activeMatch.state, "pre-match");
    assert.ok(h.rt.canonical.activeMatch.returnScroll, "return scroll must be canonical after the entry commit");
    assert.deepEqual(h.rt.canonical.activeMatch.simulation, liveBefore.simulation, "editor entry must preserve the current pre-match simulation snapshot");
    assert.match(h.rt.seam.getAppMarkup(), /FORMAZIONE 5V5/);
    assert.match(h.rt.seam.getAppMarkup(), /TORNA ALLA PARTITA/);
  }

  // Persistence failure: exactly one failed write, no editor and canonical rollback.
  {
    const h = runtime(preMatch());
    h.rt.seam.renderMatch();
    const canonicalBefore = structuredClone(h.rt.canonical);
    let writes = 0;
    h.rt.context.RunState.save = () => { writes += 1; const error = new Error("Quota exceeded"); error.name = "QuotaExceededError"; throw error; };
    h.rt.context.document.getElementById("edit-five-team").click();
    assert.equal(writes, 1, "failed editor entry must not attempt a second save");
    assert.deepEqual(h.rt.canonical, canonicalBefore, "failed editor entry must preserve canonical state");
    assert.equal(h.rt.canonical.phase, "match");
    assert.equal(h.rt.canonical.activeMatch.matchId, canonicalBefore.activeMatch.matchId);
    assert.equal(h.rt.canonical.activeMatch.returnScroll, undefined);
    assert.match(h.rt.seam.getAppMarkup(), /SALVATAGGIO NON RIUSCITO/);
    assert.doesNotMatch(h.rt.seam.getAppMarkup(), /FORMAZIONE 5V5/);
  }

  // Frozen/simulating: disabled in markup and guarded at runtime.
  {
    const h = runtime(simulatingMatch());
    h.rt.seam.renderMatch();
    assert.match(h.rt.seam.getAppMarkup(), /id="edit-five-team"[^>]*disabled/, "simulating 5v5 must disable edit-team");
    const canonicalBefore = structuredClone(h.rt.canonical);
    const realSave = h.rt.context.RunState.save.bind(h.rt.context.RunState);
    let writes = 0;
    h.rt.context.RunState.save = (value, options) => { writes += 1; return realSave(value, options); };
    h.rt.context.document.getElementById("edit-five-team").click();
    assert.equal(writes, 0, "simulating 5v5 cannot enter editor");
    assert.deepEqual(h.rt.canonical, canonicalBefore);
  }

  console.log("five edit final gate: one commit, fail-stop, double-click and simulating lock OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
