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
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-3-3", bossLevel: 0, startingXIPlayerIds: players.map(({ playerId }) => playerId) }],
};

function match(type = "boss", state = "simulating") {
  return {
    matchId: `match-${type}`, type, nodeId: "node", previousNodeId: "previous", bossIndex: 0,
    state: state === "completed" ? "completed-defeat" : state, result: state === "completed" ? undefined : null, log: [],
    opponents: type === "five_v_five" ? Array.from({ length: 5 }, (_, index) => ({ playerId: `o${index}` })) : undefined,
    simulation: { valid: true, state, winner: "opponent", score: { user: 0, opponent: 1 }, displayedScore: { user: 0, opponent: 0 }, revealedCount: 0,
      resolutionApplied: false, timeline: [{ minute: 10, type: "goal", team: "opponent", text: "Gol" }] },
  };
}

function baseRun(activeMatch) {
  return {
    runId: "runtime-fail-stop", seasonId: "ie1", phase: "match", lives: 1, gameOver: false, bossIndex: 0, consecutiveLosses: 0,
    completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [],
    roster: players.map(({ playerId }) => ({ playerId, source: "ie1", level: 0 })), lineup: players.map(({ playerId }) => playerId), bench: [], inventory: [],
    formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, permanentEffectOutbox: [],
    currentZone: { currentNodeId: "node", startNodeId: "previous", nodes: [{ id: "node", type: activeMatch.type }, { id: "previous", type: "start" }], completedNodeIds: [] },
    activeMatch,
  };
}

function runtimeFor(activeMatch) {
  const storage = new BudgetStorage(Infinity);
  const runtime = load(storage, { run: baseRun(activeMatch), seasonDb });
  const context = runtime.context;
  context.fetch = () => { throw new Error("network must not be used by local match runtime"); };
  context.MatchSimulatorConfig = { eventDelayMs: 1, playbackMs: 1 };
  context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  context.SeasonRegistry.player = id => players.find(player => player.playerId === String(id));
  context.MatchSimulator.simulate = ({ seed }) => ({ valid: true, seed, winner: "opponent", score: { user: 0, opponent: 1 }, displayedScore: { user: 0, opponent: 0 }, timeline: [{ minute: 10, type: "goal", team: "opponent", text: "Gol" }], probabilities: { userChance: 40, opponentChance: 60 }, userStrength: {}, opponentStrength: {} });
  context.RunStatistics.applyCompletedMatchStatistics = current => { current.statistics.matches = Number(current.statistics.matches || 0) + 1; };
  context.SpecialMatchRuntime.complete = current => { current.pendingSpecialMatchReward = { specialMatchId: "special", status: "pending" }; };
  context.MapEngine.completeNode = (zone, nodeId) => { if (!zone.completedNodeIds.includes(nodeId)) zone.completedNodeIds.push(nodeId); };
  let timers = 0;
  context.setTimeout = () => { timers += 1; return timers; };
  context.clearTimeout = () => {};
  const realSave = context.RunState.save.bind(context.RunState);
  return { runtime, context, realSave, timers: () => timers, fail: () => { context.RunState.save = () => { throw Object.assign(new Error("injected"), { code: "stale-write" }); }; }, recover: () => { context.RunState.save = realSave; } };
}

