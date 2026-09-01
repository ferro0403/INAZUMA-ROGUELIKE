"use strict";

const assert = require("assert");
const fs = require("fs");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const existing = {
  version: 2, seasonId: "ie2", runId: "existing-run", phase: "formation", lives: 2, bossIndex: 0,
  teamIdentity: { name: "Squadra esistente", emblemId: "default-lightning" }, roster: [], lineup: [], bench: [],
  inventory: [], completedBossIds: [], unlockedTeamIds: [], developmentPlayerSnapshot: { frozen: { permanentTargetPotential: 80 } },
};
const storage = new BudgetStorage();
const runtime = load(storage, { fullRuntime: true, run: existing, seasonId: "ie2", seasonDb: { seasonId: "ie2", players: [], teams: [], bossOrder: [] } });
const before = runtime.canonical;
const currentBefore = runtime.context.__INAZUMA_UI_TEST__.getRun();
let saves = 0, reads = 0, diagnostic = null;
const originalSave = runtime.context.RunState.save;
runtime.context.RunState.save = (...args) => { saves += 1; return originalSave(...args); };
class DevelopmentSnapshotError extends Error {
  constructor(code, details) { super(code); this.name = "DevelopmentSnapshotError"; this.code = code; this.details = details; }
}
runtime.context.DevelopmentRuntime = {
  DevelopmentSnapshotError,
  buildRunSnapshot() { throw new DevelopmentSnapshotError("ambiguous-base-player", ["free-agents", "ie2"]); },
};
runtime.context.DevelopmentV2.read = () => { reads += 1; throw new Error("account fallback forbidden"); };
runtime.context.console = { ...console, error(message, payload) { if (message === "New run Development snapshot rejected") diagnostic = payload; } };

const result = runtime.context.__INAZUMA_UI_TEST__.startRunWithIdentity({ name: "Nuova squadra", emblemId: "default-lightning" });
assert.strictEqual(result, false);
assert.equal(saves, 0, "a rejected snapshot must not save or replace a run");
assert.equal(reads, 0, "the failure path must not fall back to current account Development");
assert.deepStrictEqual(runtime.canonical, before, "the existing persisted run remains byte-semantically unchanged");
assert.strictEqual(runtime.context.__INAZUMA_UI_TEST__.getRun(), currentBefore, "the in-memory current run is not replaced");
assert.equal(diagnostic?.code, "ambiguous-base-player");
assert.equal(JSON.stringify(diagnostic?.details), JSON.stringify(["free-agents", "ie2"]));
assert.match(fs.readFileSync("js/app.js", "utf8"), /Impossibile avviare la run: i dati del Centro di sviluppo richiedono una verifica\./);

console.log("development-new-run-failure-test: controlled rejection preserves existing run");
