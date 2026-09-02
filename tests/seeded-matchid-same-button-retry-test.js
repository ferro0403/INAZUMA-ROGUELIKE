"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const formation = { id: "1-2-1", slots: [
  { key: "GK", role: "GK" }, { key: "DF", role: "DF" }, { key: "MF1", role: "MF" },
  { key: "MF2", role: "MF" }, { key: "FW", role: "FW" },
] };
const users = formation.slots.map((slot, index) => ({ playerId: `user-${index}`, name: `User ${index}`, position: slot.role, overall: 60, category: "Normale", stats: {} }));
const opponents = formation.slots.map((slot, index) => ({ playerId: `opponent-${index}`, name: `Opponent ${index}`, position: slot.role, overall: 55, category: "Normale", stats: {} }));
const seasonDb = { seasonId: "ie1", players: users, teams: [], formations: { eleven: [] }, bossOrder: [{ teamId: "boss", teamName: "Boss" }] };
const FiveVFive = {
  formations: [formation], formationById: () => formation, emptySlots: () => ({}), ensure: current => current.fiveVFive,
  validate: () => ({ valid: true, formation, assignedCount: 5, messages: [] }),
};

function baseRun(id) {
  return {
    version: 2, runId: id, seasonId: "ie1", phase: "match", bossIndex: 0, teamLevel: 0, lives: 2, consecutiveLosses: 0,
    roster: users.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: [], bench: [], inventory: [], statistics: {},
    formationId: "4-3-3", teamIdentity: { name: "Raimon" },
    fiveVFive: { formation: formation.id, slots: Object.fromEntries(formation.slots.map((slot, index) => [slot.key, users[index].playerId])) },
    activeMatch: { matchId: `${id}::five-node::five_v_five::1::preseed`, type: "five_v_five", nodeId: "five-node", previousNodeId: "start", attemptNumber: 1,
      state: "pre-match", score: [0, 0], log: [], result: null, opponents: opponents.map(({ playerId }) => ({ playerId })), opponentFormation: formation.id },
    currentZone: { currentNodeId: "five-node", pendingNodeId: null, startNodeId: "start", completedNodeIds: [], nodes: [{ id: "start", type: "start" }, { id: "five-node", type: "five_v_five" }], edges: [["start", "five-node"]] },
  };
}

function open(id) {
  const storage = new BudgetStorage(Infinity);
  const rt = load(storage, { run: baseRun(id), seasonDb, contextOverrides: { FiveVFive } });
  rt.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: opponents } });
  rt.context.SeasonRegistry.player = playerId => users.find(player => player.playerId === String(playerId));
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RunStatistics.createStableMatchId = (run, match) => `${run.runId}::${match.nodeId}::${match.type}::${match.attemptNumber || 1}::${match.simulation?.seed || "preseed"}`;
  rt.context.MatchSimulator.simulate = ({ seed }) => ({ valid: true, seed, winner: "user", score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 }, timeline: [{ minute: 5, type: "goal", team: "user", text: "Gol" }], probabilities: { userChance: 50, opponentChance: 50 }, userStrength: { averageOverall: 60, final: 60 }, opponentStrength: { averageOverall: 55, final: 55 } });
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1000, playbackMs: 1000 };
  let timers = 0;
  rt.context.setTimeout = () => { timers += 1; return timers; };
  rt.context.clearTimeout = () => {};
  return { rt, timers: () => timers };
}

function assertReadOnlyRenderAndSeededRetry(failure) {
  const label = failure.code || failure.name;
  const { rt, timers } = open(`seeded-retry-${label}`);
  const before = structuredClone(rt.canonical.activeMatch);
  rt.seam.renderMatch({ allowAutomaticResume: false });
  assert.deepStrictEqual(rt.canonical.activeMatch, before, "renderMatch must not freeze or seed the canonical pre-match");
  const simulateButton = rt.context.document.getElementById("simulate-boss-match");
  const expectedSeed = `${rt.canonical.runId}:five_v_five:five-node:1`;
  const seededId = `${rt.canonical.runId}::five-node::five_v_five::1::${expectedSeed}`;
  assert.notStrictEqual(before.matchId, seededId, "the production freeze contract must change the persisted matchId once the seed exists");

  const realSave = rt.context.RunState.save.bind(rt.context.RunState);
  let failedAttempts = 0;
  rt.context.RunState.save = () => { failedAttempts += 1; throw failure; };
  simulateButton.click();
  assert.strictEqual(failedAttempts, 1);
  assert.strictEqual(rt.canonical.activeMatch.matchId, before.matchId);
  assert.strictEqual(rt.canonical.activeMatch.state, "pre-match");
  assert.strictEqual(rt.canonical.activeMatch.simulation, undefined);
  assert.strictEqual(rt.seam.getUi().match.matchId, before.matchId);
  assert.strictEqual(rt.modalMarkup, "");
  assert.strictEqual(rt.seam.getUi().matchPlaybackTimer, null);
  assert.strictEqual(rt.seam.getUi().matchStartLocked, false);
  const timersAfterFailure = timers();

  let retryStarts = 0;
  rt.context.RunState.save = current => { if (current.activeMatch?.state === "simulating") retryStarts += 1; return realSave(current); };
  simulateButton.click();
  assert.strictEqual(retryStarts, 1, "the exact same mounted button retries one start commit");
  assert.strictEqual(rt.canonical.activeMatch.matchId, seededId);
  assert.strictEqual(rt.canonical.activeMatch.state, "simulating");
  assert.strictEqual(rt.canonical.activeMatch.simulation.seed, expectedSeed);
  assert.match(rt.modalMarkup, />Live</);
  assert.strictEqual((rt.modalMarkup.match(/data-five-simulation-modal/g) || []).length, 1);
  assert.strictEqual(timers(), timersAfterFailure + 1);
}

