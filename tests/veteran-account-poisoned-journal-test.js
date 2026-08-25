"use strict";
const assert = require("assert"), BudgetStorage = require("./helpers/budget-storage"), { load } = require("./helpers/production-runtime");
(async () => {
  const storage = new BudgetStorage(), runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js", "persistence-diagnostics.js"]);
  runtime.InazumaAccount = { getState: () => ({ status: "authenticated", uid: "veteran" }) };
  const run = runtime.RunState.createRun({ name: "Veteran" }, "orion"); runtime.RunState.save(run);
  const epoch = runtime.PersistenceRecoveryGuard.readEpoch(), key = "inazuma.cloud.restoreJournal.veteran";
  storage.setItem(key, JSON.stringify({ schemaVersion: 3, uid: "veteran", operationId: "private-operation", stage: "prepared", sourceLocalEpoch: epoch, expectedLocalEpoch: epoch, targetCloudRevision: 88, targetCloudCommitId: null, startedAt: new Date().toISOString() }));
  runtime.PersistenceRecoveryGuard.bindUid("veteran");
  assert.throws(() => runtime.DevelopmentV2.processRunEnd({ runId: run.runId, seasonId: "orion", defeatedBosses: 4, endReason: "gameover" }), (error) => error.code === "restore-recovery-required", "poisoned journal reproduces missing Orion reward");
  const repair = await runtime.InazumaPersistenceDiagnostics.repair();
  assert.equal(repair.action, "aborted-unmodified-restore"); assert.equal(storage.getItem(key), null);
  const reward = runtime.DevelopmentV2.processRunEnd({ runId: run.runId, seasonId: "orion", defeatedBosses: 4, endReason: "gameover" });
  assert.equal(reward.awarded, true); assert.equal(runtime.DevelopmentV2.read().coins, 80);
  const again = runtime.DevelopmentV2.processRunEnd({ runId: run.runId, seasonId: "orion", defeatedBosses: 4, endReason: "gameover" }); assert.equal(again.awarded, false); assert.equal(runtime.DevelopmentV2.read().coins, 80);
  console.log("veteran poisoned prepared journal self-heal and Orion exactly-once reward: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
