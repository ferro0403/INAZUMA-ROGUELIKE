"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

function legacy(id, overrides = {}) {
  return { version: 2, seasonId: id, runId: `run-${id}`, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-08-18T22:22:51.884Z", lastPlayedAt: "2026-08-18T22:22:51.884Z", phase: "map", lives: 1, bossIndex: 4, completedBossIds: ["occult", "wild", "brainwashing", "otaku"], unlockedTeamIds: [], roster: [{ id: "p1", level: 8 }], lineup: [], bench: [], inventory: [{ id: "item" }], activeMatch: { id: "active" }, currentZone: { currentNodeId: "zone_4_l2_n1" }, checkpoint: { currentZone: { currentNodeId: "zone_4_start" }, teamIdentity: { emblemId: "default-lightning" } }, teamIdentity: { emblemId: "default-lightning" }, consecutiveLosses: 0, unknownGameplayField: { preserved: true }, ...overrides };
}

{
  const storage = new BudgetStorage(), runtime = load(storage), primary = legacy("ie1"), backup = { ...primary, updatedAt: "2026-08-18T22:22:50.109Z" };
  storage.setItem("run:ie1", JSON.stringify(primary)); storage.setItem("run:ie1_backup", JSON.stringify(backup));
  const epoch = runtime.PersistenceRecoveryGuard.readEpoch(), result = runtime.RunStorage.canonicalizeLegacyPrimary("ie1");
  assert.equal(result.canonicalizationSource, "primary"); assert.equal(result.backupPreserved, true); assert.equal(storage.getItem("run:ie1_backup"), JSON.stringify(backup));
  const loaded = runtime.RunState.load("ie1", { readOnly: true });
  assert.equal(loaded.runId, primary.runId); assert.equal(loaded.bossIndex, 4); assert.equal(loaded.currentZone.currentNodeId, "zone_4_l2_n1"); assert.equal(loaded.checkpoint.currentZone.currentNodeId, "zone_4_start"); assert.deepEqual(loaded.activeMatch, primary.activeMatch); assert.deepEqual(loaded.unknownGameplayField, primary.unknownGameplayField);
  assert.equal(runtime.RunStorage.diagnostics("ie1").headMatchesCanonical, true); assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), epoch + 1);
  const bytes = storage.getItem("run:ie1"), head = storage.getItem("run:ie1_head"), again = runtime.RunStorage.canonicalizeLegacyPrimary("ie1");
  assert.equal(again.migrated, false); assert.equal(storage.getItem("run:ie1"), bytes); assert.equal(storage.getItem("run:ie1_head"), head); assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), epoch + 1);
}

{
  const storage = new BudgetStorage(), runtime = load(storage), primary = legacy("ie2", { phase: "match", bossIndex: 0, completedBossIds: [], currentZone: { currentNodeId: "zone_0_l1_n0" } }), backup = JSON.parse(JSON.stringify(primary));
  delete backup.consecutiveLosses; backup.teamIdentity = { logo: "inazuma-lightning" }; backup.checkpoint.teamIdentity = { logo: "inazuma-lightning" };
  storage.setItem("run:ie2", JSON.stringify(primary)); storage.setItem("run:ie2_backup", JSON.stringify(backup)); runtime.RunStorage.canonicalizeLegacyPrimary("ie2");
  const loaded = runtime.RunState.load("ie2", { readOnly: true }); assert.equal(loaded.teamIdentity.emblemId, "default-lightning"); assert.equal(loaded.consecutiveLosses, 0); assert.equal(loaded.runId, primary.runId); assert.equal(storage.getItem("run:ie2_backup"), JSON.stringify(backup));
}

