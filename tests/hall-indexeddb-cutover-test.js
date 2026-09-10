"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function memoryDb(seed = {}, options = {}) {
  const stores = {
    meta: new Map(Object.entries(seed.meta || {})),
    album: new Map(),
    hall: new Map(Object.entries(seed.hall || {})),
    development: new Map(),
  };
  return {
    stores,
    async read(store, key = "state") {
      if (options.unavailable) throw Object.assign(new Error("unavailable"), { code: "indexeddb-unavailable" });
      return clone(stores[store].get(String(key)));
    },
    async write(store, value, key = "state") {
      if (options.writeError) throw options.writeError;
      stores[store].set(String(key), clone(value));
      return clone(value);
    },
    async update(store, updater, key = "state") {
      if (options.writeError) throw options.writeError;
      const next = updater(clone(stores[store].get(String(key))));
      stores[store].set(String(key), clone(next));
      return clone(next);
    },
  };
}

function team(id, archiveKey, victoryDate) {
  const player = { playerId: `${id}-p1`, name: `${id} Player`, portraitUrl: `${id}.webp`, finalOverall: 80, recruitedOverall: 70 };
  return {
    hallTeamId: id,
    archiveKey,
    runId: `run-${id}`,
    seasonId: "ie1",
    teamName: `Team ${id}`,
    victoryDate,
    finalFormation: "4-3-3",
    finalAverageOverall: 80,
    finalStartingEleven: [player],
    fullRoster: [player],
    bench: [],
    runStatistics: { winsTotal: 10, lossesTotal: 1 },
    playerStatistics: {},
    awards: [],
  };
}

function serializedArchive(teams) {
  return { schemaVersion: 3, updatedAt: "2026-09-09T00:00:00.000Z", teams, index: [] };
}

function makeContext({ db = memoryDb(), legacyTeams = [team("legacy", "legacy-key", "2026-09-01T00:00:00.000Z")], blocked = false } = {}) {
  const storage = new Map();
  storage.set("inazuma.hallOfFame.v1", JSON.stringify(serializedArchive(legacyTeams)));
  const originalRaw = storage.get("inazuma.hallOfFame.v1");
  const events = [];
  let reserves = 0;
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
    localStorage: {
      getItem(key) { return storage.has(String(key)) ? storage.get(String(key)) : null; },
      setItem(key, value) { storage.set(String(key), String(value)); },
      removeItem(key) { storage.delete(String(key)); },
    },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    dispatchEvent(event) { events.push(event); },
    addEventListener() {},
    PermanentIndexedDb: db,
    PersistenceRecoveryGuard: {
      EPOCH_KEY: "epoch",
      isBlocked: () => blocked,
      assertWritable() { if (blocked) throw Object.assign(new Error("blocked"), { code: "restore-recovery-required" }); return true; },
      reserve() { reserves += 1; return reserves; },
    },
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/hall-of-fame.js", "utf8"), context, { filename: "js/hall-of-fame.js" });
  return { context, db, storage, originalRaw, events, getReserves: () => reserves };
}

(async function main() {
  {
    const partial = team("partial", "partial-key", "2026-08-01T00:00:00.000Z");
    const duplicate = team("wrong-duplicate", "legacy-key", "2026-10-01T00:00:00.000Z");
    const db = memoryDb({ hall: { state: serializedArchive([duplicate, partial]) } });
    const runtime = makeContext({ db });
    const result = await runtime.context.HallOfFameStorage.ensureIndexedDbReady();
    assert.strictEqual(result.authority, "indexeddb");
    assert.strictEqual(result.migrated, true);
    assert.strictEqual(runtime.storage.get("inazuma.hallOfFame.v1"), runtime.originalRaw, "migration must preserve legacy Hall bytes");
    assert.strictEqual(runtime.context.HallOfFameStorage.isIndexedDbAuthority(), true);

    const archive = runtime.context.HallOfFameStorage._loadArchive();
    assert.strictEqual(archive.teams.length, 2, "legacy + non-duplicate partial archive must survive");
    assert.strictEqual(archive.teams.find((entry) => entry.archiveKey === "legacy-key").hallTeamId, "legacy", "legacy snapshot must dominate duplicate archiveKey during interrupted migration");

    const marker = await db.read("meta", runtime.context.HallOfFameStorage.IDB_MIGRATION_KEY);
    assert.strictEqual(marker.complete, true);

    const beforeLegacy = runtime.storage.get("inazuma.hallOfFame.v1");
    const added = await runtime.context.HallOfFameStorage.addChampionAsync(team("new", "new-key", "2026-09-10T00:00:00.000Z"));
    assert.strictEqual(added.persisted, true);
    assert.strictEqual(added.created, true);
    assert.strictEqual(runtime.storage.get("inazuma.hallOfFame.v1"), beforeLegacy, "post-cutover Hall write must not dual-write localStorage");
    assert(runtime.context.HallOfFameStorage.getTeam("new"));
    assert(runtime.events.some((event) => event.detail?.sector === "hall_index" && event.detail?.domain === "account-permanent"));
    assert.strictEqual(runtime.getReserves(), 1, "one logical Hall mutation must reserve one permanent mutation epoch");

    const duplicateResult = await runtime.context.HallOfFameStorage.addChampionAsync(team("other-id", "new-key", "2026-09-11T00:00:00.000Z"));
    assert.strictEqual(duplicateResult.created, false, "archiveKey must remain idempotent");
    assert.strictEqual(runtime.context.HallOfFameStorage._loadArchive().teams.filter((entry) => entry.archiveKey === "new-key").length, 1);

    assert.throws(() => runtime.context.HallOfFameStorage.removeTeam("new"), (error) => error.code === "hall-indexeddb-async-required");
    await runtime.context.HallOfFameStorage.removeTeamAsync("new");
    assert.strictEqual(runtime.context.HallOfFameStorage.getTeam("new"), null);
  }

  {
    const db = memoryDb({ meta: { "migration:hall:localstorage-to-indexeddb:v1": { complete: true } } });
    const runtime = makeContext({ db });
    await assert.rejects(runtime.context.HallOfFameStorage.ensureIndexedDbReady(), (error) => error.code === "hall-indexeddb-authority-corrupt");
    assert.strictEqual(runtime.storage.get("inazuma.hallOfFame.v1"), runtime.originalRaw, "completed authority corruption must not rewrite legacy Hall");
  }

  {
    const runtime = makeContext({ db: memoryDb({}, { unavailable: true }) });
    const result = await runtime.context.HallOfFameStorage.ensureIndexedDbReady();
    assert.strictEqual(result.authority, "legacy");
    assert.strictEqual(result.deferred, true);
    assert.strictEqual(runtime.context.HallOfFameStorage.listSummaries().length, 1);
  }

  {
    const runtime = makeContext({ blocked: true });
    const result = await runtime.context.HallOfFameStorage.ensureIndexedDbReady();
    assert.strictEqual(result.authority, "legacy");
    assert.strictEqual(result.deferred, true);
    assert.strictEqual(result.reason, "restore-recovery-required");
  }

  console.log("hall-indexeddb-cutover-test: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
