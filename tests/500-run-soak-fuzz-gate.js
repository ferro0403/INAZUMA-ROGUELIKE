"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const freeAgents = require("../data/FREE_AGENTS_compact.json");
const seasons = [
  { id: "ie1", db: require("../data/IE1_season_compact.json") },
  { id: "ie2", db: require("../data/IE2_season_compact.json") },
  { id: "ie1_s2", db: require("../data/IE1_S2_season_compact.json") },
  { id: "ie1_s3", db: require("../data/IE1_S3_season_compact.json") },
  { id: "orion", db: require("../data/ORION_season_compact.json") },
];

const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const fivePositions = ["GK", "DF", "MF", "MF", "FW"];
const settle = () => new Promise((resolve) => setImmediate(resolve));

function rngFrom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function canonicalId(entry) { return String(entry?.playerId ?? ""); }

function snapshot(run) {
  if (!run) return null;
  return {
    runId: run.runId,
    seasonId: run.seasonId,
    phase: run.phase,
    lives: run.lives,
    gameOver: Boolean(run.gameOver),
    bossIndex: Number(run.bossIndex || 0),
    completedBossIds: [...(run.completedBossIds || [])],
    activeMatch: run.activeMatch && { matchId: run.activeMatch.matchId, type: run.activeMatch.type, state: run.activeMatch.state, result: run.activeMatch.result, pendingPostMatchAction: run.activeMatch.pendingPostMatchAction?.type || null },
    currentNodeId: run.currentZone?.currentNodeId || null,
    pendingNodeId: run.currentZone?.pendingNodeId || null,
    completedNodeIds: [...(run.currentZone?.completedNodeIds || [])],
    postBoss: run.postBossFlow && { remainingRewards: run.postBossFlow.remainingRewards, rewardNumber: run.postBossFlow.rewardNumber },
    pendingBossVictory: Boolean(run.pendingBossVictory),
    pendingSpecialReward: Boolean(run.pendingSpecialMatchReward),
    rewardSeen: run.developmentRewardPresentation?.seen,
    outbox: (run.permanentEffectOutbox || []).map((effect) => [effect.type, effect.status, effect.effectId || effect.id || null]),
  };
}

function fail(label, meta, run, extra = null) {
  const error = new Error(`${label} | seed=${meta.seed} run=${meta.index} season=${meta.seasonId} scenario=${meta.scenario}`);
  error.soak = { ...meta, snapshot: snapshot(run), extra };
  throw error;
}

function expect(condition, label, meta, run, extra = null) {
  if (!condition) fail(label, meta, run, extra);
}

function assertInvariants(run, meta) {
  expect(Boolean(run), "canonical run missing", meta, run);
  const rosterIds = (run.roster || []).map(canonicalId).filter(Boolean);
  const lineupIds = (run.lineup || []).map(String);
  const benchIds = (run.bench || []).map(String);
  expect(new Set(rosterIds).size === rosterIds.length, "duplicate player in roster", meta, run, rosterIds);
  expect(new Set(lineupIds).size === lineupIds.length, "duplicate player in lineup", meta, run, lineupIds);
  expect(new Set(benchIds).size === benchIds.length, "duplicate player in bench", meta, run, benchIds);
  expect(!lineupIds.some((id) => benchIds.includes(id)), "player simultaneously in lineup and bench", meta, run);
  if (rosterIds.length) {
    expect(lineupIds.every((id) => rosterIds.includes(id)), "lineup contains player outside roster", meta, run);
    expect(benchIds.every((id) => rosterIds.includes(id)), "bench contains player outside roster", meta, run);
  }
  expect(new Set(run.completedBossIds || []).size === (run.completedBossIds || []).length, "duplicate completed boss", meta, run);
  if (run.gameOver) expect(run.phase === "gameover", "gameOver run is not in gameover phase", meta, run);
  if (["map", "gameover", "final-celebration", "final-summary", "complete"].includes(run.phase)) {
    expect(!run.activeMatch, "terminal/map phase still owns activeMatch", meta, run);
  }
  if (run.postBossFlow) expect(Boolean(run.pendingBossVictory), "postBossFlow exists without pendingBossVictory", meta, run);
  const effectIds = (run.permanentEffectOutbox || []).map((effect) => String(effect.effectId || effect.id || "")).filter(Boolean);
  expect(new Set(effectIds).size === effectIds.length, "duplicate permanent effect id", meta, run, effectIds);
}

