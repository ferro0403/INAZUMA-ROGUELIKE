"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const freeAgents = require("../data/FREE_AGENTS_compact.json");

const DATABASE_FILES = { ie1: "IE1_season_compact.json", ie2: "IE2_season_compact.json", ie1_s2: "IE1_S2_season_compact.json", ie1_s3: "IE1_S3_season_compact.json", orion: "ORION_season_compact.json" };
function install(context, files) { files.forEach(file => vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), context, { filename: file })); }
function firstBossIds(database) { const boss = database.bossOrder[0]; return (boss.startingXIPlayerIds || database.teams.find(team => team.teamId === boss.teamId)?.playerIds || []).slice(0, 11).map(String); }
function profileEntry(database, seasonId, playerId) { const profile = (database.profiles || []).find(item => String(item.playerId) === playerId); return { playerId, source: seasonId, level: 0, levelUnits: 0, activeProfileId: profile?.profileId, activeRoleVariantId: profile?.defaultRoleVariantId }; }
function fiveSlots(database, ids) {
  const selected = new Set(); const take = role => { const player = ids.map(id => database.players.find(item => String(item.playerId) === id)).find(item => item && String(item.position || item.normalizedRole).toUpperCase() === role && !selected.has(String(item.playerId))); assert(player, `missing ${role}`); selected.add(String(player.playerId)); return String(player.playerId); };
  return { FW: take("FW"), MF1: take("MF"), MF2: take("MF"), DF: take("DF"), GK: take("GK") };
}
async function open(seasonId, nodeType) {
  const database = require(`../data/${DATABASE_FILES[seasonId]}`); const ids = firstBossIds(database); const nodeId = `${seasonId}-${nodeType}`;
  const special = nodeType === "special_match" ? database.specialMatches[0] : null;
  const zone = { bossIndex: 0, bossId: database.bossOrder[0].teamId, seed: `${seasonId}-zone`, nodes: [{ id: "start", type: "start", layer: 0, column: 0 }, { id: nodeId, type: nodeType, layer: 3, column: 1, specialMatchId: special?.specialMatchId, teamId: special?.teamId, teamName: special?.teamName, matchLevel: special?.matchLevel, matchFormation: special?.matchFormation }], edges: [["start", nodeId]], startNodeId: "start", currentNodeId: "start", completedNodeIds: ["start"], path: ["start"], pendingNodeId: null };
  const run = { version: 2, runId: `real-path-${seasonId}-${nodeType}`, seasonId, phase: "map", lives: 2, bossIndex: 0, consecutiveLosses: 2, teamIdentity: { name: seasonId }, roster: ids.map(id => profileEntry(database, seasonId, id)), lineup: ids, bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], statistics: {}, playerStatistics: {}, matchHistory: [], teamLevel: 0, teamLevelUnits: 0, formationId: database.bossOrder[0].bossFormation || "4-4-2", currentZone: zone, checkpoint: { currentZone: structuredClone(zone), teamIdentity: { name: seasonId } }, activeMatch: null };
  if (nodeType === "five_v_five") run.fiveVFive = { formation: "1-2-1", slots: fiveSlots(database, ids) };
  const storage = new BudgetStorage(Infinity);
  const fetch = async url => ({ ok: true, json: async () => String(url).includes("FREE_AGENTS") ? freeAgents : String(url).includes("PLAYER_VISUALS") ? { players: {} } : database });
  const runtime = load(storage, { run, seasonDb: database, seasonId, contextOverrides: { location: { search: "?dev=1" }, sessionStorage: new BudgetStorage(Infinity), fetch } });
  const context = runtime.context;
  install(context, ["profiled-season.js", "special-match.js", "five-v-five.js", "roguelike_progression.js", "run-statistics.js", "match-simulator-config.js", "match-simulator.js"]);
  if (database.requiresProfileAwareRuntime) context.ProfiledSeasonRuntime.register(seasonId, database);
  context.SeasonRegistry.database = id => id === seasonId ? database : null; context.SeasonRegistry.player = id => database.players.find(player => String(player.playerId) === String(id)); context.SeasonRegistry.playersIndex = () => new Map(database.players.map(player => [String(player.playerId), player])); context.SeasonRegistry.teamsIndex = () => new Map(database.teams.map(team => [String(team.teamId), team])); context.RoguelikeRules.isProfileAwareRosterEntry = () => database.requiresProfileAwareRuntime === true;
  context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => 0;
  context.DevelopmentRuntime.resolveRosterPlayer = (_run, player, entry) => context.InazumaProgression.getPlayerAtLevel(player, entry?.level || 0, database, entry);
  await new Promise(resolve => setImmediate(resolve));
  context.setTimeout = () => 1; context.clearTimeout = () => {};
  runtime.seam.setContext({ run: context.RunState.load(seasonId, { readOnly: true }), seasonDb: database });
  return { runtime, context, database, nodeId };
}

