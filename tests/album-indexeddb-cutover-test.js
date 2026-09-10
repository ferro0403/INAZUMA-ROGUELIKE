"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function memoryDb(seed = {}) {
  const stores = {
    meta: new Map(Object.entries(seed.meta || {})),
    album: new Map(Object.entries(seed.album || {})),
    hall: new Map(),
    development: new Map(),
  };
  return {
    stores,
    async read(store, key = "state") { return clone(stores[store].get(String(key))); },
    async write(store, value, key = "state") { stores[store].set(String(key), clone(value)); return clone(value); },
    async update(store, updater, key = "state") {
      const next = updater(clone(stores[store].get(String(key))));
      stores[store].set(String(key), clone(next));
      return clone(next);
    },
  };
}

function makeContext({ db = memoryDb(), legacyState = null, unavailable = false } = {}) {
  let legacy = clone(legacyState || {
    schemaVersion: 2,
    sharedUnlockedPlayerIds: {},
    collections: { ie1: { unlockedPlayerIds: { legacy_player: { firstUnlockedAt: "2026-01-01T00:00:00.000Z", firstSource: "legacy" } } }, ie2: { unlockedPlayerIds: {} } },
  });
  let legacyWrites = 0;
  let reserves = 0;
  const events = [];
  const context = {
    globalThis: null,
    window: null,
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    TypeError,
    Set,
    Map,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    dispatchEvent(event) { events.push(event); },
    addEventListener() {},
    PermanentIndexedDb: unavailable ? {
      async read() { throw Object.assign(new Error("unavailable"), { code: "indexeddb-unavailable" }); },
    } : db,
    PersistenceRecoveryGuard: {
      isBlocked: () => false,
      assertWritable() { return true; },
      reserve() { reserves += 1; return reserves; },
      EPOCH_KEY: "epoch",
    },
    SeasonRegistry: {
      list: () => [{ id: "ie1" }, { id: "ie2" }],
    },
    RunState: {
      load(seasonId) {
        return seasonId === "ie1" ? { seasonId: "ie1", roster: [{ playerId: "run_player" }], lineup: [], bench: [] } : null;
      },
    },
    HallOfFameStorage: {
      listSummaries: () => [{ hallTeamId: "hall-1" }],
      getTeam: () => ({ seasonId: "ie2", fullRoster: [{ playerId: "hall_player" }] }),
    },
  };
  context.AlbumProgress = {
    STORAGE_KEY: "album-legacy",
    SCHEMA_VERSION: 2,
    DEFAULT_COLLECTION_ID: "ie1",
    ALBUM_COLLECTIONS: { ie1: { id: "ie1" }, ie2: { id: "ie2" } },
    read: () => clone(legacy),
    write(value) { legacyWrites += 1; legacy = clone(value); return clone(value); },
    configureFreeAgentIds(ids) { return Array.from(ids || []).length; },
    unlockAlbumPlayer() { legacyWrites += 1; return true; },
    unlockAlbumPlayers() { legacyWrites += 1; return 1; },
    backfillAlbumProgress() { legacyWrites += 1; return 1; },
    compactStoredProgress() { legacyWrites += 1; return {}; },
    unlockedSet(collectionId, progress = legacy) { return new Set(Object.keys(progress.collections?.[collectionId]?.unlockedPlayerIds || {})); },
    isAlbumPlayerUnlocked(collectionId, playerId, progress = legacy) { return this.unlockedSet(collectionId, progress).has(String(playerId)); },
    collectIdsFromRun(run) { return (run?.roster || []).map((entry) => String(entry.playerId)); },
    collectIdsFromHallTeam(team) { return (team?.fullRoster || []).map((entry) => String(entry.playerId)); },
    _storageProgress: (progress) => clone(progress),
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/storage/album-indexeddb.js", "utf8"), context, { filename: "js/storage/album-indexeddb.js" });
  return {
    context,
    db,
    events,
    getLegacyWrites: () => legacyWrites,
    getReserves: () => reserves,
  };
}

(async function main() {
  {
    const db = memoryDb({ album: { state: {
      schemaVersion: 2,
      sharedUnlockedPlayerIds: {},
      collections: { ie1: { unlockedPlayerIds: { crash_candidate: { firstUnlockedAt: "2026-02-01T00:00:00.000Z", firstSource: "partial-migration" } } }, ie2: { unlockedPlayerIds: {} } },
    } } });
    const runtime = makeContext({ db });
    const result = await runtime.context.AlbumIndexedDbStorage.ensureReady();
    assert.strictEqual(result.authority, "indexeddb");
    assert.strictEqual(result.migrated, true);
    assert.strictEqual(runtime.getLegacyWrites(), 0, "migration must not rewrite or delete legacy Album data");

    const state = runtime.context.AlbumProgress.read();
    for (const [collectionId, playerId] of [["ie1", "legacy_player"], ["ie1", "crash_candidate"], ["ie1", "run_player"], ["ie2", "hall_player"]]) {
      assert(runtime.context.AlbumProgress.isAlbumPlayerUnlocked(collectionId, playerId, state), `${playerId} must survive migration/backfill`);
    }
    const marker = await db.read("meta", runtime.context.AlbumIndexedDbStorage.MIGRATION_KEY);
    assert.strictEqual(marker.complete, true, "authority marker must be written only after verified Album state");

    await runtime.context.AlbumProgress.unlockAlbumPlayer("ie1", "indexeddb_only", { source: "test" });
    assert(runtime.context.AlbumProgress.isAlbumPlayerUnlocked("ie1", "indexeddb_only"));
    assert.strictEqual(runtime.getLegacyWrites(), 0, "post-cutover unlock must not dual-write legacy localStorage");
    assert.strictEqual(runtime.getReserves(), 1, "logical IndexedDB mutation must reserve one permanent mutation epoch");
    assert(runtime.events.some((event) => event.detail?.sector === "album" && event.detail?.domain === "account-permanent"), "IndexedDB Album commit must keep cloud dirty-sector notification semantics");
  }

  {
    const db = memoryDb({ meta: { "migration:album:localstorage-to-indexeddb:v1": { complete: true } } });
    const runtime = makeContext({ db });
    await assert.rejects(runtime.context.AlbumIndexedDbStorage.ensureReady(), (error) => error.code === "album-indexeddb-authority-corrupt");
    assert.strictEqual(runtime.getLegacyWrites(), 0, "completed authority must never fall back by rewriting legacy storage");
  }

  {
    const runtime = makeContext({ unavailable: true });
    const result = await runtime.context.AlbumIndexedDbStorage.ensureReady();
    assert.strictEqual(result.authority, "legacy");
    assert.strictEqual(result.deferred, true, "before cutover an unavailable IndexedDB must preserve legacy compatibility");
    assert(runtime.context.AlbumProgress.isAlbumPlayerUnlocked("ie1", "legacy_player"));
  }

  console.log("album-indexeddb-cutover-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
