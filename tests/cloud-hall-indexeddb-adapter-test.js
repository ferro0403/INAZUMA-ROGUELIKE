"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => JSON.parse(JSON.stringify(value));

(async function main() {
  let hallRefreshes = 0;
  const idbHall = { schemaVersion: 3, updatedAt: "2026-09-10T00:00:00.000Z", teams: [{ hallTeamId: "idb-hall", archiveKey: "idb-key", runId: "run-1" }], index: [{ hallTeamId: "idb-hall" }] };
  const context = {
    globalThis: null, window: null, console, Promise, Object, Symbol, JSON, Error,
    AlbumIndexedDbStorage: null,
    HallOfFameStorage: {
      ARCHIVE_SCHEMA_VERSION: 3,
      async ensureIndexedDbReady() { return { authority: "indexeddb" }; },
      async refreshIndexedDbArchive() { hallRefreshes += 1; return clone(idbHall); },
    },
  };
  context.InazumaCloudSaveCore = Object.freeze({
    clone,
    readLocalSnapshot() { return { profile: {}, album: {}, development: {}, hallOfFame: { archiveSchemaVersion: 3, updatedAt: null, teams: [{ hallTeamId: "legacy" }], index: [] } }; },
    async prepareSnapshot(snapshot) { return { snapshot: clone(snapshot) }; },
    async compareSnapshots(expected, actual) { return { equivalent: JSON.stringify(expected) === JSON.stringify(actual), expected: clone(expected), actual: clone(actual) }; },
  });
  context.globalThis = context; context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/storage/cloud-permanent-storage-adapter.js", "utf8"), context, { filename: "js/storage/cloud-permanent-storage-adapter.js" });

  const local = context.InazumaCloudSaveCore.readLocalSnapshot();
  const prepared = await context.InazumaCloudSaveCore.prepareSnapshot(local);
  assert.strictEqual(prepared.snapshot.hallOfFame.teams[0].hallTeamId, "idb-hall");
  assert.strictEqual(prepared.snapshot.hallOfFame.archiveSchemaVersion, 3);

  const remote = { profile: {}, album: {}, development: {}, hallOfFame: { archiveSchemaVersion: 3, updatedAt: null, teams: [{ hallTeamId: "remote" }], index: [] } };
  const preparedRemote = await context.InazumaCloudSaveCore.prepareSnapshot(remote);
  assert.strictEqual(preparedRemote.snapshot.hallOfFame.teams[0].hallTeamId, "remote", "remote restore target must not be overwritten by local Hall IndexedDB");
  assert(hallRefreshes >= 1);

  console.log("cloud-hall-indexeddb-adapter-test: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
