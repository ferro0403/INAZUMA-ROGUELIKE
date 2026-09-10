"use strict";

const assert = require("assert");

(async () => {
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const legacyDevelopment = { source: "legacy", coins: 1 };
  const indexedDevelopment = { source: "indexeddb", coins: 777 };
  let refreshes = 0;

  global.AlbumIndexedDbStorage = null;
  global.HallOfFameStorage = null;
  global.DevelopmentIndexedDbStorage = {
    async ensureReady() { return { authority: "indexeddb" }; },
    async refresh() { refreshes += 1; return { authority: "indexeddb" }; },
    readCompatibility() { return clone(indexedDevelopment); },
  };
  global.InazumaCloudSaveCore = {
    clone,
    readLocalSnapshot() {
      return { profile: { name: "Team" }, album: { a: 1 }, development: clone(legacyDevelopment), hallOfFame: { teams: [], index: [] } };
    },
    async prepareSnapshot(snapshot) { return { snapshot: clone(snapshot) }; },
    async compareSnapshots(expected, actual) {
      return { equivalent: JSON.stringify(expected) === JSON.stringify(actual), expected: clone(expected), actual: clone(actual) };
    },
  };

  delete require.cache[require.resolve("../js/storage/cloud-permanent-storage-adapter.js")];
  require("../js/storage/cloud-permanent-storage-adapter.js");
  const core = global.InazumaCloudSaveCore;

  const local = core.readLocalSnapshot();
  assert.deepStrictEqual(local.development, legacyDevelopment, "raw snapshot stays synchronous until cryptographic materialization");
  const prepared = await core.prepareSnapshot(local);
  assert.deepStrictEqual(prepared.snapshot.development, indexedDevelopment, "cloud snapshot must materialize Development from IndexedDB authority");
  assert.equal(refreshes, 1);

  const secondLocal = core.readLocalSnapshot();
  const comparison = await core.compareSnapshots(secondLocal, secondLocal);
  assert.equal(comparison.equivalent, true);
  assert.deepStrictEqual(comparison.expected.development, indexedDevelopment);
  assert.deepStrictEqual(comparison.actual.development, indexedDevelopment);
  assert(refreshes >= 3, "both sides of cloud comparison must refresh canonical Development before hashing");

  console.log("cloud-development-indexeddb-adapter-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
