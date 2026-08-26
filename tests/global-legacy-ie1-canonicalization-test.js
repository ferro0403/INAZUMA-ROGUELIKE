"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

function legacy(overrides = {}) { return { version: 2, runId: "historic-ie1", phase: "map", lives: 1, bossIndex: 4, roster: [], lineup: [], bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], activeMatch: null, currentZone: { currentNodeId: "zone_4_l2_n1" }, ...overrides }; }
function runtime(storage) { const c = load(storage); c.SEASON1_CONFIG.saveKey = "inazumaRoguelikeSeason1Run_v2"; c.SEASON1_CONFIG.legacySaveKeys = ["inazumaRoguelikeSeason1Run_v1"]; return c; }

{
  const storage = new BudgetStorage(), c = runtime(storage), raw = JSON.stringify(legacy()); storage.setItem("inazumaRoguelikeSeason1Run_v2", raw);
  assert.equal(c.RunState.load("ie1", { readOnly: true }).runId, "historic-ie1");
  const result = c.RunStorage.canonicalizeLegacyPrimary("ie1");
  assert.equal(result.canonicalizationSource, "legacy-equivalent-candidate"); assert.equal(storage.getItem("inazumaRoguelikeSeason1Run_v2"), raw);
  assert.equal(c.RunStorage.diagnostics("ie1").headMatchesCanonical, true); assert.equal(c.RunState.load("ie1", { readOnly: true }).currentZone.currentNodeId, "zone_4_l2_n1");
  const primary = storage.getItem("inazumaRoguelikeSeason1Run_v2:ie1"), head = storage.getItem("inazumaRoguelikeSeason1Run_v2:ie1_head"); c.RunStorage.canonicalizeLegacyPrimary("ie1"); assert.equal(storage.getItem("inazumaRoguelikeSeason1Run_v2:ie1"), primary); assert.equal(storage.getItem("inazumaRoguelikeSeason1Run_v2:ie1_head"), head);
}
{
  const storage = new BudgetStorage(), c = runtime(storage), raw = JSON.stringify(legacy({ version: 1, runId: undefined })); storage.setItem("inazumaRoguelikeSeason1Run_v1", raw);
  const result = c.RunStorage.canonicalizeLegacyPrimary("ie1"), loaded = c.RunState.load("ie1", { readOnly: true });
  assert.match(result.runId, /^legacy_ie1_/); assert.equal(loaded.seasonId, "ie1"); assert.equal(loaded.runId, result.runId); assert.equal(storage.getItem("inazumaRoguelikeSeason1Run_v1"), raw);
}
{
  const storage = new BudgetStorage(), c = runtime(storage), first = JSON.stringify(legacy({ updatedAt: "a" })), equivalent = JSON.stringify(legacy({ updatedAt: "b" })); storage.setItem("inazumaRoguelikeSeason1Run_v2", first); storage.setItem("inazumaRoguelikeSeason1Run_v2_backup", equivalent); assert.equal(c.RunStorage.canonicalizeLegacyPrimary("ie1").migrated, true);
}
{
  const storage = new BudgetStorage(), c = runtime(storage); storage.setItem("inazumaRoguelikeSeason1Run_v2", JSON.stringify(legacy())); storage.setItem("inazumaRoguelikeSeason1Run_v2_backup", JSON.stringify(legacy({ currentZone: { currentNodeId: "zone_4_start" } })));
  assert.throws(() => c.RunStorage.canonicalizeLegacyPrimary("ie1"), error => error.code === "legacy-recovery-required"); assert.equal(storage.getItem("inazumaRoguelikeSeason1Run_v2:ie1"), null);
}
{
  const storage = new BudgetStorage(), c = runtime(storage); storage.setItem("inazumaRoguelikeSeason1Run_v2:ie1", JSON.stringify(legacy({ seasonId: "ie1", runId: "scoped" }))); storage.setItem("inazumaRoguelikeSeason1Run_v2", JSON.stringify(legacy({ runId: "global", currentZone: { currentNodeId: "old" } }))); c.RunStorage.canonicalizeLegacyPrimary("ie1"); assert.equal(c.RunState.load("ie1", { readOnly: true }).runId, "scoped");
}
console.log("global IE1 legacy candidates migrate conservatively and idempotently: ok");
