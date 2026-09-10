"use strict";

const assert = require("assert");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

class LocalStorage {
  constructor() { this.map = new Map(); this.writes = 0; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); this.writes += 1; }
  removeItem(key) { this.map.delete(String(key)); }
}

class MemoryDb {
  constructor() {
    this.stores = { meta: new Map(), album: new Map(), hall: new Map(), development: new Map() };
    this.queue = Promise.resolve();
    this.failNextUpdate = false;
  }
  async read(store, key = "state") { return clone(this.stores[store].get(String(key))); }
  async write(store, value, key = "state") { this.stores[store].set(String(key), clone(value)); return clone(value); }
  update(store, updater, key = "state") {
    const task = this.queue.then(async () => {
      if (this.failNextUpdate) { this.failNextUpdate = false; throw Object.assign(new Error("simulated indexeddb failure"), { code: "indexeddb-transaction-aborted" }); }
      const current = clone(this.stores[store].get(String(key)));
      const next = updater(current);
      if (next && typeof next.then === "function") throw new Error("test updater must be synchronous");
      this.stores[store].set(String(key), clone(next));
      return clone(next);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}

(async () => {
  const storage = new LocalStorage();
  const db = new MemoryDb();
  let reserves = 0;
  let failMarkerOnce = false;
  let savedRun = null;
  const events = [];

  global.localStorage = storage;
  global.PermanentIndexedDb = db;
  global.PersistenceRecoveryGuard = {
    EPOCH_KEY: "inazuma.persistence.localMutationEpoch",
    isBlocked: () => false,
    assertWritable: () => true,
    reserve: () => { reserves += 1; return reserves; },
  };
  global.CustomEvent = class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
  global.dispatchEvent = (event) => events.push(event);
  global.addEventListener = () => {};
  global.RunState = {
    save(run, options = {}) {
      if (failMarkerOnce && options.effectMarker) { failMarkerOnce = false; throw Object.assign(new Error("run marker failed"), { code: "write-failed" }); }
      savedRun = clone(run);
      return run;
    },
    load(seasonId) { return savedRun?.seasonId === seasonId ? clone(savedRun) : null; },
    remove() { savedRun = null; return true; },
  };

  const progression = require("../js/roguelike_progression.js");
  global.InazumaProgression = progression;
  const V2 = require("../js/development-v2.js");
  const V3 = require("../js/development-v3.js");
  const Migration = require("../js/development-v3-migration.js");
  const Runtime = require("../js/development-runtime.js");
  const Account = require("../js/development-account-v3.js");
  const database = require("../data/FREE_AGENTS_compact.json");
  Runtime.registerDatabase("free-agents", database);
  require("../js/permanent-effects.js");

  const options = { DevelopmentV2: V2, DevelopmentV3: V3, DevelopmentV3Migration: Migration, progression, database, resolveBasePlayer: Runtime.resolveBasePlayer };
  const canonical = V3.empty();
  canonical.coins = 999;
  const legacyEnvelope = Account.envelopeFor(canonical, options);
  const originalLegacyRaw = JSON.stringify(legacyEnvelope);
  storage.setItem(V2.STORAGE_KEY, originalLegacyRaw);
  const writesBeforeMigration = storage.writes;

  const DevelopmentStorage = require("../js/storage/development-indexeddb.js");
  const ready = await DevelopmentStorage.ensureReady(options);
  assert.equal(ready.authority, "indexeddb");
  assert.equal(ready.migrated, true);
  assert.equal(storage.getItem(V2.STORAGE_KEY), originalLegacyRaw, "cutover must preserve canonical legacy bytes as rollback evidence");
  assert.equal(storage.writes, writesBeforeMigration, "already-canonical V3 legacy state must not be rewritten during IDB cutover");
  assert.equal((await db.read("meta", DevelopmentStorage.MIGRATION_KEY)).complete, true);
  assert.equal(Account.read().coins, 999);
  assert.throws(() => V2.write(V2.empty()), (error) => error.code === "development-indexeddb-async-required", "post-cutover V2 writes must fail closed instead of dual-writing localStorage");

  const setState = async (mutate) => {
    const state = V3.empty();
    mutate(state);
    await Account.commitAsync(state, options);
    return state;
  };

  await setState((state) => { state.coins = 300; });
  const projectResults = await Promise.all([Account.purchaseProjectAsync("Buono"), Account.purchaseProjectAsync("Buono")]);
  assert.equal(projectResults.filter((result) => result.ok).length, 1, "two concurrent project purchases cannot spend the same balance");
  assert.equal(projectResults.filter((result) => result.reason === "coins").length, 1);
  assert.equal(Account.read().coins, 50);
  assert.equal(Account.read().projects.Buono, 1);

  await setState((state) => { state.coins = 500; state.cupsBySeason.ie1 = 2; });
  const emblem = { emblemId: "indexeddb-test-emblem", coins: 200, cups: 1, seasonId: "ie1" };
  const emblemResults = await Promise.all([Account.purchaseEmblemAsync(emblem), Account.purchaseEmblemAsync(emblem)]);
  assert.equal(emblemResults.filter((result) => result.ok).length, 1, "same emblem can be purchased only once across concurrent requests");
  assert.equal(Account.read().coins, 300);
  assert.equal(Account.read().cupsBySeason.ie1, 1);
  assert.deepStrictEqual(Account.read().unlockedEmblems, [emblem.emblemId]);

  await setState(() => {});
  const rewardPayload = { runId: "same-run", seasonId: "ie1", defeatedBosses: 2, endReason: "victory" };
  const rewardResults = await Promise.all([Account.processRunEndAsync(rewardPayload), Account.processRunEndAsync(rewardPayload)]);
  assert.equal(rewardResults.filter((result) => result.awarded).length, 1, "redeemedRunIds must make concurrent terminal rewards exactly-once");
  assert.equal(Account.read().coins, 140);
  assert.equal(Account.read().cupsBySeason.ie1, 1);
  assert.deepStrictEqual(Account.read().redeemedRunIds, [rewardPayload.runId]);

  const basePlayer = database.players.find((player) => player.category === "Normale");
  assert(basePlayer, "fixture requires one Normale free agent");
  await setState((state) => { state.coins = 1000; state.cupsBySeason.ie1 = 5; state.projects.Buono = 2; state.projects.Forte = 2; });
  const evolutionInput = { playerId: String(basePlayer.playerId), basePlayer, unlocked: true, freeAgentEligible: true, cupSelection: { ie1: 1 } };
  const evolutionResults = await Promise.all([
    Account.evolveAsync(evolutionInput, { ...options, timestamp: "2026-09-10T12:00:00.000Z" }),
    Account.evolveAsync(evolutionInput, { ...options, timestamp: "2026-09-10T12:00:00.001Z" }),
  ]);
  assert.equal(evolutionResults.filter((result) => result.ok).length, 1, "two stale tabs must not advance one player through two rarity steps");
  assert.equal(evolutionResults.filter((result) => result.reason === "stale-evolution").length, 1);
  const evolved = Account.read().players[String(basePlayer.playerId)];
  assert.equal(evolved.steps.length, 1);
  assert.equal(evolved.steps[0].rarity, "Buono");

  await setState((state) => { state.coins = 500; });
  const beforeFailure = clone(Account.read());
  db.failNextUpdate = true;
  const failedPurchase = await Account.purchaseProjectAsync("Buono");
  assert.equal(failedPurchase.ok, false);
  assert.equal(failedPurchase.reason, "persistence");
  assert.deepStrictEqual(Account.read(), beforeFailure, "failed IDB transaction must not advance the in-memory canonical account");

  await setState(() => {});
  const run = { runId: "marker-crash", seasonId: "ie1", phase: "gameover", gameOver: true, bossIndex: 2, completedBossIds: ["a", "b"], permanentEffectOutbox: [] };
  global.PermanentEffects.enqueueDevelopment(run, { endReason: "gameover", defeatedBosses: 2 });
  savedRun = clone(run);
  failMarkerOnce = true;
  const firstDrain = await global.PermanentEffects.drain(run, { types: [global.PermanentEffects.TYPES.DEVELOPMENT] });
  assert(firstDrain.error, "simulated crash after permanent commit must surface as resumable");
  assert.equal(run.permanentEffectOutbox[0].status, "pending", "run receipt must roll back when its marker save fails");
  assert.equal(Account.read().coins, 40, "permanent reward may already be committed once");
  assert(Account.read().redeemedRunIds.includes(run.runId));
  const secondDrain = await global.PermanentEffects.drain(run, { types: [global.PermanentEffects.TYPES.DEVELOPMENT] });
  assert.equal(secondDrain.error, undefined);
  assert.equal(run.permanentEffectOutbox[0].status, "applied");
  assert.equal(Account.read().coins, 40, "retry after marker failure must not credit the run twice");

  assert(events.some((event) => event.detail?.sector === "development" && event.detail?.domain === "account-permanent"), "durable Development commits must keep cloud dirty-sector notification semantics");
  assert(reserves > 0, "durable Development mutations must participate in RecoveryGuard mutation fencing");

  console.log("development-indexeddb-cutover-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
