"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const formation = { id: "1-2-1", slots: [
  { key: "GK", role: "GK", line: "goal" }, { key: "DF", role: "DF", line: "defense" },
  { key: "MF1", role: "MF", line: "midfield" }, { key: "MF2", role: "MF", line: "midfield" },
  { key: "FW", role: "FW", line: "attack" },
] };
const makePlayers = prefix => formation.slots.map((slot, index) => ({ playerId: `${prefix}-${index}`, name: `${prefix} ${index}`, position: slot.role, overall: 60, category: "Normale", stats: {} }));
const users = makePlayers("user");
const opponents = makePlayers("opponent");
const seasonDb = { seasonId: "ie1", players: users, teams: [], formations: { eleven: [{ id: "4-3-3", requirements: {}, slotRoles: [] }] }, bossOrder: [{ teamId: "boss", teamName: "Boss" }] };
const FiveVFive = {
  formations: [formation], formationById: () => formation, emptySlots: () => ({}),
  ensure: current => current.fiveVFive,
  validate: current => ({ valid: Object.values(current.fiveVFive.slots).filter(Boolean).length === 5, formation, assignedCount: 5, messages: [] }),
};

function simulation(seed) {
  return { valid: true, seed, winner: "user", score: { user: 1, opponent: 0 }, displayedScore: { user: 0, opponent: 0 },
    timeline: [{ minute: 5, type: "goal", team: "user", text: "Gol" }], probabilities: { userChance: 50, opponentChance: 50 },
    userStrength: { averageOverall: 60, final: 60 }, opponentStrength: { averageOverall: 60, final: 60 } };
}

function baseRun(id = "five-boundary") {
  const match = { matchId: `${id}-match`, type: "five_v_five", nodeId: "five-node", previousNodeId: "start", attemptNumber: 1,
    state: "pre-match", score: [0, 0], log: [], result: null, opponents: opponents.map(({ playerId }) => ({ playerId })), opponentFormation: formation.id };
  return { version: 2, runId: id, seasonId: "ie1", phase: "match", bossIndex: 0, teamLevel: 0, lives: 2, consecutiveLosses: 0,
    roster: users.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: [], bench: [], inventory: [], statistics: {}, formationId: "4-3-3", teamIdentity: { name: "Raimon" },
    fiveVFive: { formation: formation.id, slots: Object.fromEntries(formation.slots.map((slot, index) => [slot.key, users[index].playerId])) }, activeMatch: match,
    currentZone: { currentNodeId: "five-node", pendingNodeId: null, startNodeId: "start", completedNodeIds: [], nodes: [{ id: "start", type: "start" }, { id: "five-node", type: "five_v_five" }], edges: [["start", "five-node"]] } };
}

function open(run = baseRun()) {
  const storage = new BudgetStorage(Infinity);
  const rt = load(storage, { run, seasonDb, contextOverrides: { FiveVFive } });
  rt.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: opponents } });
  rt.context.SeasonRegistry.player = id => users.find(player => player.playerId === String(id));
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RunStatistics.createStableMatchId = (_run, match) => match.matchId;
  rt.context.MatchSimulator.simulate = ({ seed }) => simulation(seed);
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1000, playbackMs: 1000 };
  let timers = 0;
  rt.context.setTimeout = () => { timers += 1; return timers; };
  rt.context.clearTimeout = () => {};
  return { rt, storage, timers: () => timers };
}

// This is the automatic reproduction of the old dead-end: before the fix the
// first render decorated activeMatch, and the click opened an uncloseable
// PRE-PARTITA / 0-0 / IN ATTESA modal before the failing save.
for (const injected of [
  Object.assign(new Error("stale"), { code: "stale-write" }),
  Object.assign(new Error("quota"), { name: "QuotaExceededError" }),
]) {
  const { rt, timers } = open(baseRun(`failure-${injected.code || injected.name}`));
  rt.seam.renderMatch({ allowAutomaticResume: false });
  assert.strictEqual(rt.seam.getRun().activeMatch.simulation, undefined, "prematch render is read-only");
  const button = rt.context.document.getElementById("simulate-boss-match");
  const realSave = rt.context.RunState.save.bind(rt.context.RunState);
  let attempts = 0;
  const timersBeforeFailure = timers();
  rt.context.RunState.save = () => { attempts += 1; throw injected; };
  button.click();
  assert.strictEqual(attempts, 1);
  assert.strictEqual(rt.modalMarkup, "", "a failed start must not expose the pre-commit simulation modal");
  assert.strictEqual(rt.canonical.activeMatch.state, "pre-match");
  assert.strictEqual(rt.canonical.activeMatch.simulation, undefined);
  assert.strictEqual(rt.seam.getUi().matchStartLocked, false);
  assert.strictEqual(rt.seam.getUi().matchPlaybackTimer, null);
  const timersAfterFailure = timers();
  assert.ok(timersAfterFailure >= timersBeforeFailure, "failure UI may schedule only its transient toast");
  let retryAttempts = 0;
  rt.context.RunState.save = current => { retryAttempts += 1; return realSave(current); };
  button.click();
  assert.strictEqual(attempts, 1, "the injected save was attempted exactly once before recovery");
  assert.strictEqual(retryAttempts, 1, "the same mounted button performs one new match-simulation-start save");
  assert.strictEqual(rt.canonical.activeMatch.state, "simulating", "the same mounted action remains retryable");
  assert.strictEqual(rt.canonical.activeMatch.simulation.state, "simulating");
  assert.match(rt.modalMarkup, /data-match-state="simulating"/, "retry opens the committed simulation modal without a rerender");
  assert.match(rt.modalMarkup, />Live</);
  assert.strictEqual(timers(), timersAfterFailure + 1, "retry arms exactly one playback timer");
}

