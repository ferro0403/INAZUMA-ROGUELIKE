"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/diagnostics/diagnostics-error-capture.js", "utf8");
const originalSaveError = new Error("original-save-failure");
const originalCheckpointError = new Error("original-checkpoint-failure");
const mutationResult = { ok: false, error: new Error("original-mutation-failure") };
const drainResult = { ok: false, error: new Error("original-drain-failure") };
const finalizationResult = { ok: false, error: new Error("original-finalization-failure") };
const warnings = [];
const listeners = new Map();

const context = {
  globalThis: null,
  console: { warn: (...args) => warnings.push(args) },
  addEventListener(type, handler) { listeners.set(type, handler); },
  RunState: {
    save() { throw originalSaveError; },
    createCheckpoint() { throw originalCheckpointError; },
    persistMutationOrRecover() { return mutationResult; },
  },
  PermanentEffects: {
    drain() { return drainResult; },
    resumeFinalization() { return finalizationResult; },
  },
  AppDevDiagnostics: {
    create() {
      return Object.freeze({
        recordGameplayFailure() { return "original-dev-return"; },
      });
    },
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "diagnostics-error-capture.js" });

const diagnosticCrash = new Error("diagnostic-recorder-crashed");
const runtime = {
  recordFailure() { throw diagnosticCrash; },
  recordEvent() { throw diagnosticCrash; },
  failureKind() { throw diagnosticCrash; },
  errorSnapshot() { throw diagnosticCrash; },
};

const installed = context.GameDiagnosticsErrorCapture.install({ runtime });
assert.strictEqual(installed.installed, true);

let caughtSave = null;
try { context.RunState.save({ runId: "run" }, { source: "test" }); }
catch (error) { caughtSave = error; }
assert.strictEqual(caughtSave, originalSaveError, "diagnostic failure must never replace the original save error");

let caughtCheckpoint = null;
try { context.RunState.createCheckpoint({ runId: "run" }); }
catch (error) { caughtCheckpoint = error; }
assert.strictEqual(caughtCheckpoint, originalCheckpointError, "diagnostic failure must never replace the original checkpoint error");

assert.strictEqual(
  context.RunState.persistMutationOrRecover({ runId: "run" }, () => {}, { source: "test" }),
  mutationResult,
  "diagnostic failure must not alter persistMutationOrRecover result identity"
);
assert.strictEqual(context.PermanentEffects.drain({ runId: "run" }), drainResult, "diagnostic failure must not alter drain result identity");
assert.strictEqual(context.PermanentEffects.resumeFinalization({ runId: "run" }), finalizationResult, "diagnostic failure must not alter finalization result identity");

const devDiagnostics = context.AppDevDiagnostics.create({});
assert.strictEqual(
  devDiagnostics.recordGameplayFailure("label", "stage", new Error("game-error"), "kind"),
  "original-dev-return",
  "diagnostic failure must not alter AppDevDiagnostics return contract"
);

assert.doesNotThrow(() => listeners.get("error")?.({ message: "js-error", error: new Error("js-error") }), "global error capture must be fail-closed");
assert.doesNotThrow(() => listeners.get("unhandledrejection")?.({ reason: new Error("promise-error") }), "unhandled rejection capture must be fail-closed");
assert(warnings.length >= 1, "diagnostic capture failures should be warning-only");

console.log("game-diagnostics-failure-isolation-test: PASS");
