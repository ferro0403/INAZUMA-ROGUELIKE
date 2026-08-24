const assert = require("assert"), fs = require("fs"), vm = require("vm");
const sandbox = { console, structuredClone }; sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync("js/permanent-effects.js", "utf8"), sandbox);
assert.throws(() => sandbox.PermanentEffects.enqueueDevelopment({ runId: "r", seasonId: "ie1", phase: "map" }, { endReason: "gameover" }), /terminal proof/i);
const run = { runId: "r", seasonId: "ie1", phase: "finalization", finalization: { status: "hall-written" }, permanentEffectOutbox: [] };
sandbox.PermanentEffects.enqueueDevelopment(run, { endReason: "victory", defeatedBosses: 2 });
let payout = 0, markerFails = true; const redeemed = [];
const development = {
  processRunEnd({ runId }) { if (!redeemed.includes(runId)) { redeemed.push(runId); payout++; } return { state: { redeemedRunIds: redeemed }, awarded: payout === 1 }; },
  read() { return { redeemedRunIds: redeemed }; },
};
let result = sandbox.PermanentEffects.drain(run, { apis: { DevelopmentV2: development }, save() { if (markerFails) throw Error("marker"); } });
assert(result.error); assert.strictEqual(payout, 1); assert.deepStrictEqual(redeemed, ["r"]);
assert.strictEqual(run.permanentEffectOutbox[0].status, "pending"); assert.strictEqual(run.finalization.status, "hall-written");
markerFails = false;
result = sandbox.PermanentEffects.drain(run, { apis: { DevelopmentV2: development }, save() {} });
assert.ifError(result.error); assert.strictEqual(payout, 1); assert.deepStrictEqual(redeemed, ["r"]);
assert.strictEqual(run.permanentEffectOutbox[0].status, "applied"); assert.strictEqual(run.finalization.status, "development-written");
console.log("cross-store development transaction tests passed");
