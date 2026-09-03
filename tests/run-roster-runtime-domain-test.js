"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/run/run-roster-runtime.js", "utf8");
for (const forbidden of ["RunState.save", "GameplayPersistence", "Firebase", "Firestore", "CloudSave", "CloudRestore"]) {
  assert.ok(!source.includes(forbidden), `run roster runtime must not own ${forbidden}`);
}

let run = {
  runId: "run-a",
  seasonId: "legacy",
  teamLevel: 5,
  roster: [
    { playerId: "p1", source: "free", level: 4, levelUnits: 0, equippedItem: { id: "boots", attack: 2 }, teamId: "t1" },
    { playerId: "p2", source: "free", level: 3, levelUnits: 0, equippedItem: null },
  ],
};
let seasonDb = {
  formations: { eleven: [{ id: "4-3-3" }] },
  teams: [{ teamId: "t1", teamName: "Raimon", logoUrl: "raimon.webp" }],
};
let freeAgentsDb = { id: "free-db" };
let freeAgentsById = new Map([
  ["p1", { playerId: "p1", name: "Uno", position: "FW", finalOverall: 70, stats: { attack: 5, defense: 2 } }],
  ["p2", { playerId: "p2", name: "Due", position: "MF", finalOverall: 60, stats: { attack: 3, defense: 4 } }],
]);
let seasonPlayersById = new Map();
let seasonTeamsById = new Map([["t1", seasonDb.teams[0]]]);
let profileAware = false;
let profileUnitsCall = null;
let trainingCall = null;

const context = {
  console,
  Map,
  Set,
  Object,
  Array,
  String,
  Number,
  Math,
  JSON,
  Date,
  Error,
  SeasonRegistry: {
    database: id => ({ requiresProfileAwareRuntime: id === "profile" && profileAware }),
    isSeasonSource: sourceName => sourceName === "season-source",
    player: id => seasonPlayersById.get(String(id)) || null,
  },
  RoguelikeRules: {
    isProfileAwareRosterEntry: (_entry, current) => current?.seasonId === "profile",
    applyEquipment: (stats, equipment) => ({ ...stats, attack: Number(stats?.attack || 0) + Number(equipment?.attack || 0) }),
  },
  ProfiledSeasonRuntime: {
    resolveEffectiveBase: entry => ({ playerId: entry.playerId, position: "DF", finalOverall: 88, stats: { attack: 7, defense: 8 } }),
    resolveEffectivePlayerAtLevel: entry => ({ playerId: entry.playerId, name: "Profilato", position: "DF", overall: 82, stats: { attack: 7, defense: 8 } }),
    addLevelUnits(current, units, actionId) {
      profileUnitsCall = { current, units, actionId };
      current.roster.forEach(entry => { entry.level += 1; });
    },
  },
  DevelopmentRuntime: {
    resolveRosterPlayer: (_current, player, entry, database) => ({ ...player, overall: player.finalOverall + entry.level, stats: player.stats, databaseSeen: database?.id || null }),
    trainingState: (...args) => { trainingCall = args; return { applications: [], currentLocalBoost: 0 }; },
    rosterEntryPermanentFields: (current, player) => ({ owner: current.runId, playerId: player.playerId }),
  },
  LevelProgression: { formatLevel: entry => `Lv ${entry.level}` },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "run-roster-runtime.js" });

const runtime = context.RunRosterRuntime.create({
  getRun: () => run,
  getSeasonDb: () => seasonDb,
  getFreeAgentsDb: () => freeAgentsDb,
  getFreeAgentsById: () => freeAgentsById,
  getSeasonPlayersById: () => seasonPlayersById,
  getSeasonTeamsById: () => seasonTeamsById,
});

assert.strictEqual(runtime.formationById("4-3-3").id, "4-3-3");
assert.strictEqual(runtime.rosterEntry("p1").playerId, "p1");
assert.strictEqual(runtime.sourcePlayer("p1").name, "Uno");
assert.strictEqual(runtime.roleForPlayerId("p1"), "FW");
assert.strictEqual(runtime.overallForPlayerId("p1"), 74);
assert.strictEqual(runtime.activeBasePotential(run.roster[0]), 70);
assert.strictEqual(runtime.averageOverall(), 68);
assert.deepStrictEqual(runtime.permanentRosterFields({ playerId: "p1" }), { owner: "run-a", playerId: "p1" });
const resolved = runtime.resolvedRosterPlayer("p1");
assert.strictEqual(resolved.overall, 74);
assert.strictEqual(resolved.attack, 7);
assert.strictEqual(resolved.baseStats.attack, 5);
assert.strictEqual(resolved.displayLevelText, "Lv 4");
assert.strictEqual(runtime.playerTeamIdentity({ playerId: "p1", teamId: "t1" }, "p1").name, "Raimon");
assert.strictEqual(runtime.historicalTeamIdentity({ playerId: "p1", teamId: "t1" }, null, {}).logoUrl, "raimon.webp");
runtime.runtimeTrainingState(run.roster[0]);
assert.strictEqual(trainingCall[0], run);
assert.strictEqual(trainingCall[3], freeAgentsDb);

const legacyUpdated = runtime.addLevels(2, "legacy-level");
assert.strictEqual(legacyUpdated, 2);
assert.strictEqual(run.teamLevel, 7);
assert.deepStrictEqual(run.roster.map(entry => entry.level), [6, 5]);

// Getter-backed state must remain dynamic after runtime creation.
freeAgentsById = new Map([["p1", { playerId: "p1", name: "Nuovo", position: "GK", finalOverall: 50, stats: { attack: 1 } }]]);
assert.strictEqual(runtime.sourcePlayer("p1").name, "Nuovo");

profileAware = true;
run = { runId: "run-profile", seasonId: "profile", teamLevel: 1, roster: [{ playerId: "px", profileId: "profile-x", source: "season-source", level: 2, levelUnits: 0, equippedItem: null }] };
seasonPlayersById = new Map([["px", { playerId: "px", name: "Season Source", position: "DF" }]]);
const profiled = runtime.resolvedRosterPlayer("px");
assert.strictEqual(profiled.name, "Profilato");
assert.strictEqual(profiled.overall, 82);
assert.strictEqual(runtime.activeBasePotential(run.roster[0]), 88);
assert.strictEqual(runtime.roleForPlayerId("px"), "DF");
assert.strictEqual(runtime.addLevels(0.5, "profile-level", 3), 1);
assert.strictEqual(profileUnitsCall.units, 3);
assert.strictEqual(profileUnitsCall.actionId, "profile-level");
assert.strictEqual(profileUnitsCall.current, run);

console.log("run roster runtime: legacy/profile resolution, dynamic getters, equipment, team identity and level parity OK");