// Event, completion and skip failures must rollback and must not arm a replacement timer.
{
  const preMatch = match("boss", "pre-match"); preMatch.simulation = null; preMatch.state = "pre-match";
  const h = runtimeFor(preMatch); h.fail();
  const result = h.runtime.seam.startMatchSimulation(h.runtime.seam.getRun().activeMatch, { boss: seasonDb.bossOrder[0] });
  assert.strictEqual(result.suspended, true); assert.strictEqual(h.runtime.seam.getUi().matchPlaybackTimer, null);
  assert.strictEqual(h.runtime.canonical.activeMatch.state, "pre-match"); assert.strictEqual(h.runtime.canonical.activeMatch.simulation, null);
}
{
  const h = runtimeFor(match()); h.fail();
  const result = h.runtime.seam.stepMatchPlayback();
  assert.strictEqual(result.suspended, true); assert.strictEqual(h.runtime.seam.getUi().matchPlaybackTimer, null);
  assert.strictEqual(h.runtime.canonical.activeMatch.simulation.revealedCount, 0);
  const beforeResumeTimers = h.timers(); h.recover(); h.runtime.seam.resumeMatchSimulationIfNeeded(h.runtime.seam.getRun().activeMatch); assert.strictEqual(h.timers(), beforeResumeTimers + 1, "a later explicit recovery may resume");
}
{
  const completedCursor = match(); completedCursor.simulation.revealedCount = 1;
  const h = runtimeFor(completedCursor); h.fail();
  const result = h.runtime.seam.stepMatchPlayback();
  assert.strictEqual(result.suspended, true); assert.strictEqual(h.runtime.seam.getUi().matchPlaybackTimer, null);
  assert.strictEqual(h.runtime.canonical.activeMatch.simulation.state, "simulating");
}
{
  const h = runtimeFor(match()); h.fail();
  const result = h.runtime.seam.skipMatchToResult();
  assert.strictEqual(result.suspended, true); assert.strictEqual(h.runtime.seam.getUi().matchPlaybackTimer, null);
  assert.strictEqual(h.runtime.canonical.activeMatch.simulation.revealedCount, 0);
}

// Completed-unresolved resolution failures remain retryable without recursion for every match family.
for (const type of ["five_v_five", "special_match", "boss"]) {
  const unresolved = match(type, "completed");
  if (type === "special_match") unresolved.specialMatchId = "special";
  const h = runtimeFor(unresolved); h.fail();
  const before = structuredClone(h.runtime.canonical);
  const result = h.runtime.seam.resumeMatchSimulationIfNeeded(h.runtime.seam.getRun().activeMatch);
  assert.strictEqual(result.suspended, true, `${type}: resolution failure is suspended`);
  assert.strictEqual(h.runtime.seam.getUi().matchPlaybackTimer, null, `${type}: no playback timer`);
  assert.strictEqual(h.runtime.canonical.activeMatch.simulation.resolutionApplied, false);
  assert.strictEqual(h.runtime.canonical.lives, before.lives); assert.deepStrictEqual(h.runtime.canonical.statistics, before.statistics);
  for (let click = 0; click < 2; click += 1) {
    const retry = h.runtime.seam.continueAfterMatch();
    assert.strictEqual(retry.suspended, true, `${type}: stale/double Continue remains fail-stopped`);
    assert(h.runtime.canonical.activeMatch, `${type}: unresolved match cannot be cleared`);
    assert.strictEqual(h.runtime.canonical.activeMatch.postMatchNavigationApplied, undefined);
    assert.strictEqual(h.runtime.canonical.phase, "match"); assert.strictEqual(h.runtime.canonical.lives, before.lives);
    assert.deepStrictEqual(h.runtime.canonical.statistics, before.statistics); assert.strictEqual(h.runtime.canonical.activeMatch.simulation.resolutionApplied, false);
  }
  h.recover(); h.runtime.seam.continueAfterMatch();
  assert.strictEqual(h.runtime.canonical.activeMatch.simulation.resolutionApplied, true, `${type}: explicit retry commits`);
  assert.strictEqual(h.runtime.canonical.lives, 1 - h.context.RunState.getLifeDamageForMatch(type), `${type}: configured life damage is consumed once`);
  assert.strictEqual(h.runtime.canonical.statistics.matches, 1, `${type}: statistics apply once`);
  assert(h.runtime.canonical.activeMatch, `${type}: the resolution retry itself does not navigate`);
  assert.strictEqual(h.runtime.canonical.activeMatch.postMatchNavigationApplied, undefined);
  if (type === "boss") {
    assert.strictEqual(h.runtime.canonical.gameOver, true, "last-life retry reaches game over once");
    assert.strictEqual(h.runtime.canonical.permanentEffectOutbox.filter(effect => effect.type === "development-run-end").length, 1);
  }
  h.runtime.seam.continueAfterMatch();
  assert.strictEqual(h.runtime.canonical.activeMatch, null, `${type}: only a later Continue may navigate`);
}