for (const point of ["after-candidate", "before-head", "after-head"]) {
  const storage = new BudgetStorage(), runtime = load(storage), raw = JSON.stringify(legacy("ie1")), backup = JSON.stringify(legacy("ie1", { updatedAt: "old" })); storage.setItem("run:ie1", raw); storage.setItem("run:ie1_backup", backup);
  assert.throws(() => runtime.RunStorage.canonicalizeLegacyPrimary("ie1", { crash: at => { if (at === point) throw new Error("crash"); } }), /legacy-canonicalization-failed/);
  assert.equal(storage.getItem("run:ie1_backup"), backup); assert(runtime.RunState.load("ie1", { readOnly: true }));
  if (point === "after-candidate") { assert.equal(storage.getItem("run:ie1"), raw); assert.equal(storage.getItem("run:ie1_head"), null); } else if (point === "before-head") { assert.equal(storage.getItem("run:ie1_head"), null); const envelope = storage.getItem("run:ie1"); const repaired = runtime.RunStorage.canonicalizeLegacyPrimary("ie1"); assert.equal(repaired.repairedHead, true); assert.equal(storage.getItem("run:ie1"), envelope); assert.equal(runtime.RunStorage.canonicalizeLegacyPrimary("ie1").repairedHead, false); } else { const envelope = storage.getItem("run:ie1"), head = storage.getItem("run:ie1_head"); assert(storage.getItem("run:ie1_tmp")); const repaired = runtime.RunStorage.canonicalizeLegacyPrimary("ie1"); assert.equal(repaired.migrated, false); assert.equal(storage.getItem("run:ie1"), envelope); assert.equal(storage.getItem("run:ie1_head"), head); assert.equal(storage.getItem("run:ie1_tmp"), null); assert.equal(storage.getItem("run:ie1_backup"), backup); assert.equal(runtime.RunStorage.canonicalizeLegacyPrimary("ie1").migrated, false); }
}

{
  const storage = new BudgetStorage(), runtime = load(storage); const healthy = runtime.RunState.createRun({ name: "Healthy" }, "orion"); runtime.RunState.save(healthy); const before = new Map(storage.map);
  runtime.RunStorage.canonicalizeLegacyPrimary("orion"); for (const [key, value] of before) assert.equal(storage.getItem(key), value, key);
}

{
  const storage = new BudgetStorage(), runtime = load(storage); storage.setItem("run:ie1", JSON.stringify(legacy("ie1"))); runtime.RunStorage.canonicalizeLegacyPrimary("ie1");
  const primary = JSON.parse(storage.getItem("run:ie1")); storage.setItem("run:ie1_head", JSON.stringify({ ...JSON.parse(storage.getItem("run:ie1_head")), generation: primary.generation + 1, commitId: "newer" }));
  assert.throws(() => runtime.RunStorage.canonicalizeLegacyPrimary("ie1"), error => error.code === "canonical-unrecoverable");
}

{
  const storage = new BudgetStorage(), runtime = load(storage); storage.setItem("inazuma.persistence.localMutationEpoch", "166"); storage.setItem("run:ie1", JSON.stringify(legacy("ie1"))); storage.setItem("inazuma.cloud.restoreTerminal.u", JSON.stringify({ operationId: "hfb5b3aa3" })); runtime.PersistenceRecoveryGuard.bindUid("u");
  assert.throws(() => runtime.RunState.save(legacy("ie1")), error => error.code === "restore-recovery-required");
  assert.equal(runtime.RunStorage.canonicalizeLegacyPrimary("ie1").migrated, true); assert.equal(runtime.PersistenceRecoveryGuard.isBlocked(), true); assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), 167);
}

(async () => {
  const coordinator = require("../js/cloud-restore-resume-coordinator"); let resumed = 0, abandoned = 0, fresh = 0; const journal = { uid: "u", operationId: "old", stage: "run-ie1", targetCloudRevision: 9428, targetCloudCommitId: null, sourceLocalEpoch: 166, expectedLocalEpoch: 166 };
  const result = await coordinator.retry({ auth: { status: "authenticated", uid: "u" }, readJournal: () => journal, resumeInterrupted: () => resumed++, abandonNonResumable: () => abandoned++, freshComparison: () => { fresh += 1; return { classification: "conflict" }; } });
  assert.equal(result.classification, "conflict"); assert.equal(resumed, 0); assert.equal(abandoned, 1); assert.equal(fresh, 1);
  console.log("legacy primary canonicalization, crash recovery, idempotence and non-resumable journal: ok");
})().catch(error => { throw error; });
