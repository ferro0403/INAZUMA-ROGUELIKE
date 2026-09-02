"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const formation = { id: "1-2-1", slots: [
  { key: "GK", role: "GK" }, { key: "DF", role: "DF" }, { key: "MF1", role: "MF" },
  { key: "MF2", role: "MF" }, { key: "FW", role: "FW" },
] };
const players = formation.slots.map((slot, index) => ({ playerId: `p${index}`, name: `P${index}`, position: slot.role, overall: 60, stats: {} }));
const opponents = formation.slots.map((slot, index) => ({ playerId: `o${index}`, name: `O${index}`, position: slot.role, overall: 50, stats: {} }));
const seasonDb = { seasonId: "ie1", players, teams: [], formations: { eleven: [] }, bossOrder: [{ teamId: "boss" }] };
const FiveVFive = {
  formations: [formation], formationById: () => formation, emptySlots: () => ({}), ensure: current => current.fiveVFive,
  validate: () => ({ valid: true, formation, assignedCount: 5, messages: [] }),
};

function simulation(state = "completed", winner = "user") {
  return { valid: true, seed: "seed", state, winner, resolutionApplied: false, manuallyResolved: false, revealedCount: 1,
    score: winner === "user" ? { user: 1, opponent: 0 } : { user: 0, opponent: 1 }, displayedScore: { user: 1, opponent: 0 },
    timeline: [{ minute: 5, type: "goal", team: winner, text: "Gol" }], userSnapshot: { playerIds: players.map(p => p.playerId) } };
}

function run(id, state = "completed", winner = "user") {
  return { version: 2, runId: id, seasonId: "ie1", phase: "match", teamLevel: 0, lives: 2, consecutiveLosses: 0,
    roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: [], bench: [], inventory: [], statistics: {},
    formationId: "4-3-3", teamIdentity: { name: "Raimon" }, fiveVFive: { formation: formation.id, slots: Object.fromEntries(formation.slots.map((slot, i) => [slot.key, players[i].playerId])) },
    activeMatch: { matchId: `${id}-match`, type: "five_v_five", nodeId: "five", previousNodeId: "start", state: state === "completed" ? `completed-${winner === "user" ? "victory" : "defeat"}` : state,
      score: [0, 0], log: [], opponents: opponents.map(({ playerId }) => ({ playerId })), opponentFormation: formation.id, simulation: simulation(state, winner) },
    currentZone: { currentNodeId: "five", pendingNodeId: null, startNodeId: "start", path: ["start"], completedNodeIds: [], nodes: [{ id: "start", type: "start" }, { id: "five", type: "five_v_five" }], edges: [["start", "five"]] } };
}

function open(initial) {
  const storage = new BudgetStorage(Infinity);
  const rt = load(storage, { run: initial, seasonDb, contextOverrides: { FiveVFive } });
  rt.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: opponents } });
  rt.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RunStatistics.createStableMatchId = (_run, match) => match.matchId;
  rt.context.MatchSimulator.simulate = ({ seed }) => ({ ...simulation("pre-match"), seed });
  rt.context.MatchSimulatorConfig = { eventDelayMs: 1000, playbackMs: 1000 };
  return { rt, storage };
}

function configureReopened(rt) {
  rt.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: opponents } });
  rt.context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.context.RunStatistics.createStableMatchId = (_run, match) => match.matchId;
  return rt;
}

function resolve(rt, result = "victory") {
  rt.seam.completeFiveMatch(result);
  const current = rt.canonical;
  assert.strictEqual(current.activeMatch.simulation.resolutionApplied, true);
  assert.strictEqual(current.activeMatch.result, result);
  assert.strictEqual(current.phase, "match");
  assert.strictEqual(current.activeMatch.pendingPostMatchAction.type, result === "defeat" && current.gameOver ? "game-over" : "map");
  return current;
}

// Checkpoint A and B: resolution remains visible and durable until the separately persisted navigation.
{
  const initial = run("production-path", "pre-match"); initial.activeMatch.simulation = undefined;
  const { rt } = open(initial);
  assert.strictEqual(rt.seam.startMatchSimulation(rt.seam.getRun().activeMatch).ok, true);
  assert.strictEqual(rt.canonical.activeMatch.simulation.state, "simulating");
  rt.seam.stepMatchPlayback();
  assert.strictEqual(rt.canonical.activeMatch.simulation.revealedCount, 1);
  rt.seam.stepMatchPlayback();
  assert.strictEqual(rt.canonical.activeMatch.simulation.state, "completed");
  assert.strictEqual(rt.canonical.activeMatch.simulation.resolutionApplied, true);
  assert.ok(rt.canonical.activeMatch, "resolution does not clear activeMatch");
  rt.seam.continueAfterMatch();
  assert.strictEqual(rt.canonical.activeMatch, null);
  assert.strictEqual(rt.canonical.phase, "map");
}
{
  const { rt } = open(run("success"));
  const resolved = resolve(rt);
  assert.deepStrictEqual(resolved.currentZone.completedNodeIds, ["five"]);
  assert.ok(resolved.roster.every(entry => entry.level === 1), "the 5v5 level reward is applied exactly once");
  rt.seam.completeFiveMatch("victory");
  assert.ok(rt.canonical.roster.every(entry => entry.level === 1), "repeated resolution is idempotent");
  rt.seam.continueAfterMatch();
  assert.strictEqual(rt.canonical.activeMatch, null);
  assert.strictEqual(rt.canonical.phase, "map");
  rt.seam.continueAfterMatch();
  assert.deepStrictEqual(rt.canonical.currentZone.completedNodeIds, ["five"]);
}

