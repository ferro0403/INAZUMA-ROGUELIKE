"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => JSON.parse(JSON.stringify(value));

(async function main() {
  let refreshes = 0;
  const context = {
    globalThis: null,
    window: null,
    console,
    Promise,
    Object,
    Symbol,
    JSON,
    Error,
    AlbumIndexedDbStorage: {
      async ensureReady() { return { authority: "indexeddb" }; },
      async refresh() { refreshes += 1; return { schemaVersion: 2 }; },
      read() { return { schemaVersion: 2, collections: { ie1: { unlockedPlayerIds: { idb: true } } } }; },
    },
  };
  context.InazumaCloudSaveCore = Object.freeze({
    clone,
    readLocalSnapshot() { return { profile: {}, album: { legacy: true }, development: {}, hallOfFame: { teams: [], index: [] } }; },
    async prepareSnapshot(snapshot) { return { snapshot: clone(snapshot) }; },
    async compareSnapshots(expected, actual) { return { equivalent: JSON.stringify(expected) === JSON.stringify(actual), expected: clone(expected), actual: clone(actual) }; },
  });
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/storage/cloud-permanent-storage-adapter.js", "utf8"), context, { filename: "js/storage/cloud-permanent-storage-adapter.js" });

  const local = context.InazumaCloudSaveCore.readLocalSnapshot();
  const preparedLocal = await context.InazumaCloudSaveCore.prepareSnapshot(local);
  assert(preparedLocal.snapshot.album.collections.ie1.unlockedPlayerIds.idb, "local cloud snapshot must wait for and use IndexedDB Album authority");
  assert.strictEqual(preparedLocal.snapshot.album.legacy, undefined);

  const cloud = { profile: {}, album: { cloud: true }, development: {}, hallOfFame: { teams: [], index: [] } };
  const preparedCloud = await context.InazumaCloudSaveCore.prepareSnapshot(cloud);
  assert.deepStrictEqual(preparedCloud.snapshot.album, { cloud: true }, "remote/cloud snapshots must never be overwritten with local IndexedDB Album data");

  const comparison = await context.InazumaCloudSaveCore.compareSnapshots(local, cloud);
  assert(comparison.expected.album.collections.ie1.unlockedPlayerIds.idb, "tagged local snapshot must be materialized from IndexedDB during comparison");
  assert.deepStrictEqual(comparison.actual.album, { cloud: true }, "comparison must preserve remote target Album payload");
  assert(refreshes >= 2, "local snapshot preparation/comparison should refresh IndexedDB authority before cloud hashing");

  console.log("cloud-permanent-storage-adapter-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
