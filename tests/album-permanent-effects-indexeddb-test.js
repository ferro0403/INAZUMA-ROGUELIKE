"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function staleError() {
  return Object.assign(new Error("stale"), { code: "stale-write" });
}

function makeContext() {
  const runs = new Map();
  const writes = [];
  const appliedUnlocks = [];
  const listeners = new Map();
  let failMarkerOnce = false;
  let failUnlockOnce = false;
  let activeRun = null;

  const initial = {
    seasonId: "ie1",
    runId: "run-1",
    storageGeneration: 1,
    permanentEffectOutbox: [{
      id: "run-1:album:pull:p1:a1",
      type: "album-unlock",
      payload: { collectionId: "ie1", playerId: "p1", source: "pull", actionId: "a1" },
      status: "pending",
      createdAt: "2026-09-10T00:00:00.000Z",
      appliedAt: null,
    }],
  };
  runs.set("ie1", clone(initial));

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
    CustomEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    addEventListener(type, listener) {
      const values = listeners.get(type) || [];
      values.push(listener);
      listeners.set(type, values);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
      return true;
    },
    SeasonRegistry: { list: () => [{ id: "ie1" }] },
    AlbumIndexedDbStorage: {
      isAuthority: () => true,
      async applyUnlock(collectionId, playerId, metadata) {
        if (failUnlockOnce) {
          failUnlockOnce = false;
          throw Object.assign(new Error("album transaction aborted"), { code: "indexeddb-transaction-aborted" });
        }
        appliedUnlocks.push({ collectionId, playerId, metadata });
        return appliedUnlocks.filter((entry) => entry.playerId === playerId).length === 1;
      },
    },
  };

  context.RunState = {
    load(seasonId) {
      return clone(runs.get(String(seasonId)) || null);
    },
    save(run, options = {}) {
      if (options.source === "album-indexeddb-effect-marker" && failMarkerOnce) {
        failMarkerOnce = false;
        throw staleError();
      }
      const sid = String(run.seasonId);
      const current = runs.get(sid) || null;
      const currentGeneration = Number(current?.storageGeneration || 0);
      const expectedGeneration = Number(run.storageGeneration || 0);
      if (expectedGeneration !== currentGeneration) throw staleError();

      const next = clone(run);
      next.storageGeneration = currentGeneration + 1;
      runs.set(sid, next);
      Object.assign(run, clone(next));
      writes.push({ run: clone(next), options: clone(options) });

      if (!options.suppressCloudEvent) {
        context.dispatchEvent(new context.CustomEvent("inazuma:local-save-committed", {
          detail: {
            domain: "run",
            sector: "run_ie1",
            seasonId: sid,
            operation: "write",
            source: options.source || "gameplay",
          },
        }));
      }
      return run;
    },
    remove(seasonId) {
      runs.delete(String(seasonId));
      return { deleted: true };
    },
  };

  const baseDrainCalls = [];
  context.PermanentEffects = Object.freeze({
    TYPES: { ALBUM: "album-unlock", DEVELOPMENT: "development-run-end", HALL: "hall-champion" },
    drain(run, options = {}) {
      baseDrainCalls.push({ options: clone(options) });
      const allowed = options.types ? new Set(options.types) : null;
      for (const effect of run.permanentEffectOutbox || []) {
        if (effect.status !== "pending" || (allowed && !allowed.has(effect.type))) continue;
        if (effect.type === "album-unlock") throw new Error("base drain must never apply Album after IndexedDB cutover");
      }
      return { run, applied: [], pending: (run.permanentEffectOutbox || []).filter((entry) => entry.status === "pending") };
    },
    resume() {},
    resumeFinalization() {},
  });

  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/storage/album-permanent-effects.js", "utf8"), context, { filename: "js/storage/album-permanent-effects.js" });
  vm.runInContext(fs.readFileSync("js/gameplay-persistence.js", "utf8"), context, { filename: "js/gameplay-persistence.js" });
  context.AlbumPermanentEffects.bindRuntimeRunAccessor(() => activeRun);

  return {
    context,
    runs,
    writes,
    appliedUnlocks,
    baseDrainCalls,
    setActiveRun(run) { activeRun = run; },
    getActiveRun() { return activeRun; },
    failNextMarker() { failMarkerOnce = true; },
    failNextUnlock() { failUnlockOnce = true; },
  };
}