// Commit ordering, one mutation under a rapid double tap, and deterministic
// real RNG regardless of how many disposable previews were rendered.
function successfulStart(renderCount) {
  const { rt, timers } = open(baseRun(`rng-parity`));
  for (let index = 0; index < renderCount; index += 1) rt.seam.renderMatch({ allowAutomaticResume: false });
  const button = renderCount ? rt.context.document.getElementById("simulate-boss-match") : null;
  const realSave = rt.context.RunState.save.bind(rt.context.RunState);
  let starts = 0;
  rt.context.RunState.save = current => {
    if (current.activeMatch?.state === "simulating") {
      starts += 1;
      assert.strictEqual(rt.modalMarkup, "", "modal opens only after persistence returns successfully");
    }
    return realSave(current);
  };
  if (button) { button.click(); button.click(); }
  else { rt.seam.startMatchSimulation(rt.seam.getRun().activeMatch); rt.seam.startMatchSimulation(rt.seam.getRun().activeMatch); }
  const match = rt.canonical.activeMatch;
  assert.strictEqual(starts, 1); assert.strictEqual(timers(), 1);
  if (button) { assert.match(rt.modalMarkup, /data-match-state="simulating"/); assert.match(rt.modalMarkup, />Live</); }
  assert.strictEqual(match.simulation.seed, "rng-parity:five_v_five:five-node:1");
  assert.deepStrictEqual(match.score, [0, 0]); assert.strictEqual(match.simulation.revealedCount, 0);
  assert.strictEqual(match.simulation.resolutionApplied, false);
  return JSON.stringify({ seed: match.simulation.seed, score: match.simulation.score, timeline: match.simulation.timeline });
}
assert.strictEqual(successfulStart(0), successfulStart(3), "preview renders cannot alter the real simulation");

// Refresh pre-match, legacy preview snapshots, stale callbacks, and resume.
{
  const pre = open(baseRun("refresh-pre")); pre.rt.seam.renderMatch({ allowAutomaticResume: false });
  pre.rt.context.document.getElementById("simulate-boss-match").click();
  assert.strictEqual(pre.rt.canonical.activeMatch.state, "simulating");
}
{
  const run = baseRun("legacy-preview"); run.activeMatch.simulation = { ...simulation(null), state: "pre-match", userSnapshot: { lineupSignature: "legacy" } };
  const { rt } = open(run); const result = rt.seam.startMatchSimulation(rt.seam.getRun().activeMatch);
  assert.strictEqual(result.ok, true); assert.strictEqual(rt.canonical.activeMatch.simulation.seed, "legacy-preview:five_v_five:five-node:1");
}
{
  const { rt } = open(baseRun("stale-callback")); const stale = rt.seam.getRun().activeMatch;
  const replacement = structuredClone(rt.seam.getRun()); replacement.activeMatch.matchId = "replacement";
  rt.seam.setContext({ run: replacement });
  assert.strictEqual(rt.seam.startMatchSimulation(stale).ok, false);
  assert.strictEqual(rt.seam.getRun().activeMatch.matchId, "replacement");
  assert.strictEqual(rt.seam.getRun().activeMatch.state, "pre-match");
}
{
  const run = baseRun("resume"); run.activeMatch.state = "simulating"; run.activeMatch.simulation = { ...simulation("resume:five_v_five:five-node:1"), state: "simulating", revealedCount: 0, resolutionApplied: false };
  const { rt, timers } = open(run); rt.seam.resumeMatchSimulationIfNeeded(rt.seam.getRun().activeMatch);
  assert.strictEqual(timers(), 1); assert.strictEqual(rt.canonical.activeMatch.simulation.seed, "resume:five_v_five:five-node:1");
}

console.log("five prematch commit boundary: read-only preview, commit-first modal, failures, retry, double-click, refresh, legacy, stale identity and RNG parity OK");
