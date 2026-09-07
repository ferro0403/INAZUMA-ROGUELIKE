"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const modulePaths = [
  "js/diagnostics/diagnostics-storage.js",
  "js/diagnostics/diagnostics-runtime.js",
  "js/diagnostics/diagnostics-error-capture.js",
  "js/diagnostics/diagnostics-view.js",
  "js/diagnostics/diagnostics-controller.js",
  "js/diagnostics/diagnostics-bootstrap.js",
];

for (const path of modulePaths) {
  const source = fs.readFileSync(path, "utf8");
  assert(!/Firebase|Firestore|CloudSave|CloudRestore/.test(source), `${path} must not own cloud persistence`);
}
assert(!fs.readFileSync("js/diagnostics/diagnostics-runtime.js", "utf8").includes("localStorage.setItem"), "runtime event log must not write localStorage");
assert(fs.readFileSync("js/settings/settings-view.js", "utf8").includes("data-settings-game-diagnostics"), "settings must render diagnostics action natively");
assert(fs.readFileSync("js/settings/settings-controller.js", "utf8").includes("global.GameDiagnostics?.open?.()"), "settings controller must delegate diagnostics opening");

function makeStorage() {
  const data = new Map();
  const writes = [];
  const removals = [];
  return {
    writes,
    removals,
    failWrites: false,
    get length() { return data.size; },
    key(index) { return Array.from(data.keys())[index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) {
      if (this.failWrites) {
        const error = new Error("quota full");
        error.name = "QuotaExceededError";
        throw error;
      }
      writes.push(String(key));
      data.set(String(key), String(value));
    },
    removeItem(key) {
      removals.push(String(key));
      data.delete(String(key));
    },
  };
}

const localStorage = makeStorage();
const sessionStorage = makeStorage();
const listeners = new Map();
const opened = [];
const toasts = [];
let saveMode = "success";
let thrownSaveError = null;
const saveReturn = { ok: "original-save-result" };
const currentRun = {
  runId: "run-diagnostics",
  seasonId: "ie1",
  phase: "match",
  bossIndex: 3,
  storageGeneration: 12,
  storageCommitId: "memory-c12",
  currentZone: { currentNodeId: "node-3", pendingNodeId: "node-4" },
  activeMatch: {
    matchId: "match-1",
    type: "five_v_five",
    state: "completed",
    simulation: { state: "completed", resolutionApplied: true },
    postMatchNavigationApplied: false,
    result: { outcome: "win" },
  },
};
const runBefore = JSON.stringify(currentRun);

const context = {
  globalThis: null,
  console: { log() {}, warn() {}, error() {}, info() {} },
  Date,
  Map,
  Set,
  Promise,
  JSON,
  Math,
  Number,
  String,
  Object,
  Array,
  RegExp,
  Error,
  structuredClone,
  localStorage,
  sessionStorage,
  navigator: {},
  document: {
    body: { appendChild() {} },
    getElementById() { return null; },
    createElement() { return { value: "", style: {}, setAttribute() {}, select() {}, remove() {} }; },
    execCommand() { return true; },
  },
  addEventListener(type, handler) { listeners.set(type, handler); },
  run: currentRun,
  SeasonRegistry: { activeId: () => "ie1" },
  RunStorage: {
    diagnostics() {
      return { canonicalGeneration: 13, canonicalCommitId: "canonical-c13", totalKnownBytes: 2048, headGeneration: 13, backupGeneration: 12, headMatchesCanonical: true };
    },
  },
  RunState: {
    save(run) {
      if (saveMode === "throw") throw thrownSaveError;
      return saveReturn;
    },
    load(seasonId, options) {
      assert.strictEqual(seasonId, "ie1");
      assert.strictEqual(options.readOnly, true, "diagnostic canonical reads must stay read-only");
      return { ...currentRun, storageGeneration: 13, storageCommitId: "canonical-c13" };
    },
    createCheckpoint(run) { return run; },
    persistMutationOrRecover(run) { return { ok: true, run }; },
  },
  PermanentEffects: {
    drain(run) { return { ok: true, run }; },
    resumeFinalization(run) { return { ok: true, run }; },
  },
  InazumaPersistenceDiagnostics: {
    async snapshot() {
      return {
        browser: { family: "Safari", storageEstimate: { usage: 500000, quota: 5000000 } },
        permanentStores: {
          localStorageBytes: 4000,
          hall: { bytes: 1200 },
          development: { bytes: 600 },
          album: { bytes: 700 },
          profile: { bytes: 100 },
          topInazumaKeys: [{ key: "inazuma.hall", bytes: 1200 }],
        },
        runs: [{ seasonId: "ie1", generation: 13, phase: "match", bossIndex: 3, currentNode: "node-3", gameOver: false, finalizationStatus: null, canonicalState: "active" }],
      };
    },
  },
  AppDevDiagnostics: {
    create() {
      return Object.freeze({ recordGameplayFailure() { return "original-dev-result"; } });
    },
  },
  AppUiShell: {
    create() {
      return {
        openModal(markup, options) { opened.push({ markup, options }); },
        toast(message) { toasts.push(message); },
      };
    },
  },
};
context.globalThis = context;
vm.createContext(context);
for (const path of modulePaths) vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });

