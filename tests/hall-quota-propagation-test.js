"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

class HallQuotaStorage extends BudgetStorage {
  setItem(key, value) {
    if (String(key) === "inazuma.hallOfFame.v1") {
      const error = new Error("Quota exceeded at Hall write");
      error.name = "QuotaExceededError";
      error.code = 22;
      throw error;
    }
    return super.setItem(key, value);
  }
}

const storage = new HallQuotaStorage();
const runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "development-v2.js", "hall-of-fame.js", "permanent-effects.js"]);
const snapshot = { archiveKey: "quota-run::mode::ie2::final", hallTeamId: "hall-quota-run", runId: "quota-run", seasonId: "ie2", finalBossId: "final", teamName: "Quota FC", finalStartingEleven: [], fullRoster: [] };
const direct = runtime.HallOfFameStorage.addChampion(snapshot);
assert.equal(direct.persisted, false);
assert.equal(direct.error.code, "storage-quota-exceeded");
assert.equal(direct.error.stage, "hall-finalization");
assert.equal(direct.error.problemSector, "hall_index");

const run = runtime.RunState.createRun({ name: "Quota FC" }, "ie2");
run.phase = "finalization";
run.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId };
runtime.PermanentEffects.enqueueHall(run, snapshot);
runtime.RunState.save(run);
const result = runtime.PermanentEffects.resumeFinalization(run);
assert.equal(result.completed, false);
assert.equal(result.error.code, "storage-quota-exceeded");
assert.equal(result.error.stage, "hall-finalization");
assert.equal(result.error.problemSector, "hall_index");
assert.equal(runtime.RunState.load("ie2", { readOnly: true }).finalization.status, "pending", "canonical victory checkpoint remains recoverable");
console.log("Hall quota cause survives addChampion and finalization: ok");
