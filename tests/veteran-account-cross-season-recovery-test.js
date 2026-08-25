"use strict";
const assert = require("assert"), BudgetStorage = require("./helpers/budget-storage"), { load } = require("./helpers/production-runtime");
(async () => {
  const storage = new BudgetStorage(), runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js", "persistence-diagnostics.js"]);
  let barcelona = runtime.RunState.createRun({ name: "Veteran" }, "ie2"); runtime.RunState.save(barcelona); barcelona.bossIndex = 9; barcelona.phase = "final-summary"; barcelona.finalization = { status: "pending" };
  const epoch = runtime.PersistenceRecoveryGuard.readEpoch(), journalKey = "inazuma.cloud.restoreJournal.veteran";
  storage.setItem(journalKey, JSON.stringify({ uid: "veteran", operationId: "stuck", stage: "prepared", sourceLocalEpoch: epoch, expectedLocalEpoch: epoch, targetCloudRevision: 77, targetCloudCommitId: null })); runtime.PersistenceRecoveryGuard.bindUid("veteran");
  assert.throws(() => runtime.RunState.save(barcelona), (error) => error.code === "restore-recovery-required", "same poisoned state blocks Barcelona finalization");
  assert.equal((await runtime.InazumaPersistenceDiagnostics.repair()).action, "aborted-unmodified-restore");
  barcelona.phase = "complete"; barcelona.finalization.status = "complete"; runtime.RunState.save(barcelona);
  let orion = runtime.RunState.createRun({ name: "Veteran" }, "orion"); runtime.RunState.save(orion); const reward = runtime.DevelopmentV2.processRunEnd({ runId: orion.runId, seasonId: "orion", defeatedBosses: 4, endReason: "gameover" }); assert(reward.awarded);
  let latest = runtime.RunState.createRun({ name: "Veteran" }, "ie1_s3");
  for (let boss = 1; boss <= 5; boss += 1) { latest.bossIndex = boss; runtime.RunState.save(latest); if (boss === 4) latest = load(storage).RunState.load("ie1_s3", { readOnly: true }); }
  assert.equal(load(storage).RunState.load("ie1_s3", { readOnly: true }).bossIndex, 5); assert.equal(load(storage).RunState.load("ie2", { readOnly: true }).finalization.status, "complete"); assert.equal(load(storage).DevelopmentV2.read().coins, 80);
  console.log("veteran same poisoned store rescued: Barcelona finalization -> Orion gameover -> latest season boss 5: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