function progressToken(run) { return JSON.stringify(snapshot(run)); }

function expectProgress(before, after, label, meta) {
  expect(progressToken(before) !== progressToken(after), `${label}: no canonical progress`, meta, after, { before: snapshot(before), after: snapshot(after) });
}

function commonRules() {
  return {
    defeatedBossRewardLevel: (boss) => Number(boss?.bossLevel || 1),
    resolveDevelopmentEffectiveMetadata: () => ({}),
    applyEquipment: (stats) => stats,
    isProfileAwareRosterEntry: () => false,
    migrateDefeatedBossPlayerLevels: () => false,
    unlockedTeamPullCategoryWeights: () => null,
  };
}

function quietFetch(seasonDb) {
  return async (url) => ({
    ok: true,
    json: async () => String(url).includes("FREE_AGENTS") ? freeAgents : String(url).includes("PLAYER_VISUALS") ? {} : seasonDb,
  });
}

function baseBossRun(meta, seasonDb, bossIndex, result = "victory", lives = 3) {
  const boss = seasonDb.bossOrder[bossIndex];
  const nodeId = `${meta.runId}-boss-node`;
  return {
    runId: meta.runId, seasonId: meta.seasonId, version: 2, phase: "match", lives, gameOver: false, bossIndex, consecutiveLosses: 0,
    completedBossIds: seasonDb.bossOrder.slice(0, bossIndex).map((entry) => entry.teamId), unlockedTeamIds: [], inventory: [], roster: [], lineup: [], bench: [], formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, permanentEffectOutbox: [],
    currentZone: { bossIndex, bossId: boss.teamId, seed: `${meta.seed}:zone`, currentNodeId: nodeId, startNodeId: "start", pendingNodeId: nodeId, completedNodeIds: [], path: ["start", nodeId], nodes: [{ id: "start", type: "start" }, { id: nodeId, type: "boss", bossId: boss.teamId }], edges: [["start", nodeId]] },
    activeMatch: { matchId: `${meta.runId}:boss:${bossIndex}`, type: "boss", bossIndex, nodeId, previousNodeId: "start", state: result === "victory" ? "completed-victory" : "completed-defeat", result: null, log: [], simulation: { valid: true, state: "completed", winner: result === "victory" ? "user" : "opponent", resolutionApplied: false, manuallyResolved: false, score: result === "victory" ? { user: 2, opponent: 1 } : { user: 0, opponent: 1 }, displayedScore: result === "victory" ? { user: 2, opponent: 1 } : { user: 0, opponent: 1 }, timeline: [] } },
  };
}

function openBoss(meta, seasonDb, run) {
  const storage = new BudgetStorage(6_000_000);
  const runtime = load(storage, { run, seasonDb, contextOverrides: { RoguelikeRules: commonRules(), fetch: quietFetch(seasonDb) } });
  runtime.context.SeasonRegistry.player = (id) => (seasonDb.players || []).find((player) => String(player.playerId) === String(id)) || null;
  runtime.context.SeasonRegistry.playersIndex = () => new Map((seasonDb.players || []).map((player) => [String(player.playerId), player]));
  runtime.context.SeasonRegistry.teamsIndex = () => new Map((seasonDb.teams || []).map((team) => [String(team.teamId), team]));
  return { runtime, storage };
}

