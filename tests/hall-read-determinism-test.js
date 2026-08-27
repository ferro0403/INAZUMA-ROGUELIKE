"use strict";

const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const CloudCore = require("../js/cloud-save-core.js");

class MemoryStorage {
  constructor() { this.map = new Map(); this.writes = 0; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.writes += 1; this.map.set(String(key), String(value)); }
  removeItem(key) { this.writes += 1; this.map.delete(String(key)); }
}

const storage = new MemoryStorage();
const runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js"]);
const beforeWrites = storage.writes;

const archive1 = runtime.HallOfFameStorage._loadArchive();
const archive2 = runtime.HallOfFameStorage._loadArchive();
const archive3 = runtime.HallOfFameStorage._loadArchive();
assert.deepStrictEqual(JSON.parse(JSON.stringify(archive1)), JSON.parse(JSON.stringify(archive2)), "empty Hall read #1/#2 must be identical");
assert.deepStrictEqual(JSON.parse(JSON.stringify(archive2)), JSON.parse(JSON.stringify(archive3)), "empty Hall read #2/#3 must be identical");
assert.strictEqual(archive1.updatedAt, null, "an empty unsaved Hall must not manufacture a timestamp during read");
assert.strictEqual(storage.writes, beforeWrites, "Hall reads must not write localStorage");

const snapshot1 = CloudCore.readLocalSnapshot(runtime);
const snapshot2 = CloudCore.readLocalSnapshot(runtime);
assert.deepStrictEqual(JSON.parse(JSON.stringify(snapshot1.hallOfFame)), JSON.parse(JSON.stringify(snapshot2.hallOfFame)), "cloud local snapshots must see a stable empty Hall");
assert.strictEqual(CloudCore.stableSerialize(CloudCore.hallIndex(snapshot1)), CloudCore.stableSerialize(CloudCore.hallIndex(snapshot2)), "hall_index payload must be deterministic across consecutive reads");
assert.strictEqual(storage.writes, beforeWrites, "cloud snapshot reads must not mutate localStorage");

const champion = {
  archiveKey: "deterministic-run::mode::ie1::final",
  hallTeamId: "hall-deterministic-run",
  runId: "deterministic-run",
  seasonId: "ie1",
  finalBossId: "final",
  teamName: "Deterministic FC",
  finalStartingEleven: [],
  fullRoster: [],
};
const saved = runtime.HallOfFameStorage.addChampion(champion);
assert.strictEqual(saved.persisted, true, "real Hall writes must still persist");
const persistedArchive = runtime.HallOfFameStorage._loadArchive();
assert.ok(typeof persistedArchive.updatedAt === "string" && persistedArchive.updatedAt.length > 0, "a real Hall write must still stamp updatedAt");

console.log("Hall read determinism and cloud snapshot stability: ok");
