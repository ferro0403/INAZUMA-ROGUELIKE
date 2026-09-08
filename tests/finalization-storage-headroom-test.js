"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load, PRODUCTION_MODULES } = require("./helpers/production-runtime");

const HEADROOM_MODULE = "storage/finalization-storage-headroom.js";
const headroomProductionIndex = PRODUCTION_MODULES.indexOf(HEADROOM_MODULE);
const permanentEffectsProductionIndex = PRODUCTION_MODULES.indexOf("permanent-effects.js");
assert(headroomProductionIndex >= 0, "production runtime must load finalization headroom");
assert(headroomProductionIndex < permanentEffectsProductionIndex, "headroom owner must load before permanent effects");

const BASE_MODULES = [
  "persistence-recovery-guard.js",
  "run-state.js",
  "development-v2.js",
  "permanent-effects.js",
];
const HARDENED_MODULES = [
  "persistence-recovery-guard.js",
  "run-state.js",
  "development-v2.js",
  HEADROOM_MODULE,
  "permanent-effects.js",
];

function seedTerminalRun(context, storage, runId = "terminal-headroom") {
  context.DevelopmentV2.write(context.DevelopmentV2.read());
  const run = context.RunState.createRun({ name: "Headroom Test" }, "orion");
  run.runId = runId;
  run.phase = "finalization";
  run.bossIndex = 13;
  run.completedBossIds = Array.from({ length: 13 }, (_, index) => `boss-${index + 1}`);
  run.finalization = { status: "hall-written", hallTeamId: `hall-${runId}` };
  context.PermanentEffects.enqueueDevelopment(run, { endReason: "victory", defeatedBosses: 13 });
  context.RunState.save(run);
  const keys = context.RunStorage.keys("orion");
  assert.strictEqual(storage.getItem(keys.primary), storage.getItem(keys.backup), "seed must start with an exact backup");
  assert(context.RunStorage.diagnostics("orion").headMatchesCanonical, "seed head must witness canonical primary");
  return { run, keys };
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "exact-reclaim");
  const primaryBefore = storage.getItem(keys.primary);
  const headBefore = storage.getItem(keys.head);
  const backupBefore = storage.getItem(keys.backup);
  const reclaimed = context.FinalizationStorageHeadroom.reclaimExactBackup(run, { source: "test-exact" });
  assert.strictEqual(reclaimed.ok, true);
  assert.strictEqual(reclaimed.reclaimed, true);
  assert(reclaimed.reclaimedBytes >= backupBefore.length * 2);
  assert.strictEqual(storage.getItem(keys.backup), null);
  assert.strictEqual(storage.getItem(keys.primary), primaryBefore);
  assert.strictEqual(storage.getItem(keys.head), headBefore);
  assert.strictEqual(storage.getItem(keys.lock), null, "lease must be released after reclaim");
  assert.strictEqual(context.RunState.load("orion", { readOnly: true }).runId, run.runId);
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "different-backup");
  storage.setItem(keys.backup, `${storage.getItem(keys.backup)} `);
  const result = context.FinalizationStorageHeadroom.reclaimExactBackup(run, { source: "test-different" });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reclaimed, false);
  assert.strictEqual(result.reason, "backup-not-exact");
  assert(storage.getItem(keys.backup));
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "bad-head");
  const head = JSON.parse(storage.getItem(keys.head));
  head.generation += 1;
  storage.setItem(keys.head, JSON.stringify(head));
  const result = context.FinalizationStorageHeadroom.reclaimExactBackup(run, { source: "test-head-mismatch" });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reclaimed, false);
  assert.strictEqual(result.reason, "recovery-proof-invalid");
  assert(storage.getItem(keys.backup));
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "blocked-reclaim");
  const originalGuard = context.PersistenceRecoveryGuard;
  context.PersistenceRecoveryGuard = {
    assertWritable() { throw Object.assign(new Error("restore blocked"), { code: "restore-recovery-required" }); },
    reserve() {},
  };
  const result = context.FinalizationStorageHeadroom.reclaimExactBackup(run, { source: "test-blocked" });
  context.PersistenceRecoveryGuard = originalGuard;
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, "restore-recovery-required");
  assert(storage.getItem(keys.backup));
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "foreign-run-writer");
  storage.setItem(keys.lock, JSON.stringify({ ownerId: "another-tab", fence: Date.now(), expiresAt: Date.now() + 5000 }));
  const backupBefore = storage.getItem(keys.backup);
  const result = context.FinalizationStorageHeadroom.reclaimExactBackup(run, { source: "test-concurrent-writer" });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, "write-locked");
  assert.strictEqual(storage.getItem(keys.backup), backupBefore, "reclaim must not delete a backup owned by another writer window");
  storage.removeItem(keys.lock);
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "no-lock-headroom");
  const before = storage.bytes();
  storage.budget = before;
  const result = context.FinalizationStorageHeadroom.reclaimExactBackup(run, { source: "test-lock-quota" });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, "storage-unavailable");
  assert.strictEqual(result.error.cause?.name, "QuotaExceededError");
  assert(storage.getItem(keys.backup), "backup must remain when the safety lease cannot be acquired");
}

function quotaScenario(modules, runId) {
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, modules);
  const { run, keys } = seedTerminalRun(context, storage, runId);
  const before = storage.bytes();
  storage.budget = before + 1024;
  const result = context.PermanentEffects.resumeFinalization(run);
  return { storage, context, run, keys, result, before };
}

