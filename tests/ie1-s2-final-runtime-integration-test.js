"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const db = JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json", "utf8"));
const context = { console, globalThis: null }; context.globalThis = context;
for (const file of ["js/roguelike_progression.js", "js/profiled-season.js", "js/game-rules.js", "js/run-statistics.js"]) vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
context.ProfiledSeasonRuntime.register("ie1_s2", db);
const runtime = context.ProfiledSeasonRuntime;
const rules = context.RoguelikeRules;
const shawnProfile = runtime.resolveProfile("ie1_s2", "1162@alpine_ie2");
const dvalinPlus = runtime.resolveProfile("ie1_s2", "1070@epsilon_plus");
const syntheticProfiles = [
  { profileId: "df-new", playerId: "df-new-player", profileRank: 10, defaultRoleVariantId: "df", finalOverall: 95, position: "DF", roleVariants: [{ roleVariantId: "df", position: "DF", finalOverall: 95 }] },
  { profileId: "fw-new", playerId: "fw-new-player", profileRank: 10, defaultRoleVariantId: "fw", finalOverall: 95, position: "FW", roleVariants: [{ roleVariantId: "fw", position: "FW", finalOverall: 95 }] },
];
const teams = [{ teamId: "open", playerProfileIds: ["df-new", "fw-new"] }, { teamId: "locked", playerProfileIds: ["locked-fw"] }];
const compare = runtime.compareProfileProgression;
function tradePool(entry, unlocked = ["open"], extraProfiles = []) {
  const outgoing = runtime.resolveEffectiveBase(entry, "ie1_s2");
  return rules.getProfileAwareTradeCandidates({ outgoingPlayer: outgoing, rosterEntries: [entry], freeAgents: [{ playerId: "fa-fw", position: "FW", finalOverall: 99 }, { playerId: "fa-df", position: "DF", finalOverall: 99 }], profiles: [...syntheticProfiles, ...extraProfiles], unlockedTeamIds: unlocked, teams, seasonId: "ie1_s2", compareProfileProgression: compare });
}
const shawn = { playerId: "1162", source: "ie1_s2", activeProfileId: shawnProfile.profileId, activeRoleVariantId: "df", level: 4, levelUnits: 2, currentOverallBoost: 3, potentialBoost: 3, potentialBoostApplications: [{ amount: 3 }] };
let pool = tradePool(shawn);
assert(pool.length && pool.every((c) => c.player.position === "DF"), "Shawn DF only finds DF candidates");
shawn.activeRoleVariantId = "fw"; pool = tradePool(shawn);
assert(pool.some((c) => c.source === "free_agents") && pool.some((c) => c.profileId === "fw-new"), "free agents and unlocked profiles are eligible");
assert(pool.every((c) => c.player.position === "FW") && pool.every((c) => c.source !== "season1"), "Shawn FW never receives DF or legacy source");
assert(!pool.some((c) => c.profileId === "locked-fw"), "locked teams are excluded");
const dvalin = { playerId: "1070", source: "ie1_s2", activeProfileId: dvalinPlus.profileId, activeRoleVariantId: "gk", level: 3 };
assert.strictEqual(runtime.resolveEffectiveBase(dvalin, "ie1_s2").position, "GK"); dvalin.activeRoleVariantId = "fw"; assert.strictEqual(runtime.resolveEffectiveBase(dvalin, "ie1_s2").position, "FW");
const epsilon = runtime.resolveProfile("ie1_s2", "1070@epsilon");
const upgradeTeams = [{ teamId: "epsilon_plus", playerProfileIds: [epsilon.profileId, dvalinPlus.profileId] }];
const ownedEpsilon = { playerId: "1070", activeProfileId: epsilon.profileId, activeRoleVariantId: "gk", level: 7, levelUnits: 4, equippedItem: { id: "boots" }, currentOverallBoost: 2, potentialBoost: 2 };
let upgrades = rules.getProfileAwareTradeCandidates({ outgoingPlayer: { position: "FW", finalOverall: 1 }, rosterEntries: [ownedEpsilon], profiles: [epsilon, dvalinPlus], unlockedTeamIds: ["epsilon_plus"], teams: upgradeTeams, seasonId: "ie1_s2", compareProfileProgression: compare });
assert.strictEqual(Array.from(upgrades, (c) => c.profileId).join(","), dvalinPlus.profileId, "same and previous profiles are excluded while upgrade is eligible");
assert.strictEqual(new Set(upgrades.map((c) => c.playerId)).size, upgrades.length, "trade pool is deduplicated by playerId");
const newRun = { roster: [{ playerId: "out", level: 19, equippedItem: { id: "band" } }], lineup: ["out"], bench: [], inventory: [] };
let result = rules.executeProfileAwareTrade(newRun, "out", { playerId: "new", source: "ie1_s2", profileId: "fw-new", activeRoleVariantId: "fw", player: syntheticProfiles[1] });
assert.strictEqual(result.player.activeProfileId, "fw-new"); assert.strictEqual(result.player.activeRoleVariantId, "fw"); assert.strictEqual(result.player.level, 20); assert.deepStrictEqual(newRun.lineup, ["new"]); assert.deepStrictEqual(newRun.inventory, [{ id: "band" }]);
const benchRun = { roster: [{ playerId: "out", level: 1 }], lineup: [], bench: ["out"], inventory: [] };
rules.executeProfileAwareTrade(benchRun, "out", { playerId: "new", source: "ie1_s2", profileId: "fw-new", activeRoleVariantId: "fw", player: syntheticProfiles[1] }); assert.deepStrictEqual(benchRun.bench, ["new"]);
const inPlace = { roster: [{ playerId: "out", level: 5, levelUnits: 3, equippedItem: { id: "x" }, currentOverallBoost: 2, activeProfileId: "old", activeRoleVariantId: "fw" }], lineup: ["out"], bench: [], inventory: [] };
result = rules.executeProfileAwareTrade(inPlace, "out", { playerId: "out", source: "ie1_s2", profileId: "next", activeRoleVariantId: "fw", profile: syntheticProfiles[1], player: syntheticProfiles[1] });
assert.strictEqual(result.status, "upgraded-self"); assert.strictEqual(inPlace.roster.length, 1); assert.strictEqual(result.player.level, 6); assert.strictEqual(result.player.levelUnits, 3); assert.deepStrictEqual(result.player.equippedItem, { id: "x" }); assert.deepStrictEqual(inPlace.inventory, []);
const otherUpgrade = { roster: [{ playerId: "out", level: 2, equippedItem: { id: "y" } }, { playerId: "owned", level: 9, levelUnits: 5, currentOverallBoost: 4, activeProfileId: "old" }], lineup: ["out"], bench: ["owned"], inventory: [] };
result = rules.executeProfileAwareTrade(otherUpgrade, "out", { playerId: "owned", source: "ie1_s2", profileId: "next", activeRoleVariantId: "fw", profile: syntheticProfiles[1], player: syntheticProfiles[1] });
assert.strictEqual(result.status, "upgraded"); assert.strictEqual(otherUpgrade.roster.length, 1); assert.strictEqual(result.player.level, 9); assert.strictEqual(result.player.levelUnits, 5); assert.strictEqual(result.player.currentOverallBoost, 4); assert.deepStrictEqual(otherUpgrade.inventory, [{ id: "y" }]);
const before = JSON.stringify(shawn); const preview = runtime.resolveEffectivePlayerAtLevel({ ...shawn, activeRoleVariantId: "fw" }, { seasonId: "ie1_s2", database: db }); assert.strictEqual(JSON.stringify(shawn), before, "role preview does not mutate roster entry"); assert(preview.overall >= 3, "runtime preview applies run boosts");

