"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/app/dev-diagnostics.js", "utf8");
assert(source.includes("global.AppDevDiagnostics"));
assert(!source.includes("RunState.save("), "dev diagnostics must not own gameplay saves");
assert(!/Firebase|Firestore|CloudSave|CloudRestore/.test(source), "dev diagnostics must not own cloud persistence");
assert(source.includes("{ readOnly: true }"));

let domReady = null;
const errors = [];
let currentRun = {
  runId: "run-1",
  seasonId: "ie1",
  phase: "match",
  storageGeneration: 4,
  storageCommitId: "c4",
  currentZone: { currentNodeId: "n1", pendingNodeId: "n2" },
  activeMatch: {
    matchId: "m1",
    type: "five_v_five",
    state: "pre-match",
    simulation: { state: "ready", resolutionApplied: false, revealedCount: 0, timeline: [] },
  },
  permanentEffectOutbox: [{ status: "pending" }, { status: "applied" }, { status: "applied" }],
};
const context = {
  globalThis: null,
  console: { error: (...args) => errors.push(args), info() {} },
  Date,
  Map,
  setTimeout,
  addEventListener(type, handler) { if (type === "DOMContentLoaded") domReady = handler; },
  RunState: {
    load(seasonId, options) {
      assert.strictEqual(seasonId, "ie1");
      assert.strictEqual(options.readOnly, true);
      return { runId: "run-1", storageGeneration: 5, storageCommitId: "c5" };
    },
    clone(value) { return JSON.parse(JSON.stringify(value)); },
  },
  RunStorage: {
    diagnostics() {
      return { bytes: 100, totalKnownBytes: 300, canonicalGeneration: 5, canonicalCommitId: "c5", canonicalRunId: "run-1", headGeneration: 5, backupGeneration: 4, headMatchesCanonical: true };
    },
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "dev-diagnostics.js" });

const disabled = context.AppDevDiagnostics.create({ devMode: false, getRun: () => currentRun, getUi: () => ({ match: null }) });
assert.strictEqual(disabled.recordGameplayFailure("x", "persistence", new Error("x")), null);
assert.strictEqual(disabled.installPersistenceTools(), false);
assert.strictEqual(disabled.installGlobalDiagnostics(), false);

const runtime = context.AppDevDiagnostics.create({
  devMode: true,
  getRun: () => currentRun,
  getUi: () => ({ match: currentRun?.activeMatch || null }),
  getActiveSeason: () => ({ id: "ie1" }),
});
assert.strictEqual(runtime.repairResultMessage({ blocker: "guard" }), "Riparazione non applicata: guard");
assert.strictEqual(runtime.repairResultMessage({ repaired: true }), "Riparazione salvataggio completata. Report copiato.");
assert.strictEqual(runtime.repairResultMessage({ repaired: false }), "Nessuna modifica necessaria. Report copiato.");
assert.strictEqual(runtime.installPersistenceTools(), true);
assert.strictEqual(typeof domReady, "function", "DEV tools must keep DOMContentLoaded registration");
assert.strictEqual(runtime.installGlobalDiagnostics(), true);

for (let i = 0; i < 21; i += 1) runtime.recordGameplayFailure(`failure-${i}`, "persistence", Object.assign(new Error("quota"), { code: "quota", recoverable: true }), "write");
const diagnostics = context.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__();
assert.strictEqual(diagnostics.length, 20, "diagnostic ring buffer must stay capped at 20 entries");
assert.strictEqual(diagnostics[0].label, "failure-1");
assert.strictEqual(diagnostics.at(-1).label, "failure-20");
assert.strictEqual(diagnostics.at(-1).generation.memory, 4);
assert.strictEqual(diagnostics.at(-1).generation.canonical, 5);
assert.strictEqual(diagnostics.at(-1).match.matchId, "m1");
assert.strictEqual(errors.length, 21);

const match = context.__INAZUMA_MATCH_DIAGNOSTICS__();
assert.strictEqual(match.runId, "run-1");
assert.strictEqual(match.matchId, "m1");
assert.strictEqual(match.permanentEffects.pending, 1);
assert.strictEqual(match.permanentEffects.applied, 2);

currentRun = null;
const empty = runtime.matchDiagnostics();
assert.strictEqual(empty.runId, undefined);
assert.strictEqual(empty.permanentEffects.pending, 0);

console.log("app-dev-diagnostics-domain-test: PASS");
