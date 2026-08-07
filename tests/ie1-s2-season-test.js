const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const database = JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json", "utf8"));
assert.equal(database.seasonId, "ie1_s2");
assert.equal(database.teams.length, 17);
assert.equal(database.bossOrder.length, 10);
assert.equal(database.specialMatches.length, 7);
assert.equal(database.players.length, 203);
assert.equal(database.profiles.length, 230);
assert(database.formations.eleven.some((formation) => formation.id === "2-5-3"));
assert.equal(database.bossOrder.find((boss) => boss.teamId === "genesis").bossLevel, 15);
assert.equal(database.bossOrder.find((boss) => boss.teamId === "raimon_inazuma_eleven_2").bossLevel, 19);

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/profiled-season.js", "utf8"), context);
const runtime = context.ProfiledSeasonRuntime;
runtime.register("ie1_s2", database);

const run = { seasonId: "ie1_s2", roster: [], lineup: [], bench: [], teamLevel: 4, teamLevelUnits: 4 };
let result = runtime.acquireOrUpgradeProfile(run, { profileId: "1070@epsilon" }, { level: 3 });
assert.equal(result.status, "acquired");
assert.equal(run.roster[0].activeRoleVariantId, "gk");
run.roster[0].equippedItem = { id: "keeper_gloves" };
run.roster[0].runStatistics = { saves: 9 };
run.roster.push(...Array.from({ length: 14 }, (_, index) => ({ playerId: `filler-${index}` })));
result = runtime.acquireOrUpgradeProfile(run, { profileId: "1070@epsilon_plus" });
assert.equal(result.status, "upgraded");
assert.equal(run.roster.length, 15);
assert.equal(run.roster[0].activeRoleVariantId, "gk");
assert.deepEqual(run.roster[0].equippedItem, { id: "keeper_gloves" });
assert.deepEqual(run.roster[0].runStatistics, { saves: 9 });
assert.equal(runtime.acquireOrUpgradeProfile(run, { profileId: "1070@epsilon" }).status, "ineligible");

const direct = { seasonId: "ie1_s2", roster: [], lineup: [], bench: [] };
runtime.acquireOrUpgradeProfile(direct, { profileId: "1070@epsilon_plus" });
assert.equal(direct.roster[0].activeRoleVariantId, "fw");
direct.bench = ["1070"];
assert(runtime.canSwitchRole(direct, "1070"));
runtime.switchBenchRole(direct, "1070", "gk");
assert.equal(direct.roster[0].activeRoleVariantId, "gk");
direct.bench = [];
assert.throws(() => runtime.switchBenchRole(direct, "1070", "fw"), /PANCHINA/);

const progression = { seasonId: "ie1_s2", teamLevel: 4, teamLevelUnits: 0, roster: [{ playerId: "1162", level: 4, levelUnits: 0 }] };
runtime.addLevelUnits(progression, 2, "five-1");
runtime.addLevelUnits(progression, 2, "five-2");
runtime.addLevelUnits(progression, 2, "five-3");
assert.deepEqual([progression.teamLevel, progression.teamLevelUnits], [5, 0]);
assert.deepEqual([progression.roster[0].level, progression.roster[0].levelUnits], [5, 0]);
runtime.addLevelUnits(progression, 2, "five-3");
assert.deepEqual([progression.teamLevel, progression.teamLevelUnits], [5, 0]);
progression.roster.push({ playerId: "1166", level: 5, levelUnits: 0 });
assert.equal(progression.roster[1].levelUnits, 0);
progression.teamLevel = 20; progression.teamLevelUnits = 5; progression.roster[0].level = 20;
runtime.addLevelUnits(progression, 6, "boss-cap");
assert.deepEqual([progression.teamLevel, progression.teamLevelUnits, progression.roster[0].levelUnits], [20, 0, 0]);

assert(runtime.resolveCanonicalPlayer("ie1_s2", "1162"));
assert(runtime.resolveCanonicalPlayer("ie1_s2", "1166"));
assert.notEqual(runtime.resolveCanonicalPlayer("ie1_s2", "1162").playerId, runtime.resolveCanonicalPlayer("ie1_s2", "1166").playerId);
assert.equal(runtime.resolveProfile("ie1_s2", "1226@fauxshore").finalOverall, 87);
assert.equal(runtime.resolveProfile("ie1_s2", "1226@raimon_inazuma_eleven_2").finalOverall, 90);

console.log("IE1 S2 database, profiles, role variants and integer progression: OK");
