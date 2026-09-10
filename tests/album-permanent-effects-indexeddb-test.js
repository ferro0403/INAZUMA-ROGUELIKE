"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function makeContext() {
  const runs = new Map();
  const writes = [];
  const appliedUnlocks = [];
  const listeners = new Map();
  let failMarkerOnce = false;

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
    addEventListener(type, listener) {
      const values = listeners.get(type) || [];
      values.push(listener);
      listeners.set(type, values);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
    },
    SeasonRegistry: { list: () => [{ id: "ie1" }] },
    AlbumIndexedDbStorage: {
      isAuthority: () => true,
      async applyUnlock(collectionId, playerId, metadata) {
        appliedUnlocks.push({ collectionId, playerId, metadata });
        return appliedUnlocks.filter((entry) => entry.playerId === playerId).length === 1;
      },
    },
  };

  context.RunState = {
    load(seasonId) { return clone(runs.get(String(seasonId)) || null); },
    save(run, options = {}) {
      if (options.source === "album-indexeddb-effect-marker" && failMarkerOnce) {
        failMarkerOnce = false;
        throw Object.assign(new Error("stale"), { code: "stale-write" });
      }
      const next = clone(run);
      next.storageGeneration = Number(next.storageGeneration || 0) + 1;
      runs.set(String(next.seasonId), next);
      Object.assign(run, clone(next));
      writes.push({ run: clone(next), options: clone(options) });
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
  return {
    context,
    runs,
    writes,
    appliedUnlocks,
    baseDrainCalls,
    failNextMarker() { failMarkerOnce = true; },
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
    assert(runtime.writes.some((entry) => entry.options.source === "album-indexeddb-effect-marker"), "receipt marker must use canonical RunState save");
  }

  {
    const runtime = makeContext();
    runtime.failNextMarker();
    await runtime.context.AlbumPermanentEffects.requestDrain("ie1");
    assert.strictEqual(runtime.context.RunState.load("ie1").permanentEffectOutbox[0].status, "applied", "stale marker save must reload canonical run and retry");
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
    assert.doesNotThrow(() => runtime.context.RunState.save(replacement, { replaceRun: true }));
  }

  console.log("album-permanent-effects-indexeddb-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