// The mounted control distinguishes a definitive timeline from a durable resolution.
{
  const h = runtimeFor(match("boss", "completed"));
  const button = { hidden: true, disabled: false, textContent: "Continua", dataset: {} };
  h.context.document.getElementById = id => id === "continue-match-result" ? button : null;
  h.context.document.querySelector = () => null; h.context.document.querySelectorAll = () => [];
  h.runtime.seam.updateMatchControlsDom();
  assert.strictEqual(button.hidden, false); assert.strictEqual(button.disabled, false); assert.strictEqual(button.textContent, "Riprova finalizzazione");
  h.runtime.seam.getRun().activeMatch.simulation.resolutionApplied = true;
  h.runtime.seam.updateMatchControlsDom();
  assert.strictEqual(button.textContent, "Continua");
}

// Durable post-match navigation rolls back as one unit and remains retryable.
{
  const resolved = match("five_v_five", "completed"); resolved.result = "defeat"; resolved.simulation.resolutionApplied = true;
  resolved.pendingPostMatchAction = { type: "map", toast: "done" };
  const h = runtimeFor(resolved); h.fail();
  const failed = h.runtime.seam.continueAfterMatch();
  assert.strictEqual(failed.suspended, true); assert(h.runtime.canonical.activeMatch); assert.strictEqual(h.runtime.canonical.phase, "match");
  assert.strictEqual(h.runtime.canonical.activeMatch.postMatchNavigationApplied, undefined);
  h.recover(); h.runtime.seam.continueAfterMatch(); assert.strictEqual(h.runtime.canonical.activeMatch, null); assert.strictEqual(h.runtime.canonical.phase, "map");
}

// Back cannot orphan an active simulation or bypass completed-unresolved recovery.
{
  const h = runtimeFor(match("boss", "simulating")); h.runtime.seam.leaveMatchViaSectionRoot(); assert(h.runtime.canonical.activeMatch); assert.strictEqual(h.runtime.canonical.phase, "match");
}
{
  const h = runtimeFor(match("boss", "completed")); h.fail(); h.runtime.seam.leaveMatchViaSectionRoot(); assert(h.runtime.canonical.activeMatch); assert.strictEqual(h.runtime.canonical.activeMatch.simulation.resolutionApplied, false);
}

// DEV forced defeat uses the same frozen checkpoint and does not resolve after a failed checkpoint save.
{
  const forced = match("boss");
  const h = runtimeFor(forced); h.fail();
  const failed = h.runtime.seam.forceMatchOutcome("defeat", { boss: seasonDb.bossOrder[0] });
  assert.strictEqual(failed.suspended, true); assert.strictEqual(h.runtime.canonical.lives, 1); assert.strictEqual(h.runtime.canonical.statistics.matches, undefined);
  h.recover(); h.runtime.seam.forceMatchOutcome("defeat", { boss: seasonDb.bossOrder[0] });
  assert.strictEqual(h.runtime.canonical.lives, 0); assert.strictEqual(h.runtime.canonical.statistics.matches, 1);
  assert.strictEqual(h.runtime.canonical.permanentEffectOutbox.length, 1);
}

// Legacy partial defeat recovery reconstructs routing only, without replaying durable effects.
{
  const legacy = match("five_v_five", "completed"); legacy.result = "defeat"; legacy.simulation.resolutionApplied = true;
  const run = baseRun(legacy); run.phase = "map"; run.lives = 1; run.statistics.matches = 1; run.currentZone.currentNodeId = "previous";
  const storage = new BudgetStorage(Infinity); const runtime = load(storage, { run, seasonDb });
  runtime.seam.recoverLegacyResolvedMatchRoutingIfNeeded(runtime.seam.getRun().activeMatch);
  assert.strictEqual(runtime.canonical.activeMatch.pendingPostMatchAction.type, "map");
  assert.strictEqual(runtime.canonical.lives, 1); assert.strictEqual(runtime.canonical.statistics.matches, 1);
  assert.strictEqual(runtime.canonical.activeMatch.log.filter(event => event.minute === "FT").length, 1);
  runtime.seam.recoverLegacyResolvedMatchRoutingIfNeeded(runtime.seam.getRun().activeMatch);
  assert.strictEqual(runtime.canonical.activeMatch.log.filter(event => event.minute === "FT").length, 1);
}

console.log("match recovery fail-stop runtime: playback, completed recovery, forced outcome and legacy routing OK");
