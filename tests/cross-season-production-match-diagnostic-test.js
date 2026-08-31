"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const DATABASES = { ie1: "IE1_season_compact.json", ie2: "IE2_season_compact.json", ie1_s2: "IE1_S2_season_compact.json", ie1_s3: "IE1_S3_season_compact.json", orion: "ORION_season_compact.json" };
const traces = [];
function install(context, files) { for (const file of files) vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), context, { filename: file }); }
function startingIds(database, opponent) { return (opponent.startingXIPlayerIds || database.teams.find(team => team.teamId === opponent.teamId)?.playerIds || []).slice(0, 11).map(String); }
function rosterEntries(database, seasonId, opponent, ids) {
  return ids.map(playerId => { const profiles = (database.profiles || []).filter(profile => String(profile.playerId) === playerId); const profile = profiles.find(item => String(item.teamId || "") === String(opponent.teamId)) || profiles[0]; return { playerId, source: seasonId, level: 0, levelUnits: 0, activeProfileId: profile?.profileId, activeRoleVariantId: profile?.defaultRoleVariantId }; });
}
function openScenario(seasonId, type = "boss") {
  const database = require(`../data/${DATABASES[seasonId]}`);
  const opponent = type === "special_match" ? database.specialMatches[0] : database.bossOrder[0];
  const ids = startingIds(database, database.bossOrder[0]);
  const nodeId = type === "special_match" ? "special" : "boss";
  const match = { matchId: `${seasonId}:${type}`, type, nodeId, previousNodeId: "start", bossIndex: 0, state: "pre-match", log: [], simulation: null };
  if (type === "special_match") match.specialMatchId = opponent.specialMatchId;
  const run = { version: 2, runId: `pipeline-${seasonId}-${type}`, seasonId, phase: "match", lives: 2, bossIndex: 0, consecutiveLosses: 0, teamIdentity: { name: seasonId }, roster: rosterEntries(database, seasonId, database.bossOrder[0], ids), lineup: ids, bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], statistics: {}, teamLevel: 0, formationId: database.bossOrder[0].bossFormation || "4-4-2", currentZone: { seed: "zone", currentNodeId: "start", pendingNodeId: nodeId, completedNodeIds: [], path: ["start"], nodes: [{ id: "start", type: "start" }, { id: nodeId, type, specialMatchId: match.specialMatchId }] }, activeMatch: match };
  const storage = new BudgetStorage(Infinity);
  const runtime = load(storage, { run, seasonDb: database, seasonId });
  const context = runtime.context;
  install(context, ["profiled-season.js", "special-match.js", "roguelike_progression.js", "match-simulator-config.js", "match-simulator.js"]);
  if (database.requiresProfileAwareRuntime) context.ProfiledSeasonRuntime.register(seasonId, database);
  context.SeasonRegistry.database = id => id === seasonId ? database : null;
  context.SeasonRegistry.player = id => database.players.find(player => String(player.playerId) === String(id));
  context.SeasonRegistry.playersIndex = () => new Map(database.players.map(player => [String(player.playerId), player]));
  context.SeasonRegistry.teamsIndex = () => new Map(database.teams.map(team => [String(team.teamId), team]));
  context.RoguelikeRules.isProfileAwareRosterEntry = () => database.requiresProfileAwareRuntime === true;
  context.DevelopmentRuntime.resolveRosterPlayer = (_run, player, entry) => context.InazumaProgression.getPlayerAtLevel(player, entry?.level || 0, database, entry);
  context.RunStatistics.applyCompletedMatchStatistics = () => {};
  context.setTimeout = () => 1; context.clearTimeout = () => {};
  return { runtime, context, database, opponent };
}

for (const seasonId of Object.keys(DATABASES)) {
  const scenario = openScenario(seasonId);
  const before = scenario.runtime.canonical;
  scenario.runtime.seam.startMatchSimulation(scenario.runtime.seam.getRun().activeMatch, { boss: scenario.opponent });
  const started = scenario.runtime.canonical;
  assert.equal(started.activeMatch.state, "simulating", `${seasonId}: start committed`);
  assert.equal(started.storageGeneration, before.storageGeneration + 1, `${seasonId}: exactly one start save`);
  assert.equal(scenario.runtime.seam.getRun().storageGeneration, started.storageGeneration, `${seasonId}: runtime generation follows canonical`);
  assert.equal(scenario.runtime.seam.getRun().storageCommitId, started.storageCommitId, `${seasonId}: runtime commit follows canonical`);
  scenario.runtime.seam.forceMatchOutcome("victory", { boss: scenario.opponent });
  const resolved = scenario.runtime.canonical;
  assert.equal(resolved.activeMatch.simulation.resolutionApplied, true, `${seasonId}: resolution durable`);
  assert.equal(resolved.storageGeneration, started.storageGeneration + 2, `${seasonId}: forced completion and resolution are two saves`);
  traces.push({ seasonId, type: "boss", startGeneration: started.storageGeneration, resolutionGeneration: resolved.storageGeneration, bytes: scenario.context.RunStorage.diagnostics(seasonId).totalKnownBytes });
}

for (const seasonId of ["ie1_s2", "ie1_s3"]) {
  const scenario = openScenario(seasonId, "special_match");
  scenario.runtime.seam.startMatchSimulation(scenario.runtime.seam.getRun().activeMatch);
  const started = scenario.runtime.canonical;
  assert.equal(started.activeMatch.state, "simulating", `${seasonId}: special start committed`);
  scenario.runtime.seam.forceMatchOutcome("victory");
  assert.equal(scenario.runtime.canonical.activeMatch.simulation.resolutionApplied, true, `${seasonId}: special resolution durable`);
  scenario.runtime.seam.continueAfterMatch();
  assert.equal(scenario.runtime.canonical.phase, "special-reward", `${seasonId}: special returns to reward routing`);
  traces.push({ seasonId, type: "special_match", startGeneration: started.storageGeneration, resolutionGeneration: scenario.runtime.canonical.storageGeneration - 1, navigationGeneration: scenario.runtime.canonical.storageGeneration, bytes: scenario.context.RunStorage.diagnostics(seasonId).totalKnownBytes });
}

console.log(JSON.stringify(traces));
console.log("Cross-season production match start/resolution diagnostics: ok");