assertReadOnlyRenderAndSeededRetry(Object.assign(new Error("quota"), { name: "QuotaExceededError" }));
assertReadOnlyRenderAndSeededRetry(Object.assign(new Error("stale"), { code: "stale-write" }));

// A failed post-write verification recovers the already committed seeded match.
// The old pre-freeze button must not treat it as a fresh pre-match retry.
{
  const { rt, timers } = open("seeded-verification");
  rt.seam.renderMatch({ allowAutomaticResume: false });
  const simulateButton = rt.context.document.getElementById("simulate-boss-match");
  const realSave = rt.context.RunState.save.bind(rt.context.RunState);
  let writes = 0;
  rt.context.RunState.save = current => {
    writes += 1;
    realSave(current);
    throw Object.assign(new Error("canonical verification failed"), { code: "canonical-verification-failed" });
  };
  simulateButton.click();
  assert.strictEqual(writes, 1);
  assert.strictEqual(rt.canonical.activeMatch.state, "simulating");
  const committedId = rt.canonical.activeMatch.matchId;
  const committedSeed = rt.canonical.activeMatch.simulation.seed;
  rt.context.RunState.save = current => { writes += 1; return realSave(current); };
  simulateButton.click();
  assert.strictEqual(writes, 1, "the pre-freeze callback must not start an already committed canonical match");
  assert.strictEqual(rt.canonical.activeMatch.matchId, committedId);
  assert.strictEqual(rt.canonical.activeMatch.simulation.seed, committedSeed);
  assert.strictEqual(rt.modalMarkup, "");
  assert.strictEqual(timers(), 1, "only the failure toast is scheduled; playback was never armed twice");
}

// A callback mounted for logical match A must not be rebound to replacement C.
{
  const { rt, timers } = open("seeded-stale-a");
  rt.seam.renderMatch({ allowAutomaticResume: false });
  const staleButton = rt.context.document.getElementById("simulate-boss-match");
  const replacement = baseRun("seeded-stale-a");
  replacement.activeMatch.matchId = "replacement-c";
  replacement.activeMatch.nodeId = "replacement-node";
  replacement.currentZone.currentNodeId = "replacement-node";
  rt.seam.setContext({ run: replacement });
  staleButton.click();
  assert.strictEqual(rt.seam.getRun().activeMatch.matchId, "replacement-c");
  assert.strictEqual(rt.seam.getRun().activeMatch.state, "pre-match");
  assert.strictEqual(rt.seam.getRun().activeMatch.simulation, undefined);
  assert.strictEqual(rt.modalMarkup, "");
  assert.strictEqual(timers(), 0);
}

// The seeded identity transition remains single-shot under a rapid double tap.
{
  const { rt, timers } = open("seeded-double-tap");
  rt.seam.renderMatch({ allowAutomaticResume: false });
  const simulateButton = rt.context.document.getElementById("simulate-boss-match");
  const realSave = rt.context.RunState.save.bind(rt.context.RunState);
  let starts = 0;
  rt.context.RunState.save = current => { if (current.activeMatch?.state === "simulating") starts += 1; return realSave(current); };
  simulateButton.click();
  const seed = rt.canonical.activeMatch.simulation.seed;
  simulateButton.click();
  assert.strictEqual(starts, 1);
  assert.strictEqual(rt.canonical.activeMatch.simulation.seed, seed);
  assert.strictEqual(timers(), 1);
  assert.strictEqual((rt.modalMarkup.match(/data-five-simulation-modal/g) || []).length, 1);
}

console.log("seeded matchId retry: A != B, read-only render, quota/stale same-button retry, stale replacement and double tap OK");