async function bossVictoryScenario(meta, seasonDb, random) {
  const bossIndex = Math.min(Math.floor(random() * Math.max(1, seasonDb.bossOrder.length - 1)), Math.max(0, seasonDb.bossOrder.length - 2));
  const run = baseBossRun(meta, seasonDb, bossIndex, "victory", 3);
  let { runtime } = openBoss(meta, seasonDb, run);
  const flow = runtime.seam;
  const before = runtime.canonical;
  flow.completeBossMatch("victory");
  let saved = runtime.canonical;
  expectProgress(before, saved, "boss victory resolution", meta);
  expect(saved.activeMatch?.result === "victory", "boss victory result not persisted", meta, saved);
  expect(Boolean(saved.postBossFlow), "boss victory did not enter postBoss reward flow", meta, saved);
  assertInvariants(saved, meta);

  if (meta.index % 4 === 0) {
    runtime = runtime.reopen({ seasonDb, contextOverrides: { RoguelikeRules: commonRules(), fetch: quietFetch(seasonDb) } });
    await settle();
    saved = runtime.canonical;
    expect(Boolean(saved.postBossFlow), "refresh lost postBoss reward flow", meta, saved);
  }

  while (runtime.seam.getRun().postBossFlow?.remainingRewards > 0) {
    const previous = runtime.canonical;
    runtime.seam.advanceBossReward();
    const next = runtime.canonical;
    expectProgress(previous, next, "boss reward advance", meta);
    assertInvariants(next, meta);
  }
  saved = runtime.canonical;
  expect(saved.completedBossIds.filter((id) => String(id) === String(seasonDb.bossOrder[bossIndex].teamId)).length === 1, "boss completion duplicated or missing", meta, saved);
  expect(Number(saved.bossIndex) === bossIndex + 1, "boss victory did not advance bossIndex exactly once", meta, saved, { expected: bossIndex + 1 });
  expect(!saved.postBossFlow && !saved.pendingBossVictory, "boss transition left pending PostBoss state", meta, saved);
  expect(saved.phase === "map", "non-final boss victory did not return to map", meta, saved);
  assertInvariants(saved, meta);
}

function fiveFixture(meta, result, lastLife = false) {
  const formation = { id: "1-2-1", slots: fivePositions.map((role, index) => ({ key: `${role}${index}`, role })) };
  const players = fivePositions.map((position, index) => ({ playerId: `${meta.runId}-p${index}`, name: `P${index}`, position, overall: 60, finalOverall: 60, stats: {} }));
  const opponents = fivePositions.map((position, index) => ({ playerId: `${meta.runId}-o${index}`, name: `O${index}`, position, overall: 50, finalOverall: 50, stats: {} }));
  const seasonDb = { seasonId: meta.seasonId, players: [...players, ...opponents], teams: [], formations: { eleven: [] }, bossOrder: [{ teamId: "boss" }] };
  const FiveVFive = {
    formations: [formation], formationById: () => formation, emptySlots: () => ({}), ensure: (current) => current.fiveVFive,
    validate: () => ({ valid: true, formation, assignedCount: 5, messages: [] }), assign: () => true,
  };
  const nodeId = `${meta.runId}-five`;
  const run = {
    version: 2, runId: meta.runId, seasonId: meta.seasonId, phase: "match", teamLevel: 0, lives: lastLife ? 0.5 : 3, consecutiveLosses: 0,
    roster: players.map((player) => ({ playerId: player.playerId, source: meta.seasonId, level: 0 })), lineup: [], bench: [], inventory: [], statistics: {}, formationId: "4-3-3", teamIdentity: { name: "Raimon" },
    fiveVFive: { formation: formation.id, slots: Object.fromEntries(formation.slots.map((slot, index) => [slot.key, players[index].playerId])) },
    activeMatch: { matchId: `${meta.runId}-match`, type: "five_v_five", nodeId, previousNodeId: "start", state: "pre-match", score: [0, 0], log: [], opponents: opponents.map(({ playerId }) => ({ playerId })), opponentFormation: formation.id, simulation: undefined },
    currentZone: { currentNodeId: nodeId, pendingNodeId: null, startNodeId: "start", path: ["start", nodeId], completedNodeIds: [], seed: `${meta.seed}:five`, nodes: [{ id: "start", type: "start" }, { id: nodeId, type: "five_v_five" }], edges: [["start", nodeId]] },
  };
  return { formation, players, opponents, seasonDb, FiveVFive, run, result };
}

