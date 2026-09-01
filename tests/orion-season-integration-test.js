const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const root = `${__dirname}/..`;
const orion = JSON.parse(fs.readFileSync(`${root}/data/ORION_season_compact.json`, "utf8"));
const freeAgents = JSON.parse(fs.readFileSync(`${root}/data/FREE_AGENTS_compact.json`, "utf8"));
const context = { console, structuredClone, DevelopmentV2: { playerUpgrade: () => null } };
context.globalThis = context;
for (const file of ["profiled-season.js", "recruitment-pool.js", "formation-layout.js", "match-simulator-config.js", "match-simulator.js", "boss-gameover-runtime.js"]) {
  vm.runInNewContext(fs.readFileSync(`${root}/js/${file}`, "utf8"), context, { filename: file });
}
context.ProfiledSeasonRuntime.register("orion", orion);

assert.strictEqual(orion.seasonId, "orion");
assert.strictEqual(orion.requiresProfileAwareRuntime, true);
assert.deepStrictEqual([orion.bossOrder.length, orion.players.length, orion.profiles.length, orion.recruitmentPool.entries.length], [13, 308, 328, 128]);
assert.strictEqual(orion.specialMatches.length, 0);
assert.deepStrictEqual(orion.bossOrder.slice(-2).map((boss) => [boss.order, boss.teamName, boss.bossLevel]), [[12, "Inazuma National", 20], [13, "Zhao eclipse", 20]]);
assert.strictEqual(orion.bossOrder.at(-1).finalBoss, true);

const formation = orion.formations.eleven.find((item) => item.id === "3-5-2");
assert.deepStrictEqual(JSON.parse(JSON.stringify(formation.requirements)), { GK: 1, DF: 3, MF: 5, FW: 2 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.FormationLayout.displayRows(formation).map(({ role, count }) => [role, count]))), [["FW", 2], ["MF", 5], ["DF", 3], ["GK", 1]]);
const tactic = context.MatchSimulator.formationTactic("3-5-2");
assert.deepStrictEqual(JSON.parse(JSON.stringify(tactic.modifiers)), { control: 0.05, stamina: 0.04, attack: 0.02, speed: 0.02, defense: -0.04, save: -0.02 });
assert.strictEqual(tactic.modifiers.physical || 0, 0);
assert.strictEqual(tactic.modifiers.grit || 0, 0);

const runtime = context.RecruitmentPoolRuntime;
const pool = runtime.effectiveProfiledPlayers(orion, freeAgents);
const profiles = pool.filter(runtime.isSeasonProfileCandidate);
const globals = pool.filter((player) => !runtime.isSeasonProfileCandidate(player));
assert(profiles.length > 0 && globals.length > 0);
assert(profiles.every((player) => player.profileId && player.source === "orion"));
assert(globals.every((player) => !player.profileId && player.source === "free_agents"));
assert.strictEqual(new Set(pool.map((player) => String(player.playerId))).size, pool.length);
for (const [stage, minimum] of [[1, 75], [4, 75], [5, 76], [8, 79], [10, 81], [12, 83], [13, 84]]) {
  const index = stage - 1;
  assert.strictEqual(runtime.eligibleForSeason3FreeAgentPull({ sourceKind: "global_free_agent", finalOverall: minimum - 1 }, index, orion), false);
  assert.strictEqual(runtime.eligibleForSeason3FreeAgentPull({ sourceKind: "global_free_agent", finalOverall: minimum }, index, orion), true);
  assert.strictEqual(runtime.eligibleForSeason3FreeAgentPull({ sourceKind: "global_free_agent", finalOverall: 999 }, index, orion), true);
}
for (const overall of [73, 74]) assert.strictEqual(runtime.eligibleForSeason3FreeAgentPull({ sourceKind: "orion_recruitment_profile", profileId: `low-${overall}@team`, finalOverall: overall }, 12, orion), true);
assert(!orion.recruitmentPool.entries.some((entry) => String(entry.playerId) === "4546"));
assert(orion.profiles.some((profile) => String(profile.playerId) === "4546"));
assert(orion.bossOrder.some((boss) => (boss.rewardPoolPlayerIds || []).map(String).includes("4546")));

const duplicateId = orion.profiles.find((profile, index, all) => all.some((other, otherIndex) => otherIndex !== index && String(other.playerId) === String(profile.playerId))).playerId;
const duplicateProfiles = orion.profiles.filter((profile) => String(profile.playerId) === String(duplicateId));
assert(duplicateProfiles.length > 1 && new Set(duplicateProfiles.map((profile) => profile.profileId)).size > 1);
assert.strictEqual(runtime.candidateKey(duplicateProfiles[0]), duplicateProfiles[0].profileId);
assert.strictEqual(runtime.canonicalPlayerId(duplicateProfiles[0]), String(duplicateId));

const finalRun = { bossIndex: 12, completedBossIds: [], unlockedTeamIds: [], currentZone: null, postBossFlow: { status: "next-zone", bossIndex: 12, bossTeamId: orion.bossOrder[12].teamId, remainingRewards: 0, rewardNumber: 2, excludedIds: [], rerolls: 0, candidateIds: [], completed: false } };
const resolution = context.BossGameOverRuntime.applyBossVictoryHandoffMutation({ run: finalRun, seasonDb: orion, ensureCurrentZoneMutation: () => { throw new Error("final boss must not generate another zone"); }, buildFinalization: () => { finalRun.finalization = { status: "pending" }; } });
assert.strictEqual(resolution.destination, "finalization-pending");
assert.strictEqual(finalRun.bossIndex, orion.bossOrder.length);

const registrySource = fs.readFileSync(`${root}/js/season-registry.js`, "utf8");
const appSource = fs.readFileSync(`${root}/js/app.js`, "utf8");
assert(registrySource.includes('database: "data/ORION_season_compact.json"'));
assert(registrySource.includes('["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"]'));
assert(!appSource.includes('run?.seasonId === "orion"'));
assert(appSource.includes("databasePresentation?.menuImageUrl"));

console.log(`orion-season-integration-test: ${pool.length} mixed candidates, 13 bosses, 3-5-2 and generic finalization OK`);
