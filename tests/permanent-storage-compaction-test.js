"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function makeStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    dump(key) { return data.get(String(key)) ?? null; },
  };
}

function contextWithStorage() {
  const localStorage = makeStorage();
  const context = {
    globalThis: null,
    console: { log() {}, warn() {}, error() {} },
    Date,
    Map,
    Set,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Error,
    localStorage,
    PersistenceRecoveryGuard: {
      isBlocked: () => false,
      assertWritable() {},
      reserve() {},
    },
    InazumaPersistenceDiagnostics: { removeExactTechnicalDuplicates() {} },
  };
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function load(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

(function hallCompaction() {
  const context = contextWithStorage();
  const players = Array.from({ length: 15 }, (_, index) => ({
    playerId: `p${index + 1}`,
    name: `Player ${index + 1}`,
    portraitUrl: `https://example.test/p${index + 1}.png`,
    fullbodyUrl: `https://example.test/full/${index + 1}.png`,
    finalOverall: 80 + index,
    finalStats: { attack: 70 + index, defense: 60 + index, speed: 65 + index },
    traits: ["a", "b"],
  }));
  const legacyTeam = {
    archiveSchemaVersion: 2,
    hallTeamId: "hall_test",
    archiveKey: "run-1::ie1::ie1::raimon",
    runId: "run-1",
    teamName: "Test",
    modeId: "ie1",
    modeName: "IE1",
    seasonId: "ie1",
    seasonName: "IE1",
    finalBossId: "raimon",
    victoryDate: "2026-09-07T10:00:00.000Z",
    finalFormation: "4-3-3",
    finalStartingEleven: players.slice(0, 11).map((player) => ({ ...player })),
    fullRoster: players.map((player) => ({ ...player })),
    bench: players.slice(11).map((player) => ({ ...player })),
    runStatistics: { winsTotal: 10, lossesTotal: 1, processedMatchIds: { x: true } },
    playerStatistics: Object.fromEntries(players.map((player) => [player.playerId, { playerId: player.playerId, appearancesTotal: 2, finalOverall: player.finalOverall }])),
    awards: [],
  };
  const legacyArchive = { schemaVersion: 2, updatedAt: legacyTeam.victoryDate, teams: [legacyTeam], index: [] };
  context.localStorage.setItem("inazuma.hallOfFame.v1", JSON.stringify(legacyArchive));
  const beforeBytes = context.localStorage.getItem("inazuma.hallOfFame.v1").length * 2;
  load(context, "js/hall-of-fame.js");
  assert.strictEqual(context.HallOfFameStorage.ARCHIVE_SCHEMA_VERSION, 3);
  const result = context.HallOfFameStorage.compactStoredArchive();
  const raw = JSON.parse(context.localStorage.getItem("inazuma.hallOfFame.v1"));
  assert.strictEqual(raw.schemaVersion, 3);
  assert(Array.isArray(raw.teams[0].finalStartingElevenIds));
  assert(Array.isArray(raw.teams[0].benchIds));
  assert(!Object.prototype.hasOwnProperty.call(raw.teams[0], "finalStartingEleven"));
  assert(!Object.prototype.hasOwnProperty.call(raw.teams[0], "bench"));
  assert(result.afterBytes < beforeBytes, "Hall compaction must reduce the stored archive");
  const expanded = context.HallOfFameStorage.getTeam("hall_test");
  assert.strictEqual(expanded.finalStartingEleven.length, 11);
  assert.strictEqual(expanded.bench.length, 4);
  assert.strictEqual(expanded.fullRoster.length, 15);
  assert.strictEqual(expanded.finalStartingEleven[0].name, "Player 1");
  assert.strictEqual(expanded.bench[0].playerId, "p12");
})();

(function albumCompaction() {
  const context = contextWithStorage();
  const collectionIds = ["ie1", "ie2", "ie1_s2", "ie1_s3", "orion"];
  const record = { firstUnlockedAt: "2026-01-01T00:00:00.000Z", firstSource: "draft" };
  const collections = Object.fromEntries(collectionIds.map((id) => [id, { unlockedPlayerIds: { fa1: { ...record }, fa2: { ...record }, [`unique-${id}`]: { firstUnlockedAt: "2026-02-01T00:00:00.000Z", firstSource: id } } }]));
  context.localStorage.setItem("inazumaRoguelike.albumProgress", JSON.stringify({ schemaVersion: 1, collections }));
  const beforeBytes = context.localStorage.getItem("inazumaRoguelike.albumProgress").length * 2;
  load(context, "js/album-progress.js");
  assert.strictEqual(context.AlbumProgress.SCHEMA_VERSION, 2);
  context.AlbumProgress.configureFreeAgentIds(["fa1", "fa2"]);
  const storedRaw = context.localStorage.getItem("inazumaRoguelike.albumProgress");
  const stored = JSON.parse(storedRaw);
  assert.strictEqual(stored.schemaVersion, 2);
  assert.deepStrictEqual(Object.keys(stored.sharedUnlockedPlayerIds).sort(), ["fa1", "fa2"]);
  collectionIds.forEach((id) => {
    assert(!stored.collections[id].unlockedPlayerIds.fa1);
    assert(!stored.collections[id].unlockedPlayerIds.fa2);
    assert(stored.collections[id].unlockedPlayerIds[`unique-${id}`]);
  });
  assert(storedRaw.length * 2 < beforeBytes, "Album compaction must reduce duplicated free-agent unlocks");
  const expanded = context.AlbumProgress.read();
  collectionIds.forEach((id) => {
    assert(expanded.collections[id].unlockedPlayerIds.fa1);
    assert(expanded.collections[id].unlockedPlayerIds.fa2);
  });
})();

(function terminalCleanup() {
  const context = contextWithStorage();
  const removals = [];
  context.RunState = {
    remove(seasonId, options) {
      removals.push({ seasonId, options });
      return { seasonId, generation: Number(options.expectedGeneration) + 1, commitId: "deleted", deleted: true };
    },
    load() { return null; },
  };
  context.SeasonRegistry = { list: () => [] };
  context.HallOfFameStorage = { getTeam: (id) => id === "hall-1" ? { hallTeamId: id } : null };
  load(context, "js/storage/terminal-run-cleanup.js");

  const gameover = {
    runId: "run-go", seasonId: "ie1", storageGeneration: 20, phase: "gameover", gameOver: true,
    permanentEffectOutbox: [{ status: "applied" }],
    developmentRewardPresentation: { endReason: "gameover", seen: true },
  };
  assert.strictEqual(context.TerminalRunCleanup.eligibility(gameover).eligible, true);
  const cleaned = context.TerminalRunCleanup.cleanup(gameover);
  assert.strictEqual(cleaned.cleaned, true);
  assert.strictEqual(removals.length, 1);
  assert.strictEqual(removals[0].options.expectedGeneration, 20);
  assert.strictEqual(removals[0].options.suppressCloudEvent, true);

  const pending = { ...gameover, runId: "run-pending", permanentEffectOutbox: [{ status: "pending" }] };
  assert.strictEqual(context.TerminalRunCleanup.eligibility(pending).eligible, false);
  assert.strictEqual(context.TerminalRunCleanup.cleanup(pending).cleaned, false);
  assert.strictEqual(removals.length, 1, "pending permanent effects must block cleanup");

  const victory = {
    runId: "run-win", seasonId: "orion", storageGeneration: 42, phase: "final-summary", gameOver: false,
    finalization: { status: "complete", hallTeamId: "hall-1" }, hallTeamId: "hall-1",
    permanentEffectOutbox: [{ status: "applied" }, { status: "applied" }],
    developmentRewardPresentation: { endReason: "victory", seen: true },
  };
  assert.strictEqual(context.TerminalRunCleanup.eligibility(victory).eligible, true);
  context.HallOfFameStorage.getTeam = () => null;
  assert.strictEqual(context.TerminalRunCleanup.eligibility(victory).eligible, false, "victory cleanup requires persisted Hall proof");
})();

console.log("permanent-storage-compaction-test: PASS");
