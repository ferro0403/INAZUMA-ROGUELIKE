"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const season = JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json", "utf8"));
const free = JSON.parse(fs.readFileSync("data/FREE_AGENTS_compact.json", "utf8"));
const context = { console, globalThis: null }; context.globalThis = context;
for (const file of ["js/roguelike_progression.js", "js/profiled-season.js", "js/game-rules.js"]) vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
context.ProfiledSeasonRuntime.register("ie1_s2", season);
const rules = context.RoguelikeRules;
const runtime = context.ProfiledSeasonRuntime;
const freeById = new Map(free.players.map((player) => [String(player.playerId), player]));
const profileCalls = [];
function base(entry, run) {
  return rules.resolveRosterEntryBase(entry, run, {
    legacy: (legacyEntry) => freeById.get(String(legacyEntry.playerId)),
    profile: (profileEntry) => { profileCalls.push(String(profileEntry.playerId)); return runtime.resolveEffectiveBase(profileEntry, run.seasonId); },
  });
}
function resolved(entry, run) {
  const raw = base(entry, run);
  const database = rules.isProfileAwareRosterEntry(entry, run) ? season : free;
  return context.InazumaProgression.getPlayerAtLevel(raw, Math.floor(Number(entry.level || 0)), database, entry);
}

const starters = free.players.slice(0, 11).map((player, index) => ({ playerId: String(player.playerId), source: "free_agents", level: index % 4, levelUnits: 0 }));
const initialRun = { seasonId: "ie1_s2", roster: starters, lineup: starters.map((entry) => entry.playerId), bench: [] };
const initialResolved = initialRun.roster.map((entry) => resolved(entry, initialRun));
assert.strictEqual(initialResolved.length, 11);
assert(initialResolved.every((player) => player.name && player.position && Number.isFinite(player.overall)));
assert(initialResolved.every((player) => player.portraitUrl || player.playerId), "real portraits or the existing player-id fallback remain available");
assert.deepStrictEqual(profileCalls, [], "initial Free Agents never enter ProfiledSeasonRuntime");
const boostedFree = { playerId: "2240", source: "free_agents", level: 5, currentOverallBoost: 3, potentialBoost: 3, potentialBoostApplications: [{ amount: 3 }] };
const plainAdam = resolved({ ...boostedFree, currentOverallBoost: 0, potentialBoost: 0, potentialBoostApplications: [] }, initialRun);
assert.strictEqual(resolved(boostedFree, initialRun).overall, plainAdam.overall + 3);
assert.strictEqual(base(boostedFree, initialRun).name, "Adam Montayne");
assert.strictEqual(base(boostedFree, initialRun).position, "FW");
assert.strictEqual(base(boostedFree, initialRun).finalOverall, 83);

const darren = { playerId: "1226", source: "ie1_s2", activeProfileId: "1226@raimon_inazuma_eleven_2", level: 4, currentOverallBoost: 2 };
const dvalin = { playerId: "1070", source: "ie1_s2", activeProfileId: "1070@epsilon_plus", activeRoleVariantId: "fw", level: 6 };
const mixedRun = { seasonId: "ie1_s2", roster: [boostedFree, starters[1], darren, dvalin], lineup: ["2240", starters[1].playerId, "1226"], bench: ["1070"], inventory: [] };
const mixedResolved = mixedRun.roster.map((entry) => resolved(entry, mixedRun));
assert.strictEqual(mixedResolved.length, 4);
assert.strictEqual(mixedResolved[0].position, "FW");
assert.strictEqual(mixedResolved[2].profileId, darren.activeProfileId);
assert.strictEqual(mixedResolved[3].position, "FW");
assert(mixedResolved[2].portraitUrl && mixedResolved[3].portraitUrl, "profile and role-variant visuals resolve");
const average = Math.round(mixedResolved.reduce((sum, player) => sum + player.overall, 0) / mixedResolved.length);
assert(Number.isFinite(average) && average > 0, "mixed average includes every entry");
assert.deepStrictEqual(profileCalls.slice(-2), ["1226", "1070"]);
const trainedProfileEntry = { ...dvalin, potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 0, legacy: true }] };
const trainedProfileResolved = resolved(trainedProfileEntry, { ...mixedRun, roster: [trainedProfileEntry] });
const trainedProfileTrade = rules.tradeOutgoingEffectiveMetadata(trainedProfileResolved);
assert.equal(trainedProfileTrade.finalOverall, Number(runtime.resolveEffectiveBase(trainedProfileEntry, mixedRun.seasonId).finalOverall) + 3, "profile-aware Trade uses active profile plus run-local Training");
assert.equal(trainedProfileTrade.position, String(trainedProfileResolved.position).toUpperCase());