// Resolution rollback (stale and quota) leaves no canonical reward/result, then retries once.
for (const failure of [Object.assign(new Error("stale"), { code: "stale-write" }), Object.assign(new Error("quota"), { name: "QuotaExceededError" })]) {
  const { rt } = open(run(`resolution-${failure.code || failure.name}`));
  const save = rt.context.RunState.save.bind(rt.context.RunState);
  rt.context.RunState.save = () => { throw failure; };
  rt.seam.completeFiveMatch("victory");
  const failed = rt.canonical.activeMatch;
  assert.strictEqual(failed.simulation.resolutionApplied, false);
  assert.strictEqual(failed.result, undefined);
  assert.strictEqual(failed.pendingPostMatchAction, undefined);
  assert.deepStrictEqual(rt.canonical.currentZone.completedNodeIds, []);
  assert.ok(rt.canonical.roster.every(entry => entry.level === 0));
  rt.context.RunState.save = save;
  resolve(rt);
  assert.ok(rt.canonical.roster.every(entry => entry.level === 1));
}

// The mounted Continua survives navigation failure and retries the same canonical match.
{
  const { rt } = open(run("same-button")); resolve(rt); rt.seam.renderMatch({ allowAutomaticResume: false });
  const button = rt.context.document.getElementById("continue-match-result");
  const save = rt.context.RunState.save.bind(rt.context.RunState);
  rt.context.RunState.save = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  button.click();
  assert.ok(rt.canonical.activeMatch);
  assert.strictEqual(rt.canonical.activeMatch.simulation.resolutionApplied, true);
  assert.strictEqual(rt.canonical.activeMatch.pendingPostMatchAction.type, "map");
  assert.notStrictEqual(rt.canonical.activeMatch.postMatchNavigationApplied, true);
  rt.context.RunState.save = save;
  button.click();
  assert.strictEqual(rt.canonical.activeMatch, null);
  assert.strictEqual(rt.canonical.phase, "map");
}

// A callback mounted for A must not navigate replacement match B; rapid double tap commits only A once.
{
  const { rt } = open(run("stale-a")); resolve(rt); rt.seam.renderMatch({ allowAutomaticResume: false });
  const staleButton = rt.context.document.getElementById("continue-match-result");
  const replacement = run("replacement-b"); replacement.activeMatch.simulation.resolutionApplied = true; replacement.activeMatch.result = "victory"; replacement.activeMatch.pendingPostMatchAction = { type: "map" };
  rt.seam.setContext({ run: replacement });
  staleButton.click();
  assert.strictEqual(rt.seam.getRun().activeMatch.matchId, "replacement-b-match");
  assert.strictEqual(rt.seam.getRun().phase, "match");
}
{
  const { rt } = open(run("double-tap")); resolve(rt); rt.seam.renderMatch({ allowAutomaticResume: false });
  const button = rt.context.document.getElementById("continue-match-result"); button.click(); button.click();
  assert.strictEqual(rt.canonical.activeMatch, null); assert.strictEqual(rt.canonical.phase, "map");
}

// Refresh both checkpoints: unresolved completion resumes resolution; resolved completion restores Continua.
{
  const opened = open(run("refresh-unresolved")); const reopened = configureReopened(opened.rt.reopen());
  reopened.seam.resumeMatchSimulationIfNeeded(reopened.seam.getRun().activeMatch);
  assert.strictEqual(reopened.canonical.activeMatch.simulation.resolutionApplied, true);
}
{
  const opened = open(run("refresh-resolved")); resolve(opened.rt); const reopened = configureReopened(opened.rt.reopen());
  reopened.seam.renderMatch({ allowAutomaticResume: false }); reopened.context.document.getElementById("continue-match-result").click();
  assert.strictEqual(reopened.canonical.phase, "map"); assert.strictEqual(reopened.canonical.activeMatch, null);
}

// Skip uses the same resolution/navigation contract.
{
  const initial = run("skip", "simulating"); initial.activeMatch.simulation.revealedCount = 0;
  const { rt } = open(initial); rt.seam.skipMatchToResult();
  assert.strictEqual(rt.canonical.activeMatch.simulation.resolutionApplied, true);
  rt.seam.continueAfterMatch(); assert.strictEqual(rt.canonical.phase, "map");
}

// Shared defeat behavior: restore once with lives left; last life remains game over.
{
  const { rt } = open(run("defeat", "completed", "opponent")); resolve(rt, "defeat");
  const remainingLives = rt.canonical.lives; assert.ok(remainingLives > 0); rt.seam.completeFiveMatch("defeat"); assert.strictEqual(rt.canonical.lives, remainingLives);
  rt.seam.continueAfterMatch(); assert.strictEqual(rt.canonical.phase, "map");
}
{
  const initial = run("last-life", "completed", "opponent"); initial.lives = 0.5;
  const { rt } = open(initial); resolve(rt, "defeat"); rt.seam.continueAfterMatch();
  assert.strictEqual(rt.canonical.gameOver, true); assert.strictEqual(rt.canonical.phase, "gameover");
}

console.log("five postmatch boundary: checkpoints, failures, same-button retry, stale callback, double tap, refresh, skip, reward and defeat OK");