async function fiveScenario(meta, random) {
  const result = random() < 0.72 ? "victory" : "defeat";
  const lastLife = result === "defeat" && random() < 0.35;
  const fx = fiveFixture(meta, result, lastLife);
  const storage = new BudgetStorage(3_000_000);
  let runtime = load(storage, { run: fx.run, seasonDb: fx.seasonDb, contextOverrides: { FiveVFive: fx.FiveVFive, fetch: quietFetch(fx.seasonDb) } });
  runtime.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: fx.opponents } });
  runtime.context.SeasonRegistry.player = (id) => fx.players.find((player) => player.playerId === String(id));
  runtime.context.MatchSimulatorConfig = { eventDelayMs: 1_000_000, playbackMs: 1_000_000 };
  runtime.context.MatchSimulator.simulate = ({ seed }) => ({ valid: true, seed, state: "pre-match", winner: result === "victory" ? "user" : "opponent", score: result === "victory" ? { user: 1, opponent: 0 } : { user: 0, opponent: 1 }, displayedScore: { user: 0, opponent: 0 }, timeline: [{ minute: 5, type: "goal", team: result === "victory" ? "user" : "opponent", text: "Gol" }], userStrength: {}, opponentStrength: {}, probabilities: {} });
  runtime.context.RunStatistics.createStableMatchId = (_run, match) => match.matchId;
  const flow = runtime.seam;
  const before = runtime.canonical;
  const started = flow.startMatchSimulation(flow.getRun().activeMatch);
  expect(started?.ok === true, "5v5 simulation did not start", meta, runtime.canonical, started);
  expectProgress(before, runtime.canonical, "5v5 simulation start", meta);
  flow.skipMatchToResult();
  let saved = runtime.canonical;
  expect(saved.activeMatch?.simulation?.resolutionApplied === true, "5v5 result not canonically resolved", meta, saved);
  expect(saved.activeMatch?.result === result, "5v5 result mismatch", meta, saved);
  assertInvariants(saved, meta);

  if (meta.index % 5 === 0) {
    runtime = runtime.reopen({ seasonDb: fx.seasonDb, contextOverrides: { FiveVFive: fx.FiveVFive, fetch: quietFetch(fx.seasonDb) } });
    runtime.context.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: fx.opponents } });
    await settle();
    saved = runtime.canonical;
    expect(Boolean(saved.activeMatch), "refresh lost resolved 5v5 before Continue", meta, saved);
  }

  if (meta.index % 7 === 0) {
    const realSave = runtime.context.RunState.save.bind(runtime.context.RunState);
    runtime.context.RunState.save = () => { const error = new Error("soak quota"); error.name = "QuotaExceededError"; throw error; };
    runtime.seam.continueAfterMatch();
    expect(Boolean(runtime.canonical.activeMatch), "failed 5v5 navigation cleared activeMatch", meta, runtime.canonical);
    runtime.context.RunState.save = realSave;
  }

  runtime.seam.continueAfterMatch();
  saved = runtime.canonical;
  if (lastLife) {
    expect(saved.gameOver === true && saved.phase === "gameover", "last-life 5v5 defeat did not reach GameOver", meta, saved);
  } else {
    expect(saved.phase === "map" && !saved.activeMatch, "5v5 Continue did not return to map", meta, saved);
  }
  const afterFirstContinue = progressToken(saved);
  runtime.seam.continueAfterMatch();
  expect(progressToken(runtime.canonical) === afterFirstContinue, "5v5 double Continue changed canonical state twice", meta, runtime.canonical);
  assertInvariants(runtime.canonical, meta);
}

