const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const season = JSON.parse(fs.readFileSync("data/IE1_S3_season_compact.json", "utf8"));
const free = JSON.parse(fs.readFileSync("data/FREE_AGENTS_compact.json", "utf8"));
const context = { console };
context.globalThis = context;
vm.createContext(context);
for (const file of ["js/profiled-season.js", "js/recruitment-pool.js", "js/formation-layout.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
context.ProfiledSeasonRuntime.register("ie1_s3", season);

const runtime = context.RecruitmentPoolRuntime;
const effective = runtime.effectiveSeason3Players(season, free);
const profiles = season.recruitmentPool.entries.filter((entry) => entry.sourceKind === "season3_recruitment_profile");
const byId = new Map(effective.map((player) => [String(player.playerId), player]));
assert.strictEqual(byId.size, effective.length, "effective pool must be canonically deduplicated");
assert.strictEqual(effective.length, new Set([...free.players.map((player) => String(player.playerId)), ...profiles.map((player) => String(player.playerId))].filter((id) => id !== "1196")).size);
for (const player of free.players) if (String(player.playerId) !== "1196") assert(byId.has(String(player.playerId)));
for (const profile of profiles) {
  assert(byId.has(String(profile.playerId)));
  assert.strictEqual(byId.get(String(profile.playerId)).sourceKind, "season3_recruitment_profile", "S3 profile must win overlaps");
}
assert(!byId.has("1196"));
for (const id of ["2083", "258", "2411"]) {
  assert.strictEqual(effective.filter((player) => String(player.playerId) === id).length, 1);
  assert.strictEqual(byId.get(id).sourceKind, "global_free_agent");
}

const sentinel = free.players.find((player) => player.progressionCode && !["1196", "2083", "258", "2411"].includes(String(player.playerId)));
assert(sentinel && byId.has(String(sentinel.playerId)));
assert.strictEqual(byId.get(String(sentinel.playerId)).source, "free_agents");
assert.strictEqual(byId.get(String(sentinel.playerId)).profileId, undefined);
assert.strictEqual(byId.get(String(sentinel.playerId)).progressionCode, sentinel.progressionCode);

const minimums = season.recruitmentRules.pullFreeAgents.minimumFinalOverallByBossIndex;
assert.deepStrictEqual(Array.from(minimums), [72, 73, 74, 75, 76, 77, 78, 79, 80, 80, 81, 82]);
const pullEligible = (player, index) => runtime.eligibleForSeason3FreeAgentPull(player, index, season);
const pullAt = (index) => effective.filter((player) => pullEligible(player, index));
assert(pullEligible({ sourceKind: "season3_recruitment_profile", profileId: "low@team", finalOverall: 72 }, 10));
assert(!pullEligible({ sourceKind: "global_free_agent", finalOverall: 74 }, 0));
for (const index of [0, 1, 2, 3]) assert(pullEligible({ sourceKind: "global_free_agent", finalOverall: 75 }, index));
assert(!pullEligible({ sourceKind: "global_free_agent", finalOverall: 75 }, 4));
assert(pullEligible({ sourceKind: "global_free_agent", finalOverall: 79 }, 7));
assert(pullEligible({ sourceKind: "global_free_agent", finalOverall: 89 }, 0));
assert(pullEligible({ sourceKind: "global_free_agent", finalOverall: 89 }, 7));
const topOverall = Math.max(...effective.map((player) => Number(player.finalOverall)));
assert(topOverall >= 82 && pullAt(0).some((player) => Number(player.finalOverall) === topOverall), "early pulls must retain top players without a maximum");
assert(pullEligible({ sourceKind: "global_free_agent", finalOverall: 89 }, 10), "the minimum-only rule must have no upper cap");
assert(!pullAt(7).some((player) => player.sourceKind === "global_free_agent" && player.finalOverall === 74));
if (sentinel.finalOverall >= 75) assert(pullAt(0).some((player) => String(player.playerId) === String(sentinel.playerId)));

const mixed = [byId.get(String(sentinel.playerId)), effective.find((player) => player.sourceKind === "season3_recruitment_profile")];
const profileCalls = [];
const run = { roster: [] };
assert(runtime.eligible(run, mixed[0], (_run, profileId) => profileCalls.push(profileId)));
assert.strictEqual(profileCalls.length, 0, "global FA must not use profile eligibility");
assert(runtime.eligible(run, mixed[1], (_run, profileId) => { profileCalls.push(profileId); return true; }));
assert.deepStrictEqual(profileCalls, [mixed[1].profileId]);
assert.notStrictEqual(runtime.candidateKey(mixed[0]), runtime.candidateKey(mixed[1]));
assert.strictEqual(runtime.candidateSource(mixed[0]), "free_agents");
assert.strictEqual(runtime.candidateSource(mixed[1]), "ie1_s3");

const registry = { isSeasonSource: (source) => source === "ie1_s3", database: () => season };
assert.strictEqual(runtime.choiceDatabase("free_agents", season, free, registry), free);
assert.strictEqual(runtime.choiceDatabase("ie1_s3", null, free, registry), season);

const albumTeams = runtime.orderedAlbumTeams(season, true);
assert.strictEqual(albumTeams.length, 41);
assert.strictEqual(new Set(albumTeams.map((team) => String(team.teamId))).size, 41);
for (const boss of season.bossOrder) assert(albumTeams.some((team) => team.teamId === boss.teamId));
for (const special of season.specialMatches) assert(albumTeams.some((team) => team.teamId === special.teamId));
assert(albumTeams.some((team) => !season.bossOrder.some((boss) => boss.teamId === team.teamId) && !season.specialMatches.some((special) => special.teamId === team.teamId)), "source-only teams must be visible");

const formation = season.formations.eleven.find((item) => item.id === "4-3-1-2");
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.FormationLayout.displayRows(formation))), [
  { role: "FW", count: 2 },
  { role: "MF", displayRole: "TQ", count: 1 },
  { role: "MF", count: 3 },
  { role: "DF", count: 4 },
  { role: "GK", count: 1 },
]);
assert.strictEqual(context.FormationLayout.displayRows(formation).reduce((sum, row) => sum + row.count, 0), 11);
for (const id of ["4-3-3", "4-4-2"]) assert.strictEqual(context.FormationLayout.displayRows(season.formations.eleven.find((item) => item.id === id)).length, 4);

const includedGlobalCount = effective.filter((player) => player.sourceKind === "global_free_agent").length;
console.log(`ie1-s3-runtime-fixes-test: ${effective.length} effective players (${includedGlobalCount} global candidates + ${profiles.length} profiles), sentinel ${sentinel.playerId} OK`);
