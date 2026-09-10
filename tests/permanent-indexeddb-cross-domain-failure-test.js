"use strict";

const assert = require("assert");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

class LocalStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

class MemoryDb {
  constructor() {
    this.stores = { meta: new Map(), album: new Map(), hall: new Map(), development: new Map() };
    this.queue = Promise.resolve();
    this.failNextUpdateStore = null;
  }
  async read(store, key = "state") { return clone(this.stores[store].get(String(key))); }
  async write(store, value, key = "state") {
    this.stores[store].set(String(key), clone(value));
    return clone(value);
  }
  update(store, updater, key = "state") {
    const task = this.queue.then(() => {
      if (this.failNextUpdateStore === store) {
        this.failNextUpdateStore = null;
        throw Object.assign(new Error(`simulated ${store} transaction failure`), { code: "indexeddb-transaction-aborted", stage: `${store}-test-update` });
      }
      const current = clone(this.stores[store].get(String(key)));
      const next = updater(current);
      if (next && typeof next.then === "function") throw new Error("IndexedDB test updater must stay synchronous");
      this.stores[store].set(String(key), clone(next));
      return clone(next);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}

function championSnapshot(runId = "cross-run") {
  const player = { playerId: "hall-player", name: "Hall Player", portraitUrl: "hall.webp", finalOverall: 84, recruitedOverall: 72 };
  return {
    hallTeamId: `hall-${runId}`,
    archiveKey: `${runId}::roguelike::ie1::raimon`,
    runId,
    modeId: "roguelike",
    seasonId: "ie1",
    finalBossId: "raimon",
    teamName: "Cross Domain Champions",
    victoryDate: "2026-09-10T14:00:00.000Z",
    finalFormation: "4-3-3",
    finalAverageOverall: 84,
    finalStartingEleven: [player],
    fullRoster: [player],
    bench: [],
    runStatistics: { winsTotal: 10, lossesTotal: 0 },
    playerStatistics: {},
    awards: [],
  };
}

(async function main() {
  const storage = new LocalStorage();
  const db = new MemoryDb();
  const listeners = new Map();
  const runs = new Map();
  let blocked = false;
  let reserves = 0;

  global.localStorage = storage;
  global.PermanentIndexedDb = db;
  global.CustomEvent = class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
  global.addEventListener = (type, listener) => {
    const values = listeners.get(type) || [];
    values.push(listener);
    listeners.set(type, values);
  };
  global.dispatchEvent = (event) => {
    for (const listener of listeners.get(event.type) || []) listener(event);
    return true;
  };
  global.PersistenceRecoveryGuard = {
    EPOCH_KEY: "inazuma.persistence.localMutationEpoch",
    isBlocked: () => blocked,
    assertWritable() {
      if (blocked) throw Object.assign(new Error("restore recovery required"), { code: "restore-recovery-required", stage: "cross-domain-test-guard" });
      return true;
    },
    reserve() {
      if (blocked) throw Object.assign(new Error("restore recovery required"), { code: "restore-recovery-required", stage: "cross-domain-test-reserve" });
      reserves += 1;
      return reserves;
    },
  };
  global.SeasonRegistry = {
    activeId: () => "ie1",
    list: () => [{ id: "ie1", name: "IE1" }],
  };
  global.RunState = {
    save(run) {
      const next = clone(run);
      next.storageGeneration = Number(next.storageGeneration || 0) + 1;
      runs.set(String(next.seasonId), next);
      Object.assign(run, clone(next));
      return run;
    },
    load(seasonId) { return clone(runs.get(String(seasonId)) || null); },
    remove(seasonId) {
      const deleted = runs.delete(String(seasonId));
      return { deleted };
    },
  };

  let legacyAlbum = {
    schemaVersion: 2,
    sharedUnlockedPlayerIds: {},
    collections: { ie1: { unlockedPlayerIds: {} } },
  };
  let legacyAlbumWrites = 0;
  global.AlbumProgress = {
    STORAGE_KEY: "inazumaRoguelike.albumProgress",
    SCHEMA_VERSION: 2,
    DEFAULT_COLLECTION_ID: "ie1",
    ALBUM_COLLECTIONS: { ie1: { id: "ie1" } },
    read: () => clone(legacyAlbum),
    write(value) { legacyAlbumWrites += 1; legacyAlbum = clone(value); return clone(value); },
    configureFreeAgentIds(ids) { return Array.from(ids || []).length; },
    unlockAlbumPlayer() { legacyAlbumWrites += 1; return true; },
    unlockAlbumPlayers() { legacyAlbumWrites += 1; return 1; },
    backfillAlbumProgress() { legacyAlbumWrites += 1; return 1; },
    compactStoredProgress() { legacyAlbumWrites += 1; return {}; },
    unlockedSet(collectionId, progress = legacyAlbum) { return new Set(Object.keys(progress.collections?.[collectionId]?.unlockedPlayerIds || {})); },
    isAlbumPlayerUnlocked(collectionId, playerId, progress = legacyAlbum) { return this.unlockedSet(collectionId, progress).has(String(playerId)); },
    collectIdsFromRun(run) { return (run?.roster || []).map((entry) => String(entry.playerId)); },
    collectIdsFromHallTeam(team) { return (team?.fullRoster || []).map((entry) => String(entry.playerId)); },
    _storageProgress: (progress) => clone(progress),
  };

  storage.setItem("inazuma.hallOfFame.v1", JSON.stringify({ schemaVersion: 3, updatedAt: null, teams: [], index: [] }));

  // Match the browser composition: Hall is defined before PermanentEffects,
  // Album storage is defined before PermanentEffects, then the bridges install.
  require("../js/hall-of-fame.js");
  const AlbumStorage = require("../js/storage/album-indexeddb.js");
  require("../js/permanent-effects.js");
  const AlbumEffects = require("../js/storage/album-permanent-effects.js");

  global.InazumaProgression = require("../js/roguelike_progression.js");
  const V2 = require("../js/development-v2.js");
  const V3 = require("../js/development-v3.js");
  const Migration = require("../js/development-v3-migration.js");
  const Runtime = require("../js/development-runtime.js");
  const Account = require("../js/development-account-v3.js");
  const database = require("../data/FREE_AGENTS_compact.json");
  Runtime.registerDatabase("free-agents", database);
  const options = {
    DevelopmentV2: V2,
    DevelopmentV3: V3,
    DevelopmentV3Migration: Migration,
    progression: global.InazumaProgression,
    database,
    resolveBasePlayer: Runtime.resolveBasePlayer,
  };
  storage.setItem(V2.STORAGE_KEY, JSON.stringify(Account.envelopeFor(V3.empty(), options)));
  const DevelopmentStorage = require("../js/storage/development-indexeddb.js");

  const albumReady = await AlbumStorage.ensureReady();
  const hallReady = await global.HallOfFameStorage.ensureIndexedDbReady();
  const developmentReady = await DevelopmentStorage.ensureReady(options);
  assert.strictEqual(albumReady.authority, "indexeddb");
  assert.strictEqual(hallReady.authority, "indexeddb");
  assert.strictEqual(developmentReady.authority, "indexeddb");
  assert.strictEqual(legacyAlbumWrites, 0, "cross-domain migration must not dual-write Album legacy storage");

  // RecoveryGuard must fence every permanent domain after cutover.
  const funded = V3.empty();
  funded.coins = 500;
  await Account.commitAsync(funded, options);
  const devBeforeBlocked = clone(Account.read());
  const albumBeforeBlocked = clone(global.AlbumProgress.read());
  const hallBeforeBlocked = clone(global.HallOfFameStorage._loadArchive());
  blocked = true;
  await assert.rejects(Account.purchaseProjectAsync("Buono"), (error) => error.code === "restore-recovery-required");
  await assert.rejects(global.AlbumProgress.unlockAlbumPlayer("ie1", "blocked-album", { source: "blocked-test" }), (error) => error.code === "restore-recovery-required");
  const blockedHall = await global.HallOfFameStorage.addChampionAsync(championSnapshot("blocked-run"));
  assert.strictEqual(blockedHall.persisted, false);
  assert.deepStrictEqual(Account.read(), devBeforeBlocked, "blocked Development mutation must not advance canonical state");
  assert.deepStrictEqual(global.AlbumProgress.read(), albumBeforeBlocked, "blocked Album mutation must not advance canonical state");
  assert.deepStrictEqual(global.HallOfFameStorage._loadArchive(), hallBeforeBlocked, "blocked Hall mutation must not advance canonical state");
  blocked = false;
  await Account.resetAsync(options);

  // Simulate the critical cross-domain crash boundary:
  // Hall commits successfully, Development transaction aborts, retry must not
  // duplicate Hall or reward, and Album receipt must remain protected meanwhile.
  const snapshot = championSnapshot();
  const run = {
    runId: "cross-run",
    seasonId: "ie1",
    storageGeneration: 1,
    phase: "finalization",
    gameOver: false,
    completedBossIds: ["boss-a", "boss-b"],
    bossIndex: 2,
    finalization: { status: "pending", hallTeamId: null },
    permanentEffectOutbox: [],
  };
  global.PermanentEffects.enqueueHall(run, snapshot);
  global.PermanentEffects.enqueueAlbum(run, { playerId: "album-player", source: "boss-reward", actionId: "boss-a-pick" });
  global.RunState.save(run);

  db.failNextUpdateStore = "development";
  const first = await global.PermanentEffects.resumeFinalization(run);
  assert.strictEqual(first.completed, false, "Development abort after Hall commit must leave finalization resumable");
  assert.strictEqual(run.finalization.status, "hall-written");
  assert.strictEqual(global.HallOfFameStorage._loadArchive().teams.filter((team) => team.archiveKey === snapshot.archiveKey).length, 1, "Hall must be committed exactly once before Development retry");
  const developmentReceipt = run.permanentEffectOutbox.find((entry) => entry.type === global.PermanentEffects.TYPES.DEVELOPMENT);
  const hallReceipt = run.permanentEffectOutbox.find((entry) => entry.type === global.PermanentEffects.TYPES.HALL);
  const albumReceipt = run.permanentEffectOutbox.find((entry) => entry.type === global.PermanentEffects.TYPES.ALBUM);
  assert(developmentReceipt, "finalization must enqueue the Development receipt");
  assert.strictEqual(developmentReceipt.status, "pending");
  assert.strictEqual(hallReceipt.status, "applied");
  assert.strictEqual(albumReceipt.status, "pending");
  assert.strictEqual(Account.read().coins, 0, "aborted Development transaction must not award partial currency");
  assert.deepStrictEqual(Account.read().redeemedRunIds, []);

  const second = await global.PermanentEffects.resumeFinalization(run);
  assert.strictEqual(second.completed, true, "retry must complete from hall-written without rebuilding Hall");
  assert.strictEqual(run.finalization.status, "complete");
  assert.strictEqual(Account.read().coins, 140, "victory reward must be credited exactly once");
  assert.strictEqual(Account.read().cupsBySeason.ie1, 1);
  assert.deepStrictEqual(Account.read().redeemedRunIds, [run.runId]);
  assert.strictEqual(global.HallOfFameStorage._loadArchive().teams.filter((team) => team.archiveKey === snapshot.archiveKey).length, 1, "retry must not duplicate Hall snapshot");

  const third = await global.PermanentEffects.resumeFinalization(run);
  assert.strictEqual(third.completed, true);
  assert.strictEqual(Account.read().coins, 140, "re-entering completed finalization must not duplicate Development reward");

  assert.throws(
    () => global.RunState.remove("ie1"),
    (error) => error.code === "album-permanent-effect-pending",
    "composed RunState guards must not allow deletion while an Album receipt is pending",
  );
  await AlbumEffects.requestDrain("ie1");
  assert(global.AlbumProgress.isAlbumPlayerUnlocked("ie1", "album-player"), "pending Album receipt must remain drainable after Hall/Development recovery");
  assert.doesNotThrow(() => global.RunState.remove("ie1"));
  assert.strictEqual(global.RunState.load("ie1"), null);

  assert(reserves > 0, "cross-domain permanent mutations must participate in RecoveryGuard fencing");
  console.log("permanent-indexeddb-cross-domain-failure-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
