"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function memoryDb(options = {}) {
  const stores = { meta: new Map(), album: new Map(), hall: new Map(), development: new Map() };
  return {
    stores,
    async read(store, key = "state") { return clone(stores[store].get(String(key))); },
    async write(store, value, key = "state") { if (options.failWrite) throw options.failWrite; stores[store].set(String(key), clone(value)); return clone(value); },
    async update(store, updater, key = "state") { if (options.failUpdate) throw options.failUpdate; const next = updater(clone(stores[store].get(String(key)))); stores[store].set(String(key), clone(next)); return clone(next); },
  };
}

function championSnapshot() {
  const player = { playerId: "p1", name: "Player", finalOverall: 85, recruitedOverall: 70 };
  return { hallTeamId: "hall-1", archiveKey: "run-1::roguelike::ie1::raimon", runId: "run-1", seasonId: "ie1", finalBossId: "raimon", teamName: "Champions", victoryDate: "2026-09-10T00:00:00.000Z", finalStartingEleven: [player], fullRoster: [player], bench: [], runStatistics: {}, playerStatistics: {}, awards: [] };
}

function makeContext({ failMarkerOnce = false, failHall = false } = {}) {
  const local = new Map([["inazuma.hallOfFame.v1", JSON.stringify({ schemaVersion: 3, updatedAt: null, teams: [], index: [] })]]);
  const db = memoryDb({ failUpdate: failHall ? Object.assign(new Error("quota"), { name: "QuotaExceededError", code: "storage-quota-exceeded" }) : null });
  let markerFailure = failMarkerOnce;
  const writes = [];
  const run = {
    seasonId: "ie1",
    runId: "run-1",
    storageGeneration: 1,
    phase: "finalization",
    finalization: { status: "pending", hallTeamId: null },
    permanentEffectOutbox: [{ id: "run-1:hall:ie1", type: "hall-champion", payload: { archiveKey: championSnapshot().archiveKey, snapshot: championSnapshot() }, status: "pending", createdAt: "2026-09-10T00:00:00.000Z", appliedAt: null }],
  };
  const context = {
    globalThis: null, window: null, console, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise, Error, TypeError, Set, Map,
    localStorage: { getItem: (k) => local.get(String(k)) ?? null, setItem: (k,v) => local.set(String(k), String(v)), removeItem: (k) => local.delete(String(k)) },
    addEventListener() {}, dispatchEvent() {}, CustomEvent: class {},
    PermanentIndexedDb: db,
    PersistenceRecoveryGuard: { EPOCH_KEY: "epoch", isBlocked: () => false, assertWritable: () => true, reserve: () => 1 },
    RunState: {
      save(current, options = {}) {
        if (options.source === "hall-indexeddb-effect-marker" && markerFailure) { markerFailure = false; throw Object.assign(new Error("stale"), { code: "stale-write" }); }
        writes.push({ options: clone(options), run: clone(current) });
        return current;
      },
    },
    PermanentEffects: Object.freeze({
      TYPES: { HALL: "hall-champion", DEVELOPMENT: "development-run-end" },
      resumeFinalization(current) {
        assert.strictEqual(current.finalization.status, "hall-written", "legacy continuation must only run after durable Hall commit");
        current.finalization.status = "complete";
        current.phase = "final-celebration";
        return { run: current, status: "complete", completed: true };
      },
    }),
  };
  context.globalThis = context; context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/hall-of-fame.js", "utf8"), context, { filename: "js/hall-of-fame.js" });
  return { context, run, db, writes, local };
}

(async function main() {
  {
    const h = makeContext();
    const ready = await h.context.HallOfFameStorage.ensureIndexedDbReady();
    assert.strictEqual(ready.authority, "indexeddb");
    const result = await h.context.PermanentEffects.resumeFinalization(h.run);
    assert.strictEqual(result.completed, true);
    assert.strictEqual(h.run.finalization.status, "complete");
    assert.strictEqual(h.run.permanentEffectOutbox[0].status, "applied");
    assert.strictEqual(h.run.hallTeamId, "hall-1");
    assert(h.context.HallOfFameStorage.getTeam("hall-1"), "champion must be durable before finalization advances");
    assert(h.writes.some((entry) => entry.options.source === "hall-indexeddb-effect-marker"));
  }

  {
    const h = makeContext({ failMarkerOnce: true });
    await h.context.HallOfFameStorage.ensureIndexedDbReady();
    const first = await h.context.PermanentEffects.resumeFinalization(h.run);
    assert.strictEqual(first.completed, false, "run marker failure must keep finalization pending");
    assert.strictEqual(h.run.permanentEffectOutbox[0].status, "pending");
    assert(h.context.HallOfFameStorage.getTeam("hall-1"), "Hall commit may survive marker failure and must be retry-safe");
    const second = await h.context.PermanentEffects.resumeFinalization(h.run);
    assert.strictEqual(second.completed, true);
    assert.strictEqual(h.context.HallOfFameStorage._loadArchive().teams.filter((entry) => entry.archiveKey === championSnapshot().archiveKey).length, 1, "retry must not duplicate champion");
  }

  {
    const h = makeContext({ failHall: true });
    await h.context.HallOfFameStorage.ensureIndexedDbReady();
    const result = await h.context.PermanentEffects.resumeFinalization(h.run);
    assert.strictEqual(result.completed, false);
    assert.strictEqual(h.run.finalization.status, "pending");
    assert.strictEqual(h.run.permanentEffectOutbox[0].status, "pending");
  }

  {
    const h = makeContext();
    await h.context.HallOfFameStorage.ensureIndexedDbReady();
    h.context.RestoreGameplayRoutingGate = { enter: () => true };
    h.context.document = { getElementById: () => ({ disabled: false }) };
    vm.runInContext(fs.readFileSync("js/finalization/finalization-controller.js", "utf8"), h.context, { filename: "js/finalization/finalization-controller.js" });
    let pendingRendered = false;
    const controller = h.context.FinalizationController.create({
      getRun: () => h.run,
      recoverCanonicalRun() {},
      toast() {},
      resolveDevelopment: () => ({ resolved: true }),
      championTeam: () => h.context.HallOfFameStorage.getTeam("hall-1"),
      renderHome: () => null,
      persistMutation: () => ({ ok: true }),
      view: { renderPending() { pendingRendered = true; }, renderCelebration() {}, renderSummary() {} },
    });
    const result = await controller.resume({ render: false });
    assert.strictEqual(result.completed, true, "finalization controller must await async Hall persistence");
    assert.strictEqual(pendingRendered, false);
  }

  console.log("hall-finalization-indexeddb-test: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
