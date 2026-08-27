"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

(async () => {
function legacyState() {
  return JSON.stringify({
    schemaVersion: 5,
    coins: 120,
    cups: 4,
    projects: { Elite: 2 },
    projectBuild: { Elite: 3 },
    players: { p: { permanentTargetPotential: 85, currentPermanentRarity: "Elite", evolutionCount: 1 } },
    evolutionHistory: [{ playerId: "p", fromRarity: "Forte", toRarity: "Elite", coinsConsumed: 800 }],
  });
}

{
  const storage = new BudgetStorage();
  const runtime = load(storage);
  const key = runtime.DevelopmentV2.STORAGE_KEY;
  const rawBefore = legacyState();
  storage.setItem(key, rawBefore);
  storage.setItem(runtime.PersistenceRecoveryGuard.EPOCH_KEY, "41");
  let cloudEvents = 0;
  runtime.dispatchEvent = event => { if (event.type === "inazuma:local-save-committed") cloudEvents += 1; };

  const operationStart = storage.operations.length;
  const state = runtime.DevelopmentV2.read();
  assert.equal(state.schemaVersion, runtime.DevelopmentV2.SCHEMA_VERSION);
  assert.equal(state.cupsBySeason.ie1, 4);
  assert.equal(state.legacyCups, 0);
  assert.equal(state.projects.Elite, 2);
  assert.equal(state.legacyProjectBuild.Elite, 3);
  assert.equal(storage.getItem(key), rawBefore, "read must preserve legacy Development bytes");
  assert.deepEqual(storage.operations.slice(operationStart).filter(operation => operation.method !== "getItem"), [], "read performs no persistence side effect");
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), 41, "read does not reserve a mutation epoch");
  assert.equal(cloudEvents, 0, "read emits no cloud-save event");

  const statusStart = storage.operations.length;
  const status = runtime.DevelopmentV2.migrationStatus();
  assert.equal(status.valid, true);
  assert.equal(status.needed, true);
  assert(status.reasons.includes("schema-version"));
  assert(status.reasons.includes("legacy-cups-field"));
  assert(status.reasons.includes("legacy-project-build-field"));
  assert.deepEqual(storage.operations.slice(statusStart).filter(operation => operation.method !== "getItem"), [], "migrationStatus is read-only");
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), 41);
}

{
  const uid = "development-read-only-user";
  const storage = new BudgetStorage();
  const runtime = load(storage);
  const key = runtime.DevelopmentV2.STORAGE_KEY;
  const rawBefore = legacyState();
  storage.setItem(key, rawBefore);
  storage.setItem(runtime.PersistenceRecoveryGuard.EPOCH_KEY, "77");
  storage.setItem(`inazuma.cloud.restoreTerminal.${uid}`, JSON.stringify({ operationId: "terminal" }));
  runtime.PersistenceRecoveryGuard.bindUid(uid);
  assert.equal(runtime.PersistenceRecoveryGuard.isBlocked(), true);

  let cloudEvents = 0;
  runtime.dispatchEvent = event => { if (event.type === "inazuma:local-save-committed") cloudEvents += 1; };
  const operationStart = storage.operations.length;
  const readState = runtime.DevelopmentV2.read();
  assert.equal(readState.cupsBySeason.ie1, 4, "legacy data remains readable in memory while recovery is blocked");
  const result = runtime.DevelopmentV2.migrateStoredState();
  assert.equal(result.ok, false);
  assert.equal(result.migrated, false);
  assert.equal(result.deferred, true);
  assert.equal(result.reason, "restore-recovery-required");
  assert.equal(storage.getItem(key), rawBefore, "blocked migration leaves Development byte-identical");
  assert.deepEqual(storage.operations.slice(operationStart).filter(operation => operation.method !== "getItem"), [], "blocked read/migration performs zero writes");
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), 77, "blocked read/migration does not bump mutation epoch");
  assert.equal(cloudEvents, 0);

  runtime.PersistenceRecoveryGuard.bindUid(null);
  const epochBeforeMigration = runtime.PersistenceRecoveryGuard.readEpoch();
  const migrated = runtime.DevelopmentV2.migrateStoredState();
  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.deferred, false);
  const canonicalRaw = storage.getItem(key);
  const canonical = JSON.parse(canonicalRaw);
  assert.equal(canonical.schemaVersion, runtime.DevelopmentV2.SCHEMA_VERSION);
  assert.equal(canonical.cupsBySeason.ie1, 4);
  assert.equal(canonical.legacyCups, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(canonical, "cups"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(canonical, "projectBuild"), false);
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), epochBeforeMigration + 1, "explicit migration reserves exactly one mutation epoch");
  assert.equal(cloudEvents, 1, "successful explicit migration emits the normal Development save event once");

  const epochAfterMigration = runtime.PersistenceRecoveryGuard.readEpoch();
  const operationBeforeRetry = storage.operations.length;
  const retry = runtime.DevelopmentV2.migrateStoredState();
  assert.equal(retry.ok, true);
  assert.equal(retry.migrated, false, "explicit migration is idempotent");
  assert.equal(storage.getItem(key), canonicalRaw);
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), epochAfterMigration, "idempotent retry does not reserve a new epoch");
  assert.deepEqual(storage.operations.slice(operationBeforeRetry).filter(operation => operation.method !== "getItem"), [], "idempotent retry performs no write");
  assert.equal(cloudEvents, 1);
}

