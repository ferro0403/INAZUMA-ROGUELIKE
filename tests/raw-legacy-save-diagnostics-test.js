"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const snapshot = (storage) => [...storage.map.entries()].sort(([left], [right]) => left.localeCompare(right));
const legacy = (seasonId, changes = {}) => ({
  seasonId, saveVersion: 2, updatedAt: "2026-08-20T10:00:00.000Z", phase: "map", gameOver: false,
  bossIndex: 4, completedBossIds: ["boss_0", "boss_1", "boss_2", "boss_3"],
  currentZone: { zoneIndex: 4, currentNodeId: "zone_4_l2_n1" }, teamLevel: 8, lives: 2,
  formationId: "442", roster: [{ playerId: "mark", level: 8 }], lineup: ["mark"], bench: [], inventory: [],
  ...changes
});

(async () => {
  const storage = new BudgetStorage();
  const runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "persistence-diagnostics.js"]);
  runtime.InazumaAccount = { getState: () => ({ status: "authenticated", uid: "diagnostic-user" }) };

  const ie1Raw = ` {\n  "seasonId": "ie1", "saveVersion": 2, "phase": "map", "bossIndex": 4,\n  "currentZone": { "currentNodeId": "zone_4_l2_n1" }, "roster": []\n} `;
  const ie2Backup = JSON.stringify(legacy("ie2", { bossIndex: 0, completedBossIds: [], currentZone: { zoneIndex: 0, currentNodeId: "zone_0_l1_n0" }, teamLevel: 1 }));
  const ie2Primary = JSON.stringify(legacy("ie2", { updatedAt: "2026-08-21T11:00:00.000Z", bossIndex: 1, currentZone: { zoneIndex: 1, currentNodeId: "zone_1_l1_n0" }, teamLevel: 2, roster: [{ playerId: "mark", level: 2 }, { playerId: "axel", level: 1 }] }));
  const keys1 = runtime.RunStorage.keys("ie1"), keys2 = runtime.RunStorage.keys("ie2");
  storage.setItem(keys1.primary, ie1Raw); storage.setItem(keys1.backup, ie1Raw);
  storage.setItem(keys2.primary, ie2Primary); storage.setItem(keys2.backup, ie2Backup);
  const journalKey = "inazuma.cloud.restoreJournal.diagnostic-user";
  const journalRaw = JSON.stringify({ uid: "diagnostic-user", operationId: "operation-secret", stage: "run-ie1", targetCloudRevision: 9428, targetCloudCommitId: null, sourceLocalEpoch: 7, expectedLocalEpoch: 7 });
  storage.setItem(journalKey, journalRaw);
  runtime.PersistenceRecoveryGuard.bindUid("diagnostic-user");

  const before = snapshot(storage), writesBefore = storage.operations.length;
  const report = await runtime.InazumaPersistenceDiagnostics.exportRawLegacySaves();
  assert.deepStrictEqual(snapshot(storage), before, "the complete localStorage is byte-identical");
  assert.strictEqual(storage.operations.slice(writesBefore).filter((operation) => operation.method !== "getItem").length, 0, "export only performs reads");
  for (const key of [keys1.head, keys1.temp, keys1.lock, keys2.head, keys2.temp, keys2.lock]) assert.strictEqual(storage.getItem(key), null, `${key} was not created`);
  assert.strictEqual(storage.getItem(journalKey), journalRaw);
  assert.strictEqual(storage.getItem("inazuma.persistence.localMutationEpoch"), null);

  assert.strictEqual(report.seasons.ie1.rawPrimary, storage.getItem(keys1.primary));
  assert.strictEqual(report.seasons.ie1.rawBackup, storage.getItem(keys1.backup));
  assert.strictEqual(report.seasons.ie1.primary.format, "legacy-raw");
  assert.strictEqual(report.seasons.ie1.comparison.rawEqual, true);
  assert.strictEqual(report.seasons.ie1.comparison.semanticEqual, true);
  assert.strictEqual(report.seasons.ie1.comparison.differingPaths.length, 0);
  assert.strictEqual(report.seasons.ie2.rawPrimary, storage.getItem(keys2.primary));
  assert.strictEqual(report.seasons.ie2.rawBackup, storage.getItem(keys2.backup));
  assert.strictEqual(report.seasons.ie2.comparison.rawEqual, false);
  for (const path of ["bossIndex", "currentZone.currentNodeId", "teamLevel", "updatedAt"]) assert(report.seasons.ie2.comparison.differingPaths.includes(path), `reports ${path}`);
  assert.strictEqual(JSON.stringify(report.seasons.ie2.comparison.rosterDiff.removedIds), '["axel"]');
  assert.strictEqual(report.restore.journalStage, "run-ie1");
  assert.strictEqual(report.restore.targetCloudRevision, 9428);

  const canonical = { storageSchemaVersion: 1, seasonId: "ie1", generation: 1, commitId: "commit", state: "active", runId: "run-id", payload: legacy("ie1", { runId: "run-id" }) };
  storage.setItem(keys1.primary, JSON.stringify(canonical));
  const canonicalBefore = snapshot(storage);
  const canonicalReport = await runtime.InazumaPersistenceDiagnostics.exportRawLegacySaves();
  assert.strictEqual(canonicalReport.seasons.ie1.primary.format, "canonical-envelope");
  assert.deepStrictEqual(snapshot(storage), canonicalBefore, "canonical control remains unchanged");

  assert.strictEqual(runtime.InazumaCloudSave, undefined, "diagnostic has no cloud API dependency or write call");
  console.log("raw legacy IE1/IE2 diagnostics are exact, semantic, canonical-aware, and zero-write: ok");
})().catch((error) => { throw error; });
