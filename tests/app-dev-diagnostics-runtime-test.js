"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/app/dev-diagnostics-runtime.js", "utf8");
assert(source.includes("global.AppDevDiagnosticsRuntime"));
assert(!source.includes("RunState.save("), "diagnostics runtime must not save gameplay state");
assert(!/Firebase|Firestore|CloudSave|CloudRestore/.test(source), "diagnostics runtime must not own cloud persistence");

let run = {
  runId: "run-1",
  seasonId: "ie1",
  phase: "match",
  storageGeneration: 5,
  storageCommitId: "commit-5",
  currentZone: { currentNodeId: "n2", pendingNodeId: "n3" },
  activeMatch: { matchId: "m1", type: "five_v_five", state: "pre-match", simulation: { state: "ready", resolutionApplied: false } },
  permanentEffectOutbox: [{ status: "pending" }, { status: "applied" }],
  lives: 2,
};
let listener = null;
const context = {
  console: { error() {}, info() {} },
  globalThis: null,
  addEventListener(name, fn) { if (name === "DOMContentLoaded") listener = fn; },
  RunState: {
    load() { return { runId: "run-1", storageGeneration: 5, storageCommitId: "commit-5" }; },
    clone(value) { return JSON.parse(JSON.stringify(value)); },
  },
  RunStorage: {
    diagnostics() { return { bytes: 100, totalKnownBytes: 200, canonicalGeneration: 5, canonicalCommitId: "commit-5", canonicalRunId: "run-1", headGeneration: 5, backupGeneration: 4, headMatchesCanonical: true }; },
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "app-dev-diagnostics-runtime.js" });

const runtime = context.AppDevDiagnosticsRuntime.create({
  devMode: true,
  getRun: () => run,
  getUi: () => ({ match: run.activeMatch }),
  getActiveSeason: () => ({ id: "ie1" }),
});

assert.strictEqual(runtime.repairResultMessage({ blocker: "blocked" }), "Riparazione non applicata: blocked");
assert.strictEqual(runtime.repairResultMessage({ repaired: true }), "Riparazione salvataggio completata. Report copiato.");
assert.strictEqual(runtime.repairResultMessage({ repaired: false }), "Nessuna modifica necessaria. Report copiato.");
assert.strictEqual(runtime.mountPersistenceTools(), true);
assert.strictEqual(typeof listener, "function");

const entry = runtime.recordGameplayFailure("five-match", "persistence", Object.assign(new Error("quota"), { code: "quota" }), "save");
assert.strictEqual(entry.runId, "run-1");
assert.strictEqual(entry.generation.memory, 5);
assert.strictEqual(entry.match.matchId, "m1");
assert.strictEqual(entry.storage.headMatchesCanonical, true);

const diagnostics = runtime.matchDiagnostics();
assert.strictEqual(diagnostics.matchId, "m1");
assert.strictEqual(diagnostics.permanentEffects.pending, 1);
assert.strictEqual(diagnostics.permanentEffects.applied, 1);
assert.strictEqual(runtime.installGlobals(), true);
assert.strictEqual(context.__INAZUMA_MATCH_DIAGNOSTICS__().matchId, "m1");
assert.strictEqual(context.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__().length, 1);

run = { runId: "run-2", seasonId: "ie1", phase: "map", permanentEffectOutbox: [] };
assert.strictEqual(context.__INAZUMA_MATCH_DIAGNOSTICS__().runId, "run-2", "diagnostics must read the live run");

const productionRuntime = context.AppDevDiagnosticsRuntime.create({ devMode: false, getRun: () => run });
assert.strictEqual(productionRuntime.mountPersistenceTools(), false);
assert.strictEqual(productionRuntime.recordGameplayFailure("x", "y", new Error("z")), null);
assert.strictEqual(productionRuntime.installGlobals(), false);

console.log("app-dev-diagnostics-runtime-test: PASS");