const longQuotaRunId = (suffix) => `quota-${suffix}-${"r".repeat(2048)}`;

{
  const baseline = quotaScenario(BASE_MODULES, longQuotaRunId("without-headroom"));
  assert.strictEqual(baseline.result.completed, false);
  assert.strictEqual(baseline.run.finalization.status, "hall-written");
  assert(baseline.storage.getItem(baseline.keys.backup), "baseline should still hold the duplicate backup");
}

{
  const hardened = quotaScenario(HARDENED_MODULES, longQuotaRunId("with-headroom"));
  assert.strictEqual(hardened.result.completed, true);
  assert.strictEqual(hardened.run.finalization.status, "complete");
  assert.strictEqual(hardened.run.phase, "final-celebration");
  const development = hardened.context.DevelopmentV2.read();
  assert.strictEqual(development.redeemedRunIds.filter((id) => id === hardened.run.runId).length, 1);
  assert.strictEqual(development.victoryRewardRunIds.filter((id) => id === hardened.run.runId).length, 1);
  assert.strictEqual(development.cupsBySeason.orion, 1);
  assert.strictEqual(development.coins, 360);
  const coinsBeforeRetry = development.coins;
  const retry = hardened.context.PermanentEffects.resumeFinalization(hardened.run);
  assert.strictEqual(retry.completed, true);
  assert.strictEqual(hardened.context.DevelopmentV2.read().coins, coinsBeforeRetry, "retry must not duplicate terminal rewards");
  assert.strictEqual(hardened.context.RunState.load("orion", { readOnly: true }).finalization.status, "complete");
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  const { run, keys } = seedTerminalRun(context, storage, "marker-crash-after-development");
  let failedMarker = false;
  const first = context.PermanentEffects.resumeFinalization(run, {
    save(current, metadata = {}) {
      if (!failedMarker && metadata.effectMarker) {
        failedMarker = true;
        const error = new Error("simulated marker crash");
        error.code = "simulated-effect-marker-failure";
        throw error;
      }
      return context.RunState.save(current, metadata);
    },
  });
  assert.strictEqual(first.completed, false);
  assert.strictEqual(first.error?.code, "simulated-effect-marker-failure");
  assert.strictEqual(storage.getItem(keys.backup), null, "exact backup should already have been reclaimed");
  const rewarded = context.DevelopmentV2.read();
  assert.strictEqual(rewarded.redeemedRunIds.filter((id) => id === run.runId).length, 1);
  assert.strictEqual(rewarded.victoryRewardRunIds.filter((id) => id === run.runId).length, 1);
  const coinsAfterFirstAttempt = rewarded.coins;

  const reloaded = context.RunState.load("orion", { readOnly: true });
  assert.strictEqual(reloaded.finalization.status, "hall-written");
  assert.strictEqual(reloaded.permanentEffectOutbox.find((entry) => entry.type === "development-run-end")?.status, "pending");
  const resumed = context.PermanentEffects.resumeFinalization(reloaded);
  assert.strictEqual(resumed.completed, true);
  assert.strictEqual(reloaded.finalization.status, "complete");
  const afterReload = context.DevelopmentV2.read();
  assert.strictEqual(afterReload.coins, coinsAfterFirstAttempt, "reload retry must not award coins twice");
  assert.strictEqual(afterReload.redeemedRunIds.filter((id) => id === run.runId).length, 1);
  assert.strictEqual(afterReload.victoryRewardRunIds.filter((id) => id === run.runId).length, 1);
  assert.strictEqual(context.RunState.load("orion", { readOnly: true }).finalization.status, "complete");
}

{
  const storage = new BudgetStorage(Infinity);
  const context = load(storage, HARDENED_MODULES);
  context.FinalizationStorageHeadroom = { reclaimExactBackup: () => ({ ok: true, reclaimed: false, reason: "test-noop" }) };
  const run = {
    runId: "propagate-development-error",
    seasonId: "orion",
    phase: "finalization",
    bossIndex: 13,
    completedBossIds: [],
    finalization: { status: "hall-written", hallTeamId: "hall-propagation" },
    permanentEffectOutbox: [],
  };
  context.PermanentEffects.enqueueDevelopment(run, { endReason: "victory", defeatedBosses: 13 });
  const quota = new Error("The quota has been exceeded.");
  quota.name = "QuotaExceededError";
  quota.code = 22;
  const account = {
    processRunEnd() { return { state: { redeemedRunIds: [] }, awarded: false, reason: "persistence", error: quota }; },
    read() { return { redeemedRunIds: [] }; },
  };
  const result = context.PermanentEffects.resumeFinalization(run, {
    apis: { DevelopmentAccountV3: account },
    save() { throw new Error("save should not run after Development persistence failure"); },
  });
  assert.strictEqual(result.completed, false);
  assert.strictEqual(result.error.name, "QuotaExceededError");
  assert.strictEqual(result.error.code, 22);
  assert.strictEqual(result.error.stage, "development-write");
  assert.strictEqual(result.error.problemSector, "development");
  assert.strictEqual(result.error.cause, quota);
  assert.strictEqual(run.permanentEffectOutbox[0].status, "pending");
}

console.log("finalization storage headroom + fenced recovery/error propagation: ok");
