"use strict";
const assert = require("assert"), BudgetStorage = require("./helpers/budget-storage"), { load } = require("./helpers/production-runtime");
const storage = new BudgetStorage(900000), runtime = load(storage, ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js", "persistence-diagnostics.js"]);
const development = runtime.DevelopmentV2.read();
development.evolutionHistory = Array.from({ length: 1000 }, (_, index) => ({ id: `e${index}`, playerId: `p${index % 180}`, playerNameSnapshot: `Veteran ${index}`, fromRarity: "Normale", toRarity: "Buono", timestamp: new Date(1700000000000 + index).toISOString() }));
development.redeemedRunIds = Array.from({ length: 500 }, (_, index) => `old-run-${index}`);
runtime.DevelopmentV2.write(development);
for (const id of ["ie1", "ie2", "ie1_s2", "ie1_s3", "orion"]) { const run = runtime.RunState.createRun({ name: "Veteran" }, id); run.bossIndex = 4; runtime.RunState.save(run); }
const measured = storage.bytes(); assert(measured > 200000, `fixture must exert realistic pressure, got ${measured}`);
storage.budget = Math.ceil(measured / 0.9);
const orion = runtime.RunState.load("orion", { readOnly: true }); orion.bossIndex = 5; runtime.RunState.save(orion);
assert.equal(runtime.RunState.load("orion", { readOnly: true }).bossIndex, 5);
storage.budget = storage.bytes();
const doomed = runtime.RunState.load("ie1_s3", { readOnly: true }); doomed.bossIndex = 6;
assert.throws(() => runtime.RunState.save(doomed), (error) => ["canonical-write-failed", "storage-unavailable"].includes(error.code));
assert.equal(runtime.RunState.load("ie1_s3", { readOnly: true }).bossIndex, 4, "quota failure preserves the victory checkpoint");
console.log(`veteran storage pressure 70/90/near-quota bytes=${measured}: ok`);