(async () => {
  for (const [seasonId, nodeType] of [["ie1_s2", "special_match"], ["ie2", "boss"], ["orion", "boss"]]) {
    const { runtime, context, nodeId } = await open(seasonId, nodeType); const before = runtime.canonical.storageGeneration;
    runtime.seam.enterNode(nodeId); const entered = runtime.canonical;
    assert.equal(entered.phase, "match", `${seasonId}: map entry`); assert.equal(entered.storageGeneration, before + 1); assert.equal(entered.currentZone.pendingNodeId, nodeId); assert(entered.activeMatch?.matchId, `${seasonId}: production created match`);
    const button = context.document.getElementById("simulate-boss-match"); assert.equal(button.disabled, false); button.click();
    const started = runtime.canonical; assert.equal(started.activeMatch.state, "simulating", `${seasonId}: real UI click starts`); assert.equal(started.storageGeneration, entered.storageGeneration + 1); assert.equal(runtime.seam.getUi().matchStartLocked, false);
    const trace = context.__INAZUMA_GAMEPLAY_TRACE__(); for (const event of ["map-node-enter", nodeType === "special_match" ? "special-match-entry" : "boss-match-entry", "simulate-click", "startMatchSimulation-enter", "match-preview-ready", "match-start-committed"]) assert(trace.some(entry => entry.event === event), `${seasonId}: ${event}`);
  }

  for (const seasonId of ["ie1", "ie1_s3"]) {
    const { runtime, context, nodeId } = await open(seasonId, "five_v_five"); const before = runtime.canonical;
    runtime.seam.enterNode(nodeId); const entered = runtime.canonical; assert.equal(entered.phase, "match"); assert.equal(entered.storageGeneration, before.storageGeneration + 1); assert.equal(entered.activeMatch.type, "five_v_five");
    context.document.getElementById("simulate-boss-match").click(); const started = runtime.canonical; assert.equal(started.activeMatch.state, "simulating"); assert.equal(started.storageGeneration, entered.storageGeneration + 1);
    if (seasonId === "ie1_s3") continue;
    context.document.getElementById("skip-match-result").click(); const resolved = runtime.canonical;
    assert.equal(resolved.activeMatch.simulation.resolutionApplied, true); assert.equal(resolved.activeMatch.result, "victory"); assert(resolved.currentZone.completedNodeIds.includes(nodeId)); assert.equal(resolved.statistics.fiveVFiveWins, 1); assert.equal(resolved.lives, before.lives); assert(resolved.teamLevel > before.teamLevel);
    context.document.getElementById("continue-match-result").click(); const navigated = runtime.canonical; assert.equal(navigated.phase, "map"); assert.equal(navigated.activeMatch, null); assert.equal(navigated.currentZone.currentNodeId, nodeId);
    const trace = context.__INAZUMA_GAMEPLAY_TRACE__(); for (const event of ["five-v-five-entry", "simulate-click", "skip-enter", "simulation-completed", "resolution-enter", "resolution-success", "continue-after-match-enter", "post-navigation-success"]) assert(trace.some(entry => entry.event === event), `ie1: ${event}`);
  }
  console.log("Real map -> match -> UI click matrix (IE1/IE1_S3 5v5, IE1_S2 special, IE2/Orion boss): ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