function specialFixture(meta) {
  const players = positions.map((position, index) => ({ playerId: `${meta.runId}-s${index}`, name: `S${index}`, position, overall: 50, finalOverall: 50, category: "Normale", stats: {} }));
  const special = { specialMatchId: "special-1", zoneIndex: 0, teamId: "special-team", teamName: "Special Team", matchLevel: 1, matchFormation: "4-3-3", startingXIPlayerIds: players.map((player) => player.playerId), reward: { candidateCount: 1 } };
  const seasonDb = { seasonId: meta.seasonId, requiresProfileAwareRuntime: false, players, teams: [{ teamId: "special-team", playerIds: players.map((player) => player.playerId) }], specialMatches: [special], formations: { eleven: [{ id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: positions }] }, bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-3-3", bossLevel: 1, startingXIPlayerIds: players.map((player) => player.playerId) }] };
  const nodeId = `${meta.runId}-special`;
  const run = { runId: meta.runId, seasonId: meta.seasonId, version: 2, phase: "match", lives: 3, gameOver: false, bossIndex: 0, consecutiveLosses: 0, completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [], roster: players.map((player) => ({ playerId: player.playerId, source: meta.seasonId, level: 0 })), lineup: players.map((player) => player.playerId), bench: [], inventory: [], formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, teamLevel: 0, currentZone: { bossIndex: 0, bossId: "boss", seed: `${meta.seed}:special`, currentNodeId: nodeId, startNodeId: "start", pendingNodeId: nodeId, completedNodeIds: [], path: ["start", nodeId], nodes: [{ id: "start", type: "start" }, { id: nodeId, type: "special_match", specialMatchId: "special-1", teamId: "special-team", teamName: "Special Team", matchLevel: 1, matchFormation: "4-3-3" }], edges: [["start", nodeId]] }, activeMatch: { matchId: `${meta.runId}:special`, type: "special_match", nodeId, previousNodeId: "start", specialMatchId: "special-1", teamId: "special-team", matchLevel: 1, matchFormation: "4-3-3", state: "completed-victory", result: null, log: [], simulation: { valid: true, state: "completed", winner: "user", resolutionApplied: false, manuallyResolved: false, score: { user: 1, opponent: 0 }, displayedScore: { user: 1, opponent: 0 }, timeline: [] } } };
  return { seasonDb, run };
}

async function specialScenario(meta) {
  const fx = specialFixture(meta);
  const storage = new BudgetStorage(3_000_000);
  let runtime = load(storage, { run: fx.run, seasonDb: fx.seasonDb, useProductionSpecialMatchRuntime: true, contextOverrides: { RoguelikeRules: commonRules(), fetch: quietFetch(fx.seasonDb) } });
  runtime.context.SeasonRegistry.player = (id) => fx.seasonDb.players.find((player) => player.playerId === String(id));
  runtime.context.RecruitmentPoolRuntime.eligible = () => true;
  const before = runtime.canonical;
  runtime.seam.completeSpecialMatch("victory");
  let saved = runtime.canonical;
  expectProgress(before, saved, "special-match victory resolution", meta);
  expect(saved.activeMatch?.pendingPostMatchAction?.type === "special-reward", "special victory did not create reward handoff", meta, saved);
  expect((saved.completedSpecialMatchIds || []).includes("special-1"), "special victory not recorded", meta, saved);
  runtime.seam.continueAfterMatch();
  saved = runtime.canonical;
  expect(Boolean(saved.pendingSpecialMatchReward), "special Continue lost pending reward", meta, saved);
  expect(Boolean(runtime.query("#decline-special-reward")), "special reward UI did not render", meta, saved);
  runtime.query("#decline-special-reward").click();
  saved = runtime.canonical;
  expect(!saved.pendingSpecialMatchReward && !saved.activeMatch && saved.phase === "map", "special reward decline did not advance to map", meta, saved);
  assertInvariants(saved, meta);
}

async function finalVictoryScenario(meta, seasonDb) {
  const finalBossIndex = seasonDb.bossOrder.length - 1;
  const run = baseBossRun(meta, seasonDb, finalBossIndex, "victory", 3);
  const storage = new BudgetStorage(8_000_000);
  let runtime = load(storage, { run, seasonDb, contextOverrides: { RoguelikeRules: commonRules(), fetch: quietFetch(seasonDb) } });
  runtime.seam.completeBossMatch("victory");
  while (runtime.seam.getRun().postBossFlow?.remainingRewards > 0) runtime.seam.advanceBossReward();
  let saved = runtime.canonical;
  expect(saved.finalization?.status === "complete", "final victory did not complete finalization", meta, saved);
  expect(saved.phase === "final-celebration", "final victory canonical phase is not final-celebration", meta, saved);
  expect(runtime.seam.getAppMarkup().includes("data-development-reward-reveal"), "final victory skipped RICOMPENSE RUN", meta, saved);
  expect(runtime.hall.length === 1 && runtime.redeemed.size === 1, "final victory duplicated/missed Hall or Development redemption", meta, saved);
  assertInvariants(saved, meta);

  if (meta.index % 2 === 0) {
    runtime = runtime.reopen({ seasonDb, contextOverrides: { RoguelikeRules: commonRules(), fetch: quietFetch(seasonDb) } });
    await settle();
    await runtime.seam.resumeRun();
    expect(runtime.seam.getAppMarkup().includes("data-development-reward-reveal"), "refresh before reward acknowledgement lost RICOMPENSE RUN", meta, runtime.canonical);
  }

  if (meta.index % 6 === 0) {
    const realSave = runtime.context.RunState.save.bind(runtime.context.RunState);
    runtime.context.RunState.save = () => { const error = new Error("soak quota"); error.name = "QuotaExceededError"; throw error; };
    runtime.query("#development-reward-continue").click();
    expect(runtime.canonical.developmentRewardPresentation?.seen === false, "failed final reward Continue marked receipt seen", meta, runtime.canonical);
    expect(Boolean(runtime.query("#retry-terminal-effect")), "failed final reward Continue exposed no retry", meta, runtime.canonical);
    runtime.context.RunState.save = realSave;
    runtime.query("#retry-terminal-effect").click();
  }

  const rewardContinue = runtime.query("#development-reward-continue");
  expect(Boolean(rewardContinue), "final reward Continue missing", meta, runtime.canonical);
  rewardContinue.click();
  rewardContinue.click();
  saved = runtime.canonical;
  expect(saved.developmentRewardPresentation?.seen === true, "final reward receipt not marked seen", meta, saved);
  expect(runtime.hall.length === 1 && runtime.redeemed.size === 1, "double reward Continue duplicated permanent rewards", meta, saved);
  const finalContinue = runtime.query("#final-continue");
  expect(Boolean(finalContinue), "Celebration Continue missing", meta, saved);
  finalContinue.click();
  saved = runtime.canonical;
  expect(saved.phase === "final-summary", "Celebration did not advance to Summary", meta, saved);
  expect(runtime.seam.getAppMarkup().includes("final-summary-screen"), "Summary UI missing after final victory", meta, saved);
  assertInvariants(saved, meta);
}

function seasonalPullCandidates(db, random) {
  const profiled = (db.recruitmentPool?.entries || []).filter((entry) => entry?.profileId && entry?.playerId);
  const source = profiled.length >= 3 ? profiled : (db.players || []).filter((player) => player?.playerId).map((player) => ({ ...player, pullCandidateKind: "season_profile" }));
  const start = Math.floor(random() * Math.max(1, source.length - 3));
  return source.slice(start, start + 3).map((entry) => ({ ...entry, pullCandidateKind: "season_profile" }));
}

async function legendaryScenario(meta, seasonDb, random) {
  const run = { runId: meta.runId, seasonId: meta.seasonId, version: 2, phase: "map", lives: 3, bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], roster: [], lineup: [], bench: [], inventory: [], formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, currentZone: { seed: `${meta.seed}:pull`, currentNodeId: "pull", pendingNodeId: null, completedNodeIds: [], path: [], nodes: [{ id: "pull", type: "pull_legendary", pullState: { pullType: "pull_legendary", rerolls: 0, candidateIds: [] } }] } };
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run, seasonDb, contextOverrides: { fetch: quietFetch(seasonDb) } });
  const identity = runtime.context.PlayerIdentity;
  runtime.context.RecruitmentPoolRuntime.canonicalPlayerId = identity.canonicalPlayerId;
  runtime.context.RecruitmentPoolRuntime.candidateKey = identity.candidateKey;
  runtime.context.RecruitmentPoolRuntime.eligible = () => true;
  const candidates = seasonalPullCandidates(seasonDb, random);
  expect(candidates.length === 3, "legendary soak could not choose three seasonal candidates", meta, runtime.canonical);
  const keys = candidates.map(identity.candidateKey);
  expect(keys.every(Boolean), "legendary seasonal candidate has empty persisted key", meta, runtime.canonical, candidates.map((candidate, index) => ({ playerId: candidate.playerId, profileId: candidate.profileId, key: keys[index] })));
  expect(new Set(keys).size === 3, "legendary seasonal candidates collapse to duplicate keys", meta, runtime.canonical, keys);
  const node = { id: "pull", pullState: { pullType: "pull_legendary", rerolls: 0, candidateIds: keys.slice() } };
  const pool = { players: candidates, profileAware: candidates.some((candidate) => Boolean(candidate.profileId)) };
  const resolved = runtime.context.PullCandidatesRuntime.resolveCandidateIds(runtime.canonical, pool, node);
  expect(resolved.candidates.length === 3, "persisted legendary offer did not resolve three candidates", meta, runtime.canonical);
  expect(resolved.candidates.map(identity.canonicalPlayerId).join("|") === candidates.map(identity.canonicalPlayerId).join("|"), "persisted legendary offer resolved a different player (sticky identity)", meta, runtime.canonical, { expected: candidates.map(identity.canonicalPlayerId), actual: resolved.candidates.map(identity.canonicalPlayerId) });
  expect(new Set(resolved.candidates.map(identity.canonicalPlayerId)).size === 3, "legendary offer contains duplicate canonical player", meta, runtime.canonical);
}

