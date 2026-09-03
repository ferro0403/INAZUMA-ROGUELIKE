"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const snapshotSource = fs.readFileSync("js/hall/champion-snapshot.js", "utf8");
const presentationSource = fs.readFileSync("js/hall/champion-presentation.js", "utf8");
for (const source of [snapshotSource, presentationSource]) {
  for (const forbidden of ["RunState.save", "GameplayPersistence", "Firebase", "Firestore", "CloudSave", "CloudRestore"]) {
    assert.ok(!source.includes(forbidden), `champion/hall extraction must not own ${forbidden}`);
  }
}

const players = new Map([
  ["p1", { playerId: "p1", name: "Uno", position: "FW", category: "Elite", finalOverall: 80, stats: { attack: 8 } }],
  ["p2", { playerId: "p2", name: "Due", position: "MF", category: "Raro", finalOverall: 70, stats: { control: 7 } }],
  ["p3", { playerId: "p3", name: "Tre", position: "GK", category: "Normale", finalOverall: 60, stats: { save: 6 } }],
]);
const run = {
  runId: "run-champion",
  seasonId: "ie1",
  teamIdentity: { name: "Fulmini", logo: "inazuma-lightning" },
  formationId: "4-3-3",
  lineup: ["p1", "p2"],
  bench: ["p3"],
  roster: [
    { playerId: "p1", source: "season", level: 5, levelUnits: 10, recruitedAtLevel: 1, recruitedOverall: 61, equippedItem: null },
    { playerId: "p2", source: "season", level: 4, levelUnits: 8, recruitedAtLevel: 1, recruitedOverall: 60, equippedItem: { id: "boots" } },
    { playerId: "p3", source: "season", level: 3, levelUnits: 6, recruitedAtLevel: 0, recruitedOverall: 55, equippedItem: null },
  ],
  fiveVFive: { formation: "1-2-1", slots: { FW: "p1", MF1: "p2", GK: "p3" } },
  teamLevel: 6,
  teamLevelUnits: 12,
  lives: 1.5,
  completedBossIds: ["b1", "b2"],
  completedAt: "2026-09-03T10:00:00.000Z",
  createdAt: "2026-09-03T09:00:00.000Z",
  activeMatch: { simulation: { timeline: [{ playerId: "p1", type: "goal" }, { playerId: "p3", type: "save" }] } },
};
const seasonDb = { version: "db-v1", formations: { eleven: [{ id: "4-3-3", requirements: { FW: 1, MF: 1, DF: 0, GK: 0 } }] } };
let statsSnapshotted = 0;
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
  Intl,
  Error,
  RunStatistics: {
    snapshotFinalPlayerStats(activeRun, roster) { assert.strictEqual(activeRun, run); assert.strictEqual(roster.length, 3); statsSnapshotted += 1; },
    buildHallOfFameStatisticsSnapshot() {
      return {
        statisticsSchemaVersion: 2,
        statisticsComplete: true,
        statisticsStartedAt: "2026-09-03T09:00:00.000Z",
        runStatistics: { matchesTotal: 9, winsTotal: 8, specialMatches: 1, specialWins: 1, specialLosses: 0 },
        playerStatistics: { p1: { goals: 4 } },
        matchHistory: [{ id: "m1" }],
        awards: [{ id: "mvp", playerId: "p1", playerName: "Uno", label: "MVP", portraitUrl: "p1.webp" }],
      };
    },
  },
  SeasonRegistry: {
    get: () => ({ id: "ie1", name: "Inazuma Eleven 1" }),
    database: () => seasonDb,
  },
  HallOfFameStorage: {
    archiveKeyFor: snapshot => `archive:${snapshot.runId}`,
    stableId: key => `hall:${key}`,
  },
  MatchSimulator: { formationTactic: () => "balanced" },
  LevelProgression: { formatLevel: (level, seasonId, units) => `${seasonId}:${level}:${units}` },
  FormationLayout: {
    displayRows: formation => [
      { role: "FW", displayRole: "FW", count: formation.requirements.FW || 1 },
      { role: "MF", displayRole: "MF", count: formation.requirements.MF || 1 },
    ],
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(snapshotSource, context, { filename: "champion-snapshot.js" });
vm.runInContext(presentationSource, context, { filename: "champion-presentation.js" });

const rosterEntry = id => run.roster.find(entry => entry.playerId === String(id));
const snapshotRuntime = context.ChampionSnapshotRuntime.create({
  getRun: () => run,
  getSeasonDb: () => seasonDb,
  sourcePlayer: entry => players.get(String(entry.playerId)),
  resolvedRosterPlayer: id => ({ ...players.get(String(id)), overall: players.get(String(id)).finalOverall, potential: 81 }),
  rosterEntry,
  playerPortraitUrl: player => `${player.playerId}.webp`,
  resolvePlayerVisual: player => ({ frontFullbodyUrl: `${player.playerId}-full.webp` }),
  normalizeTeamIdentity: identity => identity,
});

const p1 = snapshotRuntime.snapshotPlayer(rosterEntry("p1"), "lineup", 1);
assert.strictEqual(p1.playerId, "p1");
assert.strictEqual(p1.formationSlot, 1);
assert.strictEqual(p1.finalOverall, 80);
assert.strictEqual(p1.fullbodyUrl, "p1-full.webp");
const legacyStats = snapshotRuntime.collectPlayerStatistics([p1, snapshotRuntime.snapshotPlayer(rosterEntry("p3"), "bench", 1)]);
assert.strictEqual(legacyStats.p1.goals, 1);
assert.strictEqual(legacyStats.p3.saves, 1);

const snapshot = snapshotRuntime.buildChampionSnapshot({ teamId: "final", teamName: "Raimon" });
assert.strictEqual(statsSnapshotted, 1);
assert.strictEqual(snapshot.teamName, "Fulmini");
assert.strictEqual(snapshot.finalBossId, "final");
assert.strictEqual(snapshot.finalStartingEleven.length, 2);
assert.strictEqual(snapshot.bench.length, 1);
assert.strictEqual(snapshot.fullRoster.length, 3);
assert.strictEqual(snapshot.finalAverageOverall, 75);
assert.strictEqual(snapshot.runStatistics.matchesTotal, 9);
assert.strictEqual(snapshot.archiveKey, "archive:run-champion");
assert.strictEqual(snapshot.hallTeamId, "hall:archive:run-champion");
assert.deepStrictEqual(snapshot.savedFiveVFiveFormation.slots, { FW: "p1", MF1: "p2", GK: "p3" });

const presentation = context.ChampionPresentation.create({
  getSeasonDb: () => seasonDb,
  escapeHtml: value => String(value ?? ""),
  formatDate: value => `DATE:${value}`,
  compactPlayerCardMarkup: (player, options) => `<card data-player="${player.playerId}" data-level="${options.level}"></card>`,
});

assert.strictEqual(presentation.compactSeed("123456789012345678901234"), "12345678…901234");
assert.match(presentation.snapshotCard(snapshot.fullRoster[0]), /data-player="p1"/);
assert.match(presentation.championFormationMarkup(snapshot), /hall-pitch/);
assert.match(presentation.championFormationMarkup(snapshot), /data-player="p1"/);
assert.match(presentation.championFiveVFiveMarkup(snapshot), /Formazione salvata/);
assert.match(presentation.championFiveVFiveMarkup(snapshot), /data-player="p3"/);
assert.match(presentation.statsMarkup(snapshot), /Bilancio della run/);
assert.match(presentation.statsMarkup(snapshot), /Partite speciali/);
assert.match(presentation.awardsMarkup(snapshot), /MVP/);
assert.doesNotMatch(presentation.awardsMarkup({ awards: [{ id: "other", playerName: "Due", label: "Altro" }] }), /Altro/);
assert.match(presentation.playerStatsMarkup(snapshot, snapshot.fullRoster[0], { appearances: 9, wins: 8, goals: 4, averageRating: 7.5 }), /PRESTAZIONI NELLA RUN/);
assert.match(presentation.playerStatsMarkup(snapshot, snapshot.fullRoster[0], { appearances: 9, wins: 8, goals: 4, averageRating: 7.5 }), /MVP/);

console.log("champion hall presentation domain: snapshot parity, Hall/final markup and persistence ownership boundary OK");
