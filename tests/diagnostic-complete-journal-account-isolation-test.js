"use strict";
const assert = require("assert"), BudgetStorage = require("./helpers/budget-storage"), { load } = require("./helpers/production-runtime");

(async () => {
  const storage = new BudgetStorage();
  const runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js", "persistence-diagnostics.js"]);
  let active = "A";
  runtime.InazumaAccount = { getState: () => ({ status: "authenticated", uid: active }) };
  const key = (uid) => `inazuma.cloud.restoreJournal.${uid}`;
  const journal = (uid) => ({ uid, operationId: `op-${uid}`, stage: "complete", targetCloudRevision: 42, targetCloudCommitId: `commit-${uid}` });
  storage.setItem(key("A"), JSON.stringify(journal("A")));
  storage.setItem("inazuma.cloud.association.B", JSON.stringify({ uid: "B", revision: 42, cloudCommitId: "commit-A" }));
  runtime.PersistenceRecoveryGuard.bindUid("A");
  let result = await runtime.InazumaPersistenceDiagnostics.repair();
  assert.equal(result.blocker, "complete-journal-target-not-locally-proven");
  assert(storage.getItem(key("A")), "B metadata must not prove A complete");

  storage.setItem("inazuma.cloud.association.A", JSON.stringify({ uid: "A", revision: 42, cloudCommitId: "commit-A", status: "associated" }));
  result = await runtime.InazumaPersistenceDiagnostics.repair();
  assert.equal(result.action, "cleared-verified-complete-journal");
  assert.equal(storage.getItem(key("A")), null);

  storage.setItem(key("A"), JSON.stringify(journal("A")));
  active = "B";
  runtime.PersistenceRecoveryGuard.bindUid("B");
  await runtime.InazumaPersistenceDiagnostics.repair();
  assert(storage.getItem(key("A")), "logged-in B cannot clean A journal");
  console.log("complete restore journal proof is active-account and commit scoped: ok");
})().catch((error) => { throw error; });
