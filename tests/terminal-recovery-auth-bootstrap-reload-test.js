"use strict";
const cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") { const result = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" }); process.exit(result.status ?? 1); }
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const { attachAuthenticatedCloud, createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");

async function waitFor(predicate) { for (let i = 0; i < 100; i += 1) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } throw new Error("timeout"); }

(async () => {
  {
    const storage = new BudgetStorage(), c = load(storage), backendState = createAuthenticatedFirestoreBackend(); let releaseRead; const barrier = new Promise(resolve => { releaseRead = resolve; }); backendState.backend.readBarrier = path => path === backendState.manifestPath ? barrier : null;
    storage.setItem("inazuma.cloud.restoreTerminal.test-user", JSON.stringify({ operationId: "tap", reason: "missing-target-cloud-commit-id" })); c.PersistenceRecoveryGuard.bindUid("test-user");
    const cloud = await attachAuthenticatedCloud(c, { backendState }); await waitFor(() => backendState.records.manifestReads === 1);
    const retry = cloud.api.retryRestore(); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(backendState.records.manifestReads, 1, "bootstrap and user retry share one manifest download"); assert.equal(c.CloudRestoreResumeCoordinator.isRunning("test-user"), true);
    releaseRead(); const result = await retry; assert.equal(result.status, "restore-terminal-error"); assert.equal(backendState.records.manifestReads, 1); assert.equal(c.PersistenceRecoveryGuard.isBlocked(), true); assert(storage.getItem("inazuma.cloud.restoreTerminal.test-user"));
  }
  const storage = new BudgetStorage(), c = load(storage), backendState = createAuthenticatedFirestoreBackend();
  storage.setItem("inazuma.cloud.restoreTerminal.test-user", JSON.stringify({ operationId: "hfb5b3aa3", reason: "missing-target-cloud-commit-id" }));
  c.PersistenceRecoveryGuard.bindUid("test-user");
  const cloud = await attachAuthenticatedCloud(c, { backendState });
  await waitFor(() => cloud.api.getState().status === "restore-terminal-error");
  assert(backendState.records.manifestReads >= 1, "auth bootstrap attempted the fresh comparison");
  assert.equal(cloud.api.getState().freshComparisonStatus, "retry-required"); assert.equal(c.PersistenceRecoveryGuard.isBlocked(), true); assert(storage.getItem("inazuma.cloud.restoreTerminal.test-user"));
  const firstReads = backendState.records.manifestReads;
  const reloaded = load(storage); reloaded.PersistenceRecoveryGuard.bindUid("test-user"); const cloudReloaded = await attachAuthenticatedCloud(reloaded, { backendState });
  await waitFor(() => backendState.records.manifestReads > firstReads);
  await waitFor(() => cloudReloaded.api.getState().status === "restore-terminal-error");
  assert.equal(reloaded.PersistenceRecoveryGuard.isBlocked(), true); assert(storage.getItem("inazuma.cloud.restoreTerminal.test-user"));
  assert.equal(reloaded.PersistenceBootstrapGate?.whenAccessible ? await reloaded.PersistenceBootstrapGate.whenAccessible() : true, true);
  console.log("auth bootstrap retries persistent terminal recovery after reload and keeps UI accessible/fenced: ok");
})().catch(error => { console.error(error); process.exit(1); });