const adamBase = base(boostedFree, mixedRun);
const lower = free.players.find((player) => player.position === "FW" && player.finalOverall < 83);
const equal = free.players.find((player) => player.position === "FW" && player.finalOverall === 83 && player.playerId !== "2240");
const higher = free.players.find((player) => player.position === "FW" && player.finalOverall > 83);
const wrongRole = free.players.find((player) => player.position !== "FW" && player.finalOverall >= 83);
const candidates = rules.getProfileAwareTradeCandidates({ outgoingPlayer: adamBase, outgoingPlayerId: "2240", rosterEntries: mixedRun.roster, freeAgents: [lower, equal, higher, wrongRole], profiles: season.profiles, unlockedTeamIds: ["epsilon_plus", "raimon_inazuma_eleven_2"], teams: season.teams, seasonId: "ie1_s2", compareProfileProgression: runtime.compareProfileProgression });
assert(candidates.some((candidate) => candidate.playerId === String(equal.playerId)));
assert(candidates.some((candidate) => candidate.playerId === String(higher.playerId)));
assert(!candidates.some((candidate) => candidate.playerId === String(lower.playerId)));
assert(candidates.every((candidate) => candidate.player.position === "FW" && candidate.player.finalOverall >= 83));
assert(candidates.some((candidate) => candidate.source === "free_agents"));
assert(candidates.some((candidate) => candidate.source === "ie1_s2"));
assert(candidates.every((candidate) => candidate.source !== "season1"));

const tradeRun = { seasonId: "ie1_s2", roster: [{ ...boostedFree, equippedItem: { id: "boots" } }, starters[1], darren], lineup: ["2240", starters[1].playerId], bench: ["1226"], inventory: [] };
const beforeCount = tradeRun.roster.length;
const incomingFree = candidates.find((candidate) => candidate.source === "free_agents");
let result = rules.executeProfileAwareTrade(tradeRun, "2240", incomingFree, { resolveOutgoingBase: (entry) => base(entry, tradeRun) });
assert.strictEqual(result.status, "acquired");
assert.strictEqual(tradeRun.roster.length, beforeCount);
assert(!tradeRun.roster.some((entry) => entry.playerId === "2240"));
assert(tradeRun.roster.some((entry) => entry.playerId === incomingFree.playerId));
assert.strictEqual(tradeRun.lineup[0], incomingFree.playerId);
assert.deepStrictEqual(tradeRun.inventory, [{ id: "boots" }]);
assert.strictEqual(new Set(tradeRun.roster.map((entry) => entry.playerId)).size, tradeRun.roster.length);

const seasonCandidate = candidates.find((candidate) => candidate.source === "ie1_s2");
if (seasonCandidate) {
  const seasonTradeRun = { seasonId: "ie1_s2", roster: [boostedFree, dvalin], lineup: ["2240"], bench: ["1070"], inventory: [] };
  result = rules.executeProfileAwareTrade(seasonTradeRun, "2240", seasonCandidate, { resolveOutgoingBase: (entry) => base(entry, seasonTradeRun) });
  assert.strictEqual(result.status, "acquired");
  assert.strictEqual(result.player.source, "ie1_s2");
  assert(result.player.activeProfileId);
}

const profileOutgoingRun = { seasonId: "ie1_s2", roster: [dvalin, starters[2]], lineup: [starters[2].playerId], bench: ["1070"], inventory: [] };
const shawnProfile = runtime.resolveProfile("ie1_s2", "1162@alpine_ie2");
const shawnFw = shawnProfile.roleVariants.find((variant) => variant.roleVariantId === "fw");
const strongerSeasonFw = { playerId: "1162", source: "ie1_s2", profileId: shawnProfile.profileId, activeRoleVariantId: "fw", profile: shawnProfile, player: { ...shawnProfile, ...shawnFw, playerId: "1162" } };
result = rules.executeProfileAwareTrade(profileOutgoingRun, "1070", strongerSeasonFw, { resolveOutgoingBase: (entry) => base(entry, profileOutgoingRun) });
assert.strictEqual(result.status, "acquired", "profile-aware outgoing Trade still works");
assert.deepStrictEqual(profileOutgoingRun.bench, ["1162"]);
assert.strictEqual(profileOutgoingRun.roster.length, 2);

const staleRun = { seasonId: "ie1_s2", roster: [boostedFree], lineup: ["2240"], bench: [], inventory: [] };
const snapshot = JSON.stringify(staleRun);
result = rules.executeProfileAwareTrade(staleRun, "2240", { ...incomingFree, player: { ...incomingFree.player, position: "DF" } }, { resolveOutgoingBase: (entry) => base(entry, staleRun) });
assert.strictEqual(result.status, "ineligible");
assert.strictEqual(JSON.stringify(staleRun), snapshot, "final guard aborts before roster, placement, equipment or inventory mutation");

console.log("ie1-s2-mixed-roster-regression-test: 11 real Free Agents, mixed preview routing, Adam trade pool and atomic guard OK");
