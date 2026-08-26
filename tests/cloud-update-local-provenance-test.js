"use strict";
const cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") { const result = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" }); process.exit(result.status ?? 1); }
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const { attachAuthenticatedCloud, createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");

async function setup() {
  const seedStorage = new BudgetStorage(), seed = load(seedStorage), run = seed.RunState.createRun({ name: "Team" }, "orion"); run.phase = "map"; run.currentZone = { currentNodeId: "zone_1_start" }; run.roster = [{ id: "p1" }]; seed.RunState.save(run); seed.RunState.saveProfileTeamIdentity({ name: "Team", emblemId: "default-lightning" }); seed.AlbumProgress.write({ version: 1, unlockedPlayerIds: [] }); seed.DevelopmentV2.write(seed.DevelopmentV2.read()); seed.HallOfFameStorage._saveArchive({ schemaVersion: 1, updatedAt: "2026-01-01T00:00:00.000Z", teams: [], index: [] }, { preserveTimestamp: true });
  const entries = Object.fromEntries(seedStorage.map), backendState = createAuthenticatedFirestoreBackend();
  const sourceStorage = new BudgetStorage(Infinity, entries), source = load(sourceStorage), sourceCloud = await attachAuthenticatedCloud(source, { backendState });
  const clientStorage = new BudgetStorage(Infinity, entries), client = load(clientStorage), clientCloud = await attachAuthenticatedCloud(client, { backendState });
  const remote = source.RunState.load("orion", { readOnly: true }); remote.currentZone.currentNodeId = "zone_1_l1_n1"; source.RunState.save(remote); await sourceCloud.api.retryAssociation(); await sourceCloud.api.syncNow(); assert.equal(backendState.documents.get(backendState.manifestPath).revision, 2, `source state ${JSON.stringify(sourceCloud.api.getState())}`);
  await clientCloud.api.checkForCloudUpdate(); assert.equal(clientCloud.api.getState().status, "cloud-update-available");
  return { client, clientStorage, clientCloud };
}

(async () => {
  {
    const { client, clientCloud } = await setup(); const result = await clientCloud.api.updateFromCloud();
    assert.equal(result.status, "restored"); assert.equal(client.RunState.load("orion", { readOnly: true }).currentZone.currentNodeId, "zone_1_l1_n1");
  }
  for (const mutation of [
    run => { run.currentZone.currentNodeId = "zone_local_only"; },
    run => { run.roster.push({ id: "local-player" }); run.inventory.push({ id: "local-item" }); },
  ]) {
    const { client, clientCloud } = await setup(), before = client.RunState.load("orion", { readOnly: true }); mutation(before); client.RunState.save(before); const expected = JSON.stringify(client.RunState.load("orion", { readOnly: true }));
    const result = await clientCloud.api.updateFromCloud(); assert.equal(result.status, "restore-conflict-required"); assert.equal(clientCloud.api.getState().status, "local-conflict"); assert.equal(JSON.stringify(client.RunState.load("orion", { readOnly: true })), expected); assert.equal(client.PersistenceRecoveryGuard.persistentJournal(), null);
  }
  {
    const { client, clientStorage, clientCloud } = await setup(); clientStorage.setItem("inazuma.persistence.localMutationEpoch", String(client.PersistenceRecoveryGuard.readEpoch() + 1)); const result = await clientCloud.api.updateFromCloud(); assert.equal(result.status, "restore-conflict-required");
  }
  {
    const { client, clientCloud } = await setup(), created = client.RunState.createRun({ name: "Local IE2" }, "ie2"); client.RunState.save(created); const runId = created.runId; const result = await clientCloud.api.updateFromCloud(); assert.equal(result.status, "restore-conflict-required"); assert.equal(client.RunState.load("ie2", { readOnly: true }).runId, runId); assert.equal(client.PersistenceRecoveryGuard.persistentJournal(), null);
  }
  {
    const { client, clientCloud } = await setup(), local = client.RunState.load("orion", { readOnly: true }); local.currentZone.currentNodeId = "local-explicit"; client.RunState.save(local); await clientCloud.api.updateFromCloud(); assert.equal(clientCloud.api.requestConflictResolution("cloud"), true); await clientCloud.api.resolveConflictUseCloud(); assert.equal(client.RunState.load("orion", { readOnly: true }).currentZone.currentNodeId, "zone_1_l1_n1");
  }
  console.log("cloud update replacement requires a current snapshot provenance proof: ok");
})().catch(error => { console.error(error); process.exit(1); });
