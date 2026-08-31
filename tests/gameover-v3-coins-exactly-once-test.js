"use strict";

const assert = require("assert");
const progression = require("../js/roguelike_progression.js");
global.InazumaProgression = progression;
const V2 = require("../js/development-v2.js");
const V3 = require("../js/development-v3.js");
const Migration = require("../js/development-v3-migration.js");
const Runtime = require("../js/development-runtime.js");
const Account = require("../js/development-account-v3.js");
require("../js/permanent-effects.js");
require("../js/gameplay-persistence.js");
const PermanentEffects = global.PermanentEffects;
const GameplayPersistence = global.GameplayPersistence;
const database = require("../data/FREE_AGENTS_compact.json");

Runtime.registerDatabase("free-agents", database);
class Storage {
  constructor(value = null) { this.value = value; }
  getItem() { return this.value; }
  setItem(_key, value) { this.value = String(value); }
  removeItem() { this.value = null; }
}
const previous = { localStorage: global.localStorage, guard: global.PersistenceRecoveryGuard, dispatchEvent: global.dispatchEvent, CustomEvent: global.CustomEvent };
const storage = new Storage(JSON.stringify({ ...V2.empty(), coins: 125 }));
global.localStorage = storage;
global.PersistenceRecoveryGuard = { reserve() {}, assertWritable() {}, isBlocked: () => false };
global.dispatchEvent = () => {};
global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
const options = { DevelopmentV2: V2, DevelopmentV3: V3, DevelopmentV3Migration: Migration, progression, database, resolveBasePlayer: id => Runtime.resolveBasePlayer(id) };
const account = { processRunEnd: payload => Account.processRunEnd(payload, options), read: () => Account.read(options) };

try {
  Account.resetSessionCache(); assert(Account.ensureMigrated(options).ok);
  const beforeCoins = Account.read(options).coins;
  const defeatedBosses = 3;
  const expectedReward = defeatedBosses * 20; // Current DevelopmentAccountV3 game-over formula (no victory bonus).
  let canonical = { runId: "v3-last-life", seasonId: "ie1", lives: 0, gameOver: true, phase: "gameover", completedBossIds: ["b1", "b2", "b3"], permanentEffectOutbox: [] };
  let runtime = structuredClone(canonical), failEnqueue = true;
  const persist = GameplayPersistence.create({
    getRun: () => runtime, replaceRun: next => { runtime = next; },
    save: next => { if (failEnqueue) throw new Error("injected enqueue failure"); canonical = structuredClone(next); },
    load: () => structuredClone(canonical),
  });
  const enqueue = () => persist({ mutate: current => PermanentEffects.enqueueDevelopment(current, { endReason: "gameover", defeatedBosses }) });

  const failed = enqueue();
  assert.strictEqual(failed.ok, false); assert.strictEqual(runtime.permanentEffectOutbox.length, 0, "legacy terminal intent is not falsely resolved");
  assert.strictEqual(Account.read(options).coins, beforeCoins, "failed enqueue cannot award coins");

  failEnqueue = false; assert.strictEqual(enqueue().ok, true); assert.strictEqual(runtime.permanentEffectOutbox.length, 1);
  let drained = PermanentEffects.drain(runtime, { apis: { DevelopmentAccountV3: account }, save: next => { canonical = structuredClone(next); } });
  assert.ifError(drained.error); assert.strictEqual(Account.read(options).coins, beforeCoins + expectedReward);
  assert.strictEqual(Account.read(options).redeemedRunIds.filter(id => id === runtime.runId).length, 1);
  assert.strictEqual(runtime.permanentEffectOutbox[0].status, "applied");

  for (let reopen = 0; reopen < 10; reopen += 1) {
    runtime = structuredClone(canonical);
    PermanentEffects.enqueueDevelopment(runtime, { endReason: "gameover", defeatedBosses });
    drained = PermanentEffects.drain(runtime, { apis: { DevelopmentAccountV3: account }, save: next => { canonical = structuredClone(next); } });
    assert.ifError(drained.error); assert.strictEqual(Account.read(options).coins, beforeCoins + expectedReward);
  }
  assert.strictEqual(Account.read(options).redeemedRunIds.filter(id => id === runtime.runId).length, 1);
  assert.strictEqual(runtime.permanentEffectOutbox.filter(effect => effect.type === "development-run-end").length, 1);
} finally {
  Object.assign(global, previous); Account.resetSessionCache();
}

console.log("gameover Development V3 coins: positive payout, legacy enqueue retry and ten reopen drains exactly once OK");