assert(context.GameDiagnostics, "bootstrap must expose GameDiagnostics");
assert(context.PersistenceHomeDiagnostics, "compatibility alias must remain available");

const localWritesBeforeEvent = localStorage.writes.length;
context.GameDiagnostics.recordEvent("manual-event", { message: "test" });
assert.strictEqual(localStorage.writes.length, localWritesBeforeEvent, "ordinary diagnostic events must never write localStorage");
assert(sessionStorage.writes.some((key) => key === "inazuma.diagnostics.events.v2"), "diagnostic events should stay in sessionStorage");

const originalSaveResult = context.RunState.save(currentRun, { source: "success-boundary" });
assert.strictEqual(originalSaveResult, saveReturn, "successful wrapped save must return exact original result");
assert.strictEqual(JSON.stringify(currentRun), runBefore, "diagnostics must not mutate the run on successful save");

saveMode = "throw";
thrownSaveError = new Error("write failed");
thrownSaveError.name = "QuotaExceededError";
let caught = null;
try { context.RunState.save(currentRun, { source: "quota-boundary" }); }
catch (error) { caught = error; }
assert.strictEqual(caught, thrownSaveError, "wrapped save must rethrow the exact original error object");
assert.strictEqual(JSON.stringify(currentRun), runBefore, "diagnostics must not mutate the run on failed save");
assert(context.GameDiagnostics.readFailure().value, "failed save should be captured");

const report = await context.GameDiagnostics.buildReport();
assert.strictEqual(report.classification.code, "quota", "QuotaExceededError must be classified as quota");
assert.strictEqual(report.lastFailure.generation.memory, 12);
assert.strictEqual(report.lastFailure.generation.canonical, 13);
assert.strictEqual(report.lastFailure.match.matchId, "match-1");

const probeKey = context.GameDiagnostics.keys.probe;
const probe = await context.GameDiagnostics.probeStorage();
assert.strictEqual(probe.results.length, 3);
assert(probe.results.every((entry) => entry.ok), "healthy storage probe should complete all sizes");
assert.strictEqual(localStorage.getItem(probeKey), null, "probe key must always be removed");
assert(localStorage.removals.filter((key) => key === probeKey).length >= 4, "probe cleanup must run before/after attempts");

const shell = context.AppUiShell.create({});
assert(shell, "wrapped AppUiShell.create must preserve original shell result");
const modalReport = await context.GameDiagnostics.open();
assert(modalReport, "diagnostics modal must build a report");
assert.strictEqual(opened.length, 1);
assert(opened[0].markup.includes("DIAGNOSTICA GIOCO"));
assert(opened[0].markup.includes("TESTA SPAZIO LOCALE"));
assert.strictEqual(JSON.stringify(currentRun), runBefore, "opening diagnostics modal must not mutate the run");

const localWritesBeforeJsError = localStorage.writes.length;
listeners.get("error")?.({ message: "boom", filename: "test.js", lineno: 1, colno: 2, error: new Error("boom") });
assert.strictEqual(localStorage.writes.length, localWritesBeforeJsError, "global JS error event must remain session-only");
assert(context.GameDiagnostics.readEvents().some((entry) => entry.type === "javascript-error"));

localStorage.failWrites = true;
const localFailureError = new Error("second save failed");
localFailureError.name = "QuotaExceededError";
thrownSaveError = localFailureError;
try { context.RunState.save(currentRun, { source: "quota-no-room-for-log" }); } catch (_) {}
assert(sessionStorage.getItem("inazuma.diagnostics.lastFailure.v3.writeError"), "diagnostic write failure must be preserved in sessionStorage when localStorage is full");
localStorage.failWrites = false;

console.log("game-diagnostics-domain-test: PASS");