function specialRun(resultName) { const run = { runId: `special-${resultName}`, createdAt: "2020-01-01", formationId: "4-4-2" }; context.RunStatistics.applyCompletedMatchStatistics(run, { matchId: `m-${resultName}`, type: "special_match", result: resultName, score: { user: resultName === "victory" ? 2 : 0, opponent: 1 }, formation: "4-4-2", lineupSnapshot: { players: [{ playerId: "p1", name: "One", position: "FW" }] }, timeline: [{ team: "user", type: "goal", playerId: "p1" }] }); return run; }
const victory = specialRun("victory"); const sv = victory.statistics; const pv = victory.playerStatistics.p1;
assert.strictEqual(sv.matchesTotal, 1); assert.strictEqual(sv.specialMatches, 1); assert.strictEqual(sv.specialWins, 1); assert.strictEqual(sv.specialLosses, 0); assert.strictEqual(sv.fiveVFiveMatches, 0); assert.strictEqual(sv.bossMatches, 0); assert.strictEqual(pv.appearances, 1); assert.strictEqual(pv.specialAppearances, 1); assert.strictEqual(pv.fiveVFiveAppearances, 0); assert.strictEqual(pv.bossAppearances, 0); assert.strictEqual(pv.bossWins, 0); assert.strictEqual(victory.matchHistory[0].matchType, "special_match"); assert.strictEqual(victory.matchHistory[0].formation, "4-4-2"); assert.strictEqual(pv.averageRating, 7.7, "special rating has no boss bonus");
context.RunStatistics.applyCompletedMatchStatistics(victory, { matchId: "m-victory", type: "special_match" }); assert.strictEqual(victory.statistics.matchesTotal, 1, "processed match is idempotent");
const defeat = specialRun("defeat"); assert.strictEqual(defeat.statistics.specialLosses, 1);
const legacy = { createdAt: "old", statistics: { matchesTotal: 7 }, playerStatistics: { p: { appearances: 2 } } }; context.RunStatistics.ensureRunStatistics(legacy); const normalized = JSON.stringify(legacy); context.RunStatistics.ensureRunStatistics(legacy); assert.strictEqual(JSON.stringify(legacy), normalized); assert.strictEqual(legacy.statistics.specialMatches, 0); assert.strictEqual(legacy.playerStatistics.p.specialAppearances, 0); context.RunStatistics.ensurePlayerStatistics(legacy, { playerId: "p" }); assert.strictEqual(legacy.playerStatistics.p.specialAppearances, 0);
console.log("ie1-s2-final-runtime-integration-test: profile-aware trade, atomic upgrades, role preview and special statistics OK");
const appSource = fs.readFileSync("js/app.js", "utf8");
const htmlSource = fs.readFileSync("index.html", "utf8");
const cloudSource = fs.readFileSync("js/firebase-cloud-save.js", "utf8");
const firestoreRules = fs.readFileSync("firestore.rules", "utf8");
assert(appSource.includes("Vittoria confermata: premi Continua per ottenere la ricompensa garantita."));
assert(appSource.includes("Vittoria confermata: premi Continua per aprire le ricompense boss."));
assert(appSource.includes('isSpecial ? "Riepilogo essenziale della partita speciale" : "Riepilogo essenziale della sfida Boss"'));
assert(appSource.includes('match.type === "five_v_five" ? run.fiveVFive?.formation : run.formationId'));
assert(appSource.includes("ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(previewEntry"));
assert(!appSource.includes("SEASON 1 COMPLETATA")); assert(!appSource.includes("CAMPIONI DELLA SEASON 1"));
assert.strictEqual((htmlSource.match(/<title>(.*?)<\/title>/) || [])[1], "Inazuma Roguelike");
assert(cloudSource.includes("core.SECTOR_NAMES.length + 2 + hallDocuments.length")); assert(!cloudSource.includes("restoreReadCount: 8"));
assert(firestoreRules.includes("'run_ie1_s2'"));