{
  const storage = new BudgetStorage();
  const runtime = load(storage);
  const key = runtime.DevelopmentV2.STORAGE_KEY;
  const corrupt = "{not-json";
  storage.setItem(key, corrupt);
  const operationStart = storage.operations.length;
  const status = runtime.DevelopmentV2.migrationStatus();
  assert.equal(status.valid, false);
  assert.equal(status.error, "invalid-json");
  const result = runtime.DevelopmentV2.migrateStoredState();
  assert.equal(result.ok, false);
  assert.equal(result.migrated, false);
  assert.equal(result.reason, "invalid-json");
  assert.equal(storage.getItem(key), corrupt, "explicit migration never overwrites an unreadable Development payload");
  assert.deepEqual(storage.operations.slice(operationStart).filter(operation => operation.method !== "getItem"), []);
}

  {
    const uid = "development-home-recovery-user";
    const storage = new BudgetStorage();
    const seed = load(storage);
    const run = seed.RunState.createRun({ name: "IE1" }, "ie1");
    seed.RunState.save(run);
    const key = seed.DevelopmentV2.STORAGE_KEY;
    const rawBefore = legacyState();
    storage.setItem(key, rawBefore);
    storage.setItem(seed.PersistenceRecoveryGuard.EPOCH_KEY, "91");
    storage.setItem(`inazuma.cloud.restoreTerminal.${uid}`, JSON.stringify({ operationId: "home-recovery" }));

    const runtime = load(storage, { fullRuntime: true, seasonId: "ie1", seasonDb: { seasonId: "ie1", players: [], teams: [], formations: { eleven: [] }, bossOrder: [] } });
    assert.equal(storage.getItem(key), rawBefore, "full runtime bootstrap must not persist Development normalization before auth recovery binding");
    runtime.context.PersistenceRecoveryGuard.bindUid(uid);
    assert.equal(runtime.context.PersistenceRecoveryGuard.isBlocked(), true);
    const epochBeforeHome = runtime.context.PersistenceRecoveryGuard.readEpoch();
    const operationStart = storage.operations.length;
    await assert.doesNotReject(() => runtime.context.__INAZUMA_UI_TEST__.renderHome());
    assert.equal(storage.getItem(key), rawBefore, "Home/Account bootstrap during recovery leaves Development byte-identical");
    assert.deepEqual(storage.operations.slice(operationStart).filter(operation => operation.method !== "getItem"), [], "Home/Account recovery bootstrap performs no Development or other storage write");
    assert.equal(runtime.context.PersistenceRecoveryGuard.readEpoch(), epochBeforeHome);
  }

  console.log("DevelopmentV2 read-only safety and explicit guarded migration: ok");
})().catch(error => { console.error(error); process.exit(1); });
