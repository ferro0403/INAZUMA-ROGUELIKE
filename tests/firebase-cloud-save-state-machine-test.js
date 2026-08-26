"use strict";
const assert = require("assert"), cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") {
  const result = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const { attachAuthenticatedCloud } = require("./helpers/authenticated-cloud-runtime");

async function runtime() {
  const storage = new BudgetStorage(1_000_000), context = load(storage, { fullRuntime: true, seasonId: "orion" }).context;
  const blocked = [], guard = context.PersistenceRecoveryGuard;
  context.PersistenceRecoveryGuard = new Proxy(guard, { get(target, key) { if (key === "setBlocked") return value => { blocked.push(value); return target.setBlocked(value); }; return target[key]; } });
  context.HallOfFameStorage._saveArchive(context.HallOfFameStorage._loadArchive(), { preserveTimestamp: true });
  const run = context.RunState.createRun({ name: "Cloud" }, "orion"); context.RunState.save(run);
  const cloud = await attachAuthenticatedCloud(context);
  assert.equal(cloud.api.getState().status, "synced", "authenticated baseline association must upload");
  cloud.records.uploadedSectors.length = 0;
  return { storage, context, blocked, ...cloud };
}
function dirty(value, sector = "run_orion") {
  const run = value.context.RunState.load("orion"); run.bossIndex += 1; value.context.RunState.save(run, { suppressCloudEvent: true });
  value.context.dispatchEvent(new value.context.CustomEvent("inazuma:local-save-committed", { detail: { sector } }));
  assert(value.api.getState().pendingSectors.includes(sector));
}
async function transient(code) {
  const value = await runtime(); dirty(value); value.backend.failure = code; await value.api.syncNow();
  assert.equal(value.api.getState().status, "sync-error"); assert.notEqual(value.api.getState().status, "sync-conflict");
  assert(value.api.getState().pendingSectors.includes("run_orion")); assert.deepEqual(value.blocked, []);
  value.backend.failure = null; await value.api.retrySync(); assert.equal(value.api.getState().status, "synced");
  assert.deepEqual(value.api.getState().pendingSectors, []); assert(value.records.stagedCommits.length); assert(value.records.uploadedSectors.includes("run_orion"));
}
(async () => {
  await transient("permission-denied"); await transient("unavailable");
  const value = await runtime(); dirty(value); value.backend.conflictOnce = true; await value.api.syncNow();
  assert.equal(value.api.getState().status, "sync-conflict"); assert(value.api.getState().pendingSectors.includes("run_orion"));
  const developmentBefore = value.context.DevelopmentV2.read();
  const changedDevelopment = structuredClone(developmentBefore); changedDevelopment.coins += 7;
  const developmentAfter = value.context.DevelopmentV2.write(changedDevelopment);
  assert.notDeepEqual(developmentAfter, developmentBefore, "DevelopmentV2.write must make a real local change during conflict");
  const developmentHash = await value.context.InazumaCloudSaveCore.hash(developmentAfter, value.context.crypto);
  assert(value.api.getState().pendingSectors.includes("development"));
  await value.api.checkForCloudUpdate(); assert.equal(value.api.getState().status, "local-conflict");
  assert.equal(value.api.requestConflictResolution("local"), true); await value.api.resolveConflictUseLocal();
  assert.equal(value.api.getState().status, "synced"); assert.deepEqual(value.api.getState().pendingSectors, []);
  const finalManifest = value.documents.get(value.manifestPath);
  const finalDevelopmentDocument = value.documents.get(`users/test-user/saveCommits/${finalManifest.cloudCommitId}/sectors/development`);
  const finalDevelopment = value.context.InazumaCloudSaveCore.decodeFirestorePayload(finalDevelopmentDocument.payload);
  assert(value.records.uploadedSectors.includes("run_orion"));
  assert(value.api.getState().pendingSectors.length === 0, "development must remain represented through successful conflict resolution");
  assert.equal(finalManifest.sectorHashes.development, developmentHash, "published Development hash must describe the new local state");
  assert.equal(finalDevelopmentDocument.payloadHash, developmentHash, "staged Development hash must describe the new local state");
  assert.deepEqual(finalDevelopment, developmentAfter, "uploaded Development payload must contain the mutation made during conflict");
  assert.equal(finalDevelopment.coins, developmentBefore.coins + 7); assert.deepEqual(value.blocked, []);

  const repair = await runtime(); dirty(repair); const originalSet = repair.storage.setItem.bind(repair.storage); let failMetadata = true;
  repair.storage.setItem = (key, data) => { if (failMetadata && key.startsWith("inazuma.cloud.association.")) { failMetadata = false; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); } return originalSet(key, data); };
  await repair.api.syncNow(); assert.equal(repair.api.getState().status, "metadata-repair-needed");
  await repair.api.retrySync(); assert.equal(repair.api.getState().status, "synced"); assert.deepEqual(repair.api.getState().pendingSectors, []); assert.deepEqual(repair.blocked, []);
  console.log("authenticated firebase cloud-save state machine: permission/unavailable/CAS/new-dirty/metadata-repair ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