(async function main() {
  {
    const runtime = makeContext();
    const inMemoryRun = runtime.context.RunState.load("ie1", { readOnly: true });
    const syncResult = runtime.context.PermanentEffects.drain(inMemoryRun);
    assert(syncResult.pending.some((entry) => entry.type === "album-unlock"), "sync drain must leave Album receipt pending until IndexedDB commit");
    assert(runtime.baseDrainCalls.every((call) => !(call.options.types || []).includes("album-unlock")), "legacy Album writer must be excluded after cutover");

    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");
    const saved = runtime.context.RunState.load("ie1", { readOnly: true });
    assert.strictEqual(saved.permanentEffectOutbox[0].status, "applied", "receipt must be marked only after IndexedDB unlock succeeds");
    assert.strictEqual(runtime.appliedUnlocks.length >= 1, true);
    const markerWrite = runtime.writes.find((entry) => entry.options.source === "album-indexeddb-effect-marker");
    assert(markerWrite, "receipt marker must use canonical RunState save");
    assert.strictEqual(markerWrite.options.suppressCloudEvent, true, "Album marker saves must not recursively emit another run-committed event");
  }

  {
    const runtime = makeContext();
    let active = runtime.context.RunState.load("ie1", { readOnly: true });
    runtime.setActiveRun(active);
    let persistenceFailures = 0;
    const persistGameplayMutation = runtime.context.GameplayPersistence.create({
      save: (current, options) => runtime.context.RunState.save(current, options),
      load: (seasonId, options) => runtime.context.RunState.load(seasonId, options),
      getRun: () => active,
      replaceRun: (next) => {
        active = next;
        runtime.setActiveRun(next);
      },
      reportFailure: () => { persistenceFailures += 1; },
    });

    const pullCommit = persistGameplayMutation({
      label: "pull-recruit",
      mutate: (current) => { current.lastGameplayAction = "pull-recruit"; },
    });
    assert.strictEqual(pullCommit.ok, true, "the gameplay commit that wakes the Album drain must succeed");

    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");
    const canonicalAfterDrain = runtime.context.RunState.load("ie1", { readOnly: true });
    assert.strictEqual(active.storageGeneration, canonicalAfterDrain.storageGeneration, "Album marker must advance the live run generation together with canonical storage");
    assert.strictEqual(active.permanentEffectOutbox[0].status, "applied", "the live run must receive the applied Album marker");

    const nextNodeCommit = persistGameplayMutation({
      label: "map-node-select",
      mutate: (current) => { current.lastGameplayAction = "map-node-select"; },
    });
    assert.strictEqual(nextNodeCommit.ok, true, "the first gameplay action after an Album drain must not fail stale");
    assert.strictEqual(persistenceFailures, 0, "same-tab Album draining must never route gameplay into persistence recovery");
  }

  {
    const runtime = makeContext();
    const stored = runtime.runs.get("ie1");
    stored.permanentEffectOutbox.push({
      id: "run-1:album:pull:p2:a2",
      type: "album-unlock",
      payload: { collectionId: "ie1", playerId: "p2", source: "pull", actionId: "a2" },
      status: "pending",
      createdAt: "2026-09-10T00:00:01.000Z",
      appliedAt: null,
    });
    runtime.runs.set("ie1", clone(stored));

    const active = runtime.context.RunState.load("ie1", { readOnly: true });
    runtime.setActiveRun(active);
    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");

    const canonical = runtime.context.RunState.load("ie1", { readOnly: true });
    assert.strictEqual(canonical.permanentEffectOutbox.filter((entry) => entry.status === "applied").length, 2, "all pending Album receipts must drain");
    assert.strictEqual(active.storageGeneration, canonical.storageGeneration, "multiple marker commits must keep the live generation aligned");
    assert.strictEqual(active.permanentEffectOutbox.filter((entry) => entry.status === "applied").length, 2, "the live run must stay aligned across multiple receipts");
    assert.doesNotThrow(() => runtime.context.RunState.save(active, { source: "next-gameplay-action" }), "multiple Album receipts must not poison the next gameplay save");
  }

  {
    const runtime = makeContext();
    const active = runtime.context.RunState.load("ie1", { readOnly: true });
    runtime.setActiveRun(active);
    runtime.failNextMarker();
    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");
    assert.strictEqual(runtime.context.RunState.load("ie1").permanentEffectOutbox[0].status, "applied", "stale marker save must reload canonical run and retry");
    assert.strictEqual(active.permanentEffectOutbox[0].status, "applied", "failed marker attempts must leave the live run untouched until a retry commits and synchronizes it");
    assert.strictEqual(active.storageGeneration, runtime.context.RunState.load("ie1").storageGeneration, "retry must leave the active run on the committed generation");
  }

  {
    const runtime = makeContext();
    const active = runtime.context.RunState.load("ie1", { readOnly: true });
    runtime.setActiveRun(active);

    const otherTab = runtime.context.RunState.load("ie1", { readOnly: true });
    otherTab.otherTabChange = true;
    runtime.context.RunState.save(otherTab, { source: "other-tab", suppressCloudEvent: true });
    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");

    assert.strictEqual(active.storageGeneration, 1, "a genuinely stale tab must not be silently advanced by the Album bridge");
    assert.strictEqual(active.permanentEffectOutbox[0].status, "pending", "a stale tab must keep its old in-memory receipt until normal stale recovery");
    assert.throws(
      () => runtime.context.RunState.save(active, { source: "stale-tab-gameplay" }),
      (error) => error.code === "stale-write",
      "real cross-tab stale writes must remain fenced",
    );
  }

  {
    const runtime = makeContext();
    const active = runtime.context.RunState.load("ie1", { readOnly: true });
    runtime.setActiveRun(active);
    runtime.failNextUnlock();

    await assert.rejects(
      runtime.context.AlbumPermanentEffects.requestDrain("ie1"),
      (error) => error.code === "indexeddb-transaction-aborted",
      "IndexedDB failure must surface to the drain caller",
    );
    assert.strictEqual(runtime.context.RunState.load("ie1").permanentEffectOutbox[0].status, "pending", "failed IndexedDB write must not mark the canonical receipt");
    assert.strictEqual(active.permanentEffectOutbox[0].status, "pending", "failed IndexedDB write must not mutate the live receipt");
    assert.strictEqual(active.storageGeneration, 1, "failed IndexedDB write must not advance the live generation");

    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");
    assert.strictEqual(active.permanentEffectOutbox[0].status, "applied", "the same receipt must remain retryable after IndexedDB recovers");
  }

  {
    const runtime = makeContext();
    const replacement = { seasonId: "ie1", runId: "run-2", storageGeneration: 1, permanentEffectOutbox: [] };
    assert.throws(
      () => runtime.context.RunState.save(replacement, { replaceRun: true }),
      (error) => error.code === "album-permanent-effect-pending",
      "new run replacement must not discard a pending permanent Album receipt",
    );
    assert.throws(
      () => runtime.context.RunState.remove("ie1", { expectedGeneration: 1 }),
      (error) => error.code === "album-permanent-effect-pending",
      "manual run deletion must not discard a pending permanent Album receipt",
    );
    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");
    replacement.storageGeneration = runtime.context.RunState.load("ie1").storageGeneration;
    assert.doesNotThrow(() => runtime.context.RunState.save(replacement, { replaceRun: true }));
  }

  {
    const appSource = fs.readFileSync("js/app.js", "utf8");
    assert(
      appSource.includes("global.AlbumPermanentEffects?.bindRuntimeRunAccessor?.(() => run);"),
      "browser composition must bind the Album bridge to the actual live run closure",
    );
  }

  console.log("album-permanent-effects-indexeddb-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
