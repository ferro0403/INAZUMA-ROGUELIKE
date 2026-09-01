"use strict";
const assert = require("assert"), policy = require("../js/restore-run-replacement-policy");
const base = { runId: "r", bossIndex: 4, completedBossIds: ["occult", "wild", "brainwashing", "otaku"], currentZone: { currentNodeId: "zone_4_l2_n1" }, checkpoint: { currentZone: { currentNodeId: "zone_4_start" } }, roster: [{ id: "p", level: 7 }], inventory: ["reward"] };
const rollback = { ...base, currentZone: { currentNodeId: "zone_4_start" } };
assert.deepEqual(policy.decide(base, rollback), { allowed: false, reason: "continuation-not-proven" });
assert.equal(policy.decide(base, rollback, { explicitConflictCloud: true }).allowed, true);
assert.equal(policy.decide(base, { ...base, currentZone: { currentNodeId: "zone_5_start" } }, { safeAutomaticReplace: true }).allowed, true);
assert.equal(policy.decide(base, JSON.parse(JSON.stringify(base))).reason, "equivalent");
console.log("restore run replacement requires equivalence, verified ancestry, or explicit confirmation: ok");
