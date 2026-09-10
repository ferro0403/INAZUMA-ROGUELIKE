"use strict";

const assert = require("assert");

class MemoryStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); this.failSentinelWrite = false; }
  get length() { return this.map.size; }
  key(index) { return Array.from(this.map.keys())[index] ?? null; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) {
    if (this.failSentinelWrite && String(key) === "inazuma.permanentIndexedDbCleanup.v1") {
      const error = new Error("quota full");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.map.set(String(key), String(value));
  }
  removeItem(key) { this.map.delete(String(key)); }
}

function memoryDb({ incomplete = null, missing = null } = {}) {
  const markers = {
    "migration:album:localstorage-to-indexeddb:v1": { complete: incomplete !== "album" },
    "migration:hall:localstorage-to-indexeddb:v1": { complete: incomplete !== "hall" },
    "migration:development:localstorage-to-indexeddb:v1": { complete: incomplete !== "development" },
  };
  const records = { album: { state: { ok: "album" } }, hall: { state: { ok: "hall" } }, development: { state: { ok: "development" } } };
  return {
    async read(store, key = "state") {
      if (store === "meta") return markers[key];
      if (missing === store) return undefined;
      return records[store]?.[key];
    },
  };
}

function load({ blocked = false, authorities = {}, dbOptions = {}, storage = null } = {}) {
  const localStorage = storage || new MemoryStorage({
    "inazuma.hallOfFame.v1": "H".repeat(1024),
    "inazuma.hallOfFame.v1.backup": "B".repeat(512),
    "inazuma.hallOfFame.v1.tmp": "T".repeat(128),
    "inazumaRoguelike.albumProgress": "A".repeat(256),
    "inazumaRoguelike.developmentV2": "D".repeat(128),
    "run:ie1": "RUN-MUST-SURVIVE",
    "inazuma.profile": "PROFILE-MUST-SURVIVE",
  });
  global.localStorage = localStorage;
  global.PersistenceRecoveryGuard = { isBlocked: () => blocked };
  global.PermanentIndexedDb = memoryDb(dbOptions);
  global.AlbumProgress = { STORAGE_KEY: "inazumaRoguelike.albumProgress" };
  global.DevelopmentV2 = { STORAGE_KEY: "inazumaRoguelike.developmentV2" };
  global.AlbumIndexedDbStorage = {
    STORE: "album", STATE_KEY: "state", MIGRATION_KEY: "migration:album:localstorage-to-indexeddb:v1",
    isAuthority: () => authorities.album !== false,
  };
  global.HallOfFameStorage = {
    IDB_STORE: "hall", IDB_STATE_KEY: "state", IDB_MIGRATION_KEY: "migration:hall:localstorage-to-indexeddb:v1",
    STORAGE_KEY: "inazuma.hallOfFame.v1", BACKUP_KEY: "inazuma.hallOfFame.v1.backup", TEMP_KEY: "inazuma.hallOfFame.v1.tmp",
    isIndexedDbAuthority: () => authorities.hall !== false,
  };
  global.DevelopmentIndexedDbStorage = {
    STORE: "development", STATE_KEY: "state", MIGRATION_KEY: "migration:development:localstorage-to-indexeddb:v1",
    isAuthority: () => authorities.development !== false,
  };
  delete global.__INAZUMA_PERMANENT_LEGACY_CLEANUP_RESULT__;
  delete require.cache[require.resolve("../js/storage/permanent-legacy-cleanup.js")];
  const api = require("../js/storage/permanent-legacy-cleanup.js");
  return { api, localStorage };
}

(async () => {
  {
    const { api, localStorage } = load();
    const result = await api.cleanup();
    assert.strictEqual(result.ok, true);
    assert(result.bytesFreed > 0);
    for (const key of [
      "inazuma.hallOfFame.v1",
      "inazuma.hallOfFame.v1.backup",
      "inazuma.hallOfFame.v1.tmp",
      "inazumaRoguelike.albumProgress",
      "inazumaRoguelike.developmentV2",
    ]) assert.strictEqual(localStorage.getItem(key), null, `${key} must be removed after certified cutover`);
    assert.strictEqual(localStorage.getItem("run:ie1"), "RUN-MUST-SURVIVE", "run storage must never be cleaned");
    assert.strictEqual(localStorage.getItem("inazuma.profile"), "PROFILE-MUST-SURVIVE", "profile/metadata must never be cleaned");
    assert.strictEqual(api.wasCleaned("album"), true);
    assert.strictEqual(api.wasCleaned("hall"), true);
    assert.strictEqual(api.wasCleaned("development"), true);
    const second = await api.cleanup();
    assert.strictEqual(second.ok, true, "cleanup must be idempotent");
    assert.strictEqual(second.bytesFreed, 0);
  }

  {
    const { api, localStorage } = load({ authorities: { development: false } });
    const result = await api.cleanup();
    assert.strictEqual(result.ok, true);
    assert.notStrictEqual(localStorage.getItem("inazumaRoguelike.developmentV2"), null, "uncertified authority must preserve Development legacy");
    assert.strictEqual(api.wasCleaned("development"), false);
    assert.strictEqual(localStorage.getItem("inazumaRoguelike.albumProgress"), null, "independently certified domains may still clean safely");
  }

  {
    const { api, localStorage } = load({ dbOptions: { incomplete: "album" } });
    await api.cleanup();
    assert.notStrictEqual(localStorage.getItem("inazumaRoguelike.albumProgress"), null, "incomplete migration marker must preserve legacy bytes");
    assert.strictEqual(api.wasCleaned("album"), false);
  }

  {
    const { api, localStorage } = load({ dbOptions: { missing: "hall" } });
    await api.cleanup();
    assert.notStrictEqual(localStorage.getItem("inazuma.hallOfFame.v1"), null, "missing IndexedDB record must preserve Hall legacy bytes");
    assert.strictEqual(api.wasCleaned("hall"), false);
  }

  {
    const { api, localStorage } = load({ blocked: true });
    const before = new Map(localStorage.map);
    const result = await api.cleanup();
    assert.strictEqual(result.reason, "restore-recovery-required");
    assert.deepStrictEqual([...localStorage.map.entries()], [...before.entries()], "RecoveryGuard block must make cleanup a no-op");
  }

  {
    const storage = new MemoryStorage({ "inazumaRoguelike.albumProgress": "ALBUM", "run:ie1": "RUN" });
    storage.failSentinelWrite = true;
    const { api, localStorage } = load({ storage });
    const result = await api.cleanupDomain("album");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(localStorage.getItem("inazumaRoguelike.albumProgress"), "ALBUM", "legacy bytes must survive if fail-closed sentinel cannot be persisted first");
  }

  const fs = require("fs");
  const albumSource = fs.readFileSync("js/storage/album-indexeddb.js", "utf8");
  const hallSource = fs.readFileSync("js/hall-of-fame.js", "utf8");
  const developmentSource = fs.readFileSync("js/storage/development-indexeddb.js", "utf8");
  assert(albumSource.includes('wasCleaned?.("album")'), "Album must fail closed after legacy cleanup");
  assert(hallSource.includes('wasCleaned?.("hall")'), "Hall must fail closed after legacy cleanup");
  assert(developmentSource.includes('wasCleaned?.("development")'), "Development must fail closed after legacy cleanup");

  console.log("permanent-legacy-localstorage-cleanup-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
