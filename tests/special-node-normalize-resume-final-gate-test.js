"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = positions.map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const specialMatch = {
  specialMatchId: "special-1", zoneIndex: 1, teamId: "special-team", teamName: "Special Team", logoUrl: "", matchLevel: 1, matchFormation: "4-3-3",
  startingXIPlayerIds: players.map(player => player.playerId), reward: { candidateCount: 1 },
};
const seasonDb = {
  seasonId: "ie1_s3", requiresProfileAwareRuntime: false, players, teams: [], specialMatches: [specialMatch],
  formations: { eleven: [{ id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: positions }] },
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-3-3", bossLevel: 1, startingXIPlayerIds: players.map(player => player.playerId) }],
};

const SpecialMatchRuntime = {
  byId: (database, specialMatchId) => (database.specialMatches || []).find(match => String(match.specialMatchId) === String(specialMatchId)) || null,
  forNode: (database, node) => node?.type === "special_match" ? (database.specialMatches || []).find(match => String(match.specialMatchId) === String(node.specialMatchId)) || null : null,
  teamPlayers: (_database, special) => players.map(player => ({ ...player, level: Number(special?.matchLevel || 0), displayLevel: Number(special?.matchLevel || 0), stats: {} })),
  eligibleProfile: () => true,
};

const FiveVFive = {
  formations: [],
  ensure: run => {
    run.fiveVFive ||= { formation: "test-five", slots: {} };
    return run.fiveVFive;
  },
  validate: () => ({ valid: true, messages: [], assignedCount: 0, slots: {} }),
  formationById: () => ({ id: "test-five", slots: [] }),
  assign() {}, clearSlot() {}, changeFormation() {}, removeUnavailable() {},
};

function legacyZone() {
  return {
    bossIndex: 0, bossId: "boss", seed: "legacy-zone", currentNodeId: "start", startNodeId: "start", pendingNodeId: "legacy-special", completedNodeIds: ["start"], path: ["start", "legacy-special"],
    nodes: [
      { id: "start", type: "start", layer: 0, column: 0 },
      { id: "legacy-special", type: "special_match", layer: 2, column: 0, specialMatchId: "special-1", teamId: "special-team", teamName: "Special Team", matchLevel: 1, matchFormation: "4-3-3" },
      { id: "normalized-special", type: "pull_free_agents", layer: 3, column: 1 },
      { id: "boss-node", type: "boss", layer: 4, column: 0, bossId: "boss" },
    ],
    edges: [["start", "legacy-special"], ["legacy-special", "normalized-special"], ["normalized-special", "boss-node"]],
  };
}

function activeSpecialMatch() {
  return {
    matchId: "special-resume-stable", type: "special_match", nodeId: "legacy-special", previousNodeId: "start", specialMatchId: "special-1", teamId: "special-team", matchLevel: 1, matchFormation: "4-3-3",
    state: "pre-match", result: null, log: [], simulation: null,
  };
}

function runState() {
  return { runId: "special-normalize-final", seasonId: "ie1_s3", phase: "match", lives: 2, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [],
    roster: players.map(player => ({ playerId: player.playerId, source: "ie1_s3", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [],
    formationId: "4-3-3", fiveVFive: null, teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, currentZone: legacyZone(), activeMatch: activeSpecialMatch() };
}

async function runtime() {
  seasonDb.requiresProfileAwareRuntime = false;
  const storage = new BudgetStorage(Infinity);
  const fetch = async url => ({ ok: true, json: async () => String(url).includes("FREE_AGENTS") ? { players: [] } : { players: {} } });
  const rt = load(storage, { run: runState(), seasonDb, contextOverrides: { fetch, SpecialMatchRuntime, FiveVFive } });
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1, playbackMs: 1 };
  rt.context.setTimeout = () => 1;
  rt.context.clearTimeout = () => {};
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => false;
  rt.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  await new Promise(resolve => setImmediate(resolve));
  seasonDb.requiresProfileAwareRuntime = true;
  const canonical = rt.canonical;
  rt.seam.setContext({ run: canonical, seasonDb });
  return { storage, rt };
}

async function failureScenario(kind) {
  const h = await runtime();
  const canonicalBefore = structuredClone(h.rt.canonical);
  const rawBefore = JSON.stringify([...h.storage.map.entries()]);
  const realSave = h.rt.context.RunState.save.bind(h.rt.context.RunState);
  let writes = 0;
  h.rt.context.RunState.save = () => {
    writes += 1;
    const error = new Error(kind === "stale" ? "stale" : "Quota exceeded");
    if (kind === "stale") { error.name = "RunPersistenceError"; error.code = "stale-write"; }
    else error.name = "QuotaExceededError";
    throw error;
  };

  let thrown = null;
  try { await h.rt.seam.resumeRun(); } catch (error) { thrown = error; }
  assert.equal(thrown, null, `${kind}: normalization persistence failure must be handled by fail-stop`);
  assert.equal(writes, 1, `${kind}: exactly one normalization write attempt`);
  assert.equal(JSON.stringify([...h.storage.map.entries()]), rawBefore, `${kind}: raw canonical storage unchanged`);
  assert.deepEqual(h.rt.canonical, canonicalBefore, `${kind}: canonical run unchanged`);
  assert.equal(h.rt.canonical.activeMatch.matchId, canonicalBefore.activeMatch.matchId);
  assert.equal(h.rt.canonical.activeMatch.nodeId, "legacy-special");
  assert.match(h.rt.seam.getAppMarkup(), /SALVATAGGIO NON RIUSCITO/);

  h.rt.context.RunState.save = realSave;
  await h.rt.seam.resumeRun();
  const recovered = h.rt.canonical;
  const normalizedNode = recovered.currentZone.nodes.find(node => node.id === recovered.activeMatch.nodeId);
  assert.equal(recovered.activeMatch.matchId, canonicalBefore.activeMatch.matchId);
  assert.equal(recovered.activeMatch.nodeId, "normalized-special", `${kind}: active special match must follow the normalized node`);
  assert.ok(normalizedNode, `${kind}: activeMatch.nodeId must resolve to an existing node`);
  assert.equal(normalizedNode.type, "special_match");
  assert.equal(normalizedNode.specialMatchId, "special-1");
  assert.equal(recovered.currentZone.pendingNodeId, "normalized-special");
  assert.equal(recovered.activeMatch.simulation, canonicalBefore.activeMatch.simulation);
}

(async () => {
  await failureScenario("quota");
  await failureScenario("stale");
  console.log("special normalize final gate: quota/stale rollback, retry and active node identity OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
