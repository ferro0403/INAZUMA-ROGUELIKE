const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const core = require("../js/cloud-save-core");

const storage = new BudgetStorage();
const runtime = load(storage);
let run = runtime.RunState.createRun({ name: "R" }, "ie1");
run.permanentEffectOutbox = [{ id: "p", status: "pending" }];
runtime.RunState.save(run);
runtime.RunState.saveProfilePreferences({ smartAutoLineup: true });
const legacyDevelopment = JSON.stringify({ schemaVersion: 5, coins: 60, cups: 2, projectBuild: { Buono: 1 } });
storage.setItem(runtime.DevelopmentV2.STORAGE_KEY, legacyDevelopment);
const developmentEpoch = runtime.PersistenceRecoveryGuard.readEpoch();
const before = JSON.stringify(run.permanentEffectOutbox);
const start = storage.operations.length;

runtime.RunState.load("ie1", { readOnly: true });
runtime.RunStorage.diagnostics("ie1");
const snapshot = core.readLocalSnapshot(runtime);

const writes = storage.operations.slice(start).filter(operation => operation.method !== "getItem");
assert.deepEqual(writes, []);
assert.equal(JSON.stringify(run.permanentEffectOutbox), before);
assert.equal(storage.getItem(runtime.DevelopmentV2.STORAGE_KEY), legacyDevelopment, "cloud snapshot reads must not persist normalized Development data");
assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), developmentEpoch, "transitive read-only snapshot does not reserve a Development mutation epoch");
assert.equal(snapshot.development.schemaVersion, runtime.DevelopmentV2.SCHEMA_VERSION);
assert.equal(snapshot.development.cupsBySeason.ie1, 2, "cloud still receives the normalized in-memory Development view");
console.log("read-only production RunState/diagnostics/cloud snapshot zero-write: ok");