async function bossDefeatScenario(meta, seasonDb, random) {
  const bossIndex = Math.min(Math.floor(random() * Math.max(1, seasonDb.bossOrder.length)), seasonDb.bossOrder.length - 1);
  const lastLife = random() < 0.45;
  const run = baseBossRun(meta, seasonDb, bossIndex, "defeat", lastLife ? 1 : 3);
  const { runtime } = openBoss(meta, seasonDb, run);
  runtime.seam.completeBossMatch("defeat");
  let saved = runtime.canonical;
  const livesAfterResolution = saved.lives;
  expect(saved.activeMatch?.result === "defeat", "boss defeat result not persisted", meta, saved);
  runtime.seam.completeBossMatch("defeat");
  expect(runtime.canonical.lives === livesAfterResolution, "repeated boss defeat consumed lives twice", meta, runtime.canonical);
  runtime.seam.continueAfterMatch();
  saved = runtime.canonical;
  if (lastLife) expect(saved.gameOver === true && saved.phase === "gameover", "last-life boss defeat did not reach GameOver", meta, saved);
  else expect(saved.phase === "map" && !saved.activeMatch, "boss defeat with lives left did not return to map", meta, saved);
  assertInvariants(saved, meta);
}

async function main() {
  const counters = { bossVictory: 0, five: 0, special: 0, finalVictory: 0, legendary: 0, bossDefeat: 0 };
  const start = Date.now();
  for (let index = 0; index < 500; index += 1) {
    const season = seasons[index % seasons.length];
    const seed = (0x5f3759df ^ Math.imul(index + 1, 2654435761)) >>> 0;
    const random = rngFrom(seed);
    const bucket = index % 10;
    const scenario = bucket <= 1 ? "bossVictory" : bucket <= 3 ? "five" : bucket === 4 ? "special" : bucket <= 6 ? "finalVictory" : bucket === 7 ? "legendary" : "bossDefeat";
    const meta = { index: index + 1, seed, seasonId: season.id, scenario, runId: `soak-${String(index + 1).padStart(3, "0")}-${season.id}-${seed}` };
    try {
      if (scenario === "bossVictory") await bossVictoryScenario(meta, season.db, random);
      else if (scenario === "five") await fiveScenario(meta, random);
      else if (scenario === "special") await specialScenario(meta);
      else if (scenario === "finalVictory") await finalVictoryScenario(meta, season.db);
      else if (scenario === "legendary") await legendaryScenario(meta, season.db, random);
      else await bossDefeatScenario(meta, season.db, random);
      counters[scenario] += 1;
    } catch (error) {
      console.error("500-RUN SOAK FAILURE", error.soak || { index: meta.index, seed: meta.seed, season: meta.seasonId, scenario: meta.scenario }, error);
      throw error;
    }
  }
  const elapsedMs = Date.now() - start;
  assert.deepStrictEqual(counters, { bossVictory: 100, five: 100, special: 50, finalVictory: 100, legendary: 50, bossDefeat: 100 });
  console.log(`500-run soak/fuzz gate: PASS | ${JSON.stringify(counters)} | elapsedMs=${elapsedMs}`);
  console.log("guarded invariants: progression/no-deadlock, match resolution, 5v5 Continue, Special reward handoff, Boss/PostBoss advance, last-life GameOver, legendary identity, final reward -> Celebration -> Summary, exactly-once Hall/Development");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
