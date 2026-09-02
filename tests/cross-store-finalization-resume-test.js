const assert = require("assert"), fs = require("fs"), vm = require("vm");
const sandbox = { console, structuredClone }; sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync("js/permanent-effects.js", "utf8"), sandbox);
const PE = sandbox.PermanentEffects;
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture(status = "pending") {
  const run = { runId: "victory", seasonId: "ie1", phase: "finalization", completedBossIds: ["b1"], finalization: { status, hallTeamId: "hall_victory" }, permanentEffectOutbox: [] };
  if (status === "pending") PE.enqueueHall(run, { runId: run.runId, seasonId: run.seasonId, archiveKey: "ie1:victory", hallTeamId: "hall_victory" });
  const state = { canonical: clone(run), halls: new Map(), redeemed: [], hallCalls: 0, devCalls: 0, failHall: false, failMarker: null, failComplete: false };
  const apis = {
    HallOfFameStorage: { addChampion(snapshot) { state.hallCalls++; if (state.failHall) return { persisted: false }; if (!state.halls.has(snapshot.archiveKey)) state.halls.set(snapshot.archiveKey, snapshot); return { persisted: true, created: state.halls.size === 1, team: state.halls.get(snapshot.archiveKey) }; } },
    DevelopmentV2: { processRunEnd({ runId }) { state.devCalls++; if (!state.redeemed.includes(runId)) state.redeemed.push(runId); return { awarded: state.devCalls === 1, state: { redeemedRunIds: state.redeemed } }; }, read() { return { redeemedRunIds: state.redeemed }; } },
  };
  const save = (current, metadata = {}) => {
    if ((state.failMarker && metadata.effectMarker?.includes(state.failMarker)) || (state.failComplete && metadata.finalizationComplete)) throw Error("injected save failure");
    state.canonical = clone(current);
  };
  return { run, state, apis, save };
}

// F1: a canonical pending snapshot reaches completion in strict Hall -> Development -> Complete order.
{
  const f = fixture(); const result = PE.resumeFinalization(f.run, f);
  assert.strictEqual(result.completed, true); assert.strictEqual(f.state.canonical.finalization.status, "complete");
  assert.strictEqual(f.state.canonical.phase, "final-celebration"); assert.strictEqual(f.state.halls.size, 1); assert.strictEqual(f.state.redeemed.length, 1);
}
// F2: Hall failure gates Development and completion.
{
  const f = fixture(); f.state.failHall = true; const result = PE.resumeFinalization(f.run, f);
  assert.strictEqual(result.completed, false); assert.strictEqual(f.run.finalization.status, "pending"); assert.strictEqual(f.state.devCalls, 0);
}
// F3: Hall succeeds, its marker fails, memory and canonical stay pending; same-runtime retry is idempotent.
{
  const f = fixture(); f.state.failMarker = ":hall:"; let result = PE.resumeFinalization(f.run, f);
  assert.strictEqual(result.completed, false); assert.strictEqual(f.state.halls.size, 1); assert.strictEqual(f.run.finalization.status, "pending");
  assert.strictEqual(f.state.canonical.finalization.status, "pending"); assert.strictEqual(f.state.devCalls, 0); assert.strictEqual(f.run.permanentEffectOutbox[0].status, "pending");
  f.state.failMarker = null; result = PE.resumeFinalization(f.run, f); assert.strictEqual(result.completed, true); assert.strictEqual(f.state.halls.size, 1);
}
// F4: a fresh hall-written runtime does not rewrite Hall and pays Development once.
{
  const f = fixture("hall-written"); const fresh = clone(f.state.canonical); const result = PE.resumeFinalization(fresh, f);
  assert.strictEqual(result.completed, true); assert.strictEqual(f.state.hallCalls, 0); assert.strictEqual(f.state.devCalls, 1);
}
// F5: Development marker failure rolls memory back; retry does not duplicate payout.
{
  const f = fixture("hall-written"); f.state.failMarker = ":development:"; let result = PE.resumeFinalization(f.run, f);
  assert.strictEqual(result.completed, false); assert.strictEqual(f.run.finalization.status, "hall-written"); assert.strictEqual(f.state.canonical.finalization.status, "hall-written");
  assert.strictEqual(f.state.redeemed.length, 1); assert.strictEqual(f.run.permanentEffectOutbox[0].status, "pending");
  f.state.failMarker = null; result = PE.resumeFinalization(f.run, f); assert.strictEqual(result.completed, true); assert.strictEqual(f.state.redeemed.length, 1);
}
// F6/F7: fresh development-written only commits completion; complete resumes perform zero permanent writes.
{
  const f = fixture("development-written"); let result = PE.resumeFinalization(clone(f.state.canonical), f);
  assert.strictEqual(result.completed, true); assert.strictEqual(f.state.hallCalls, 0); assert.strictEqual(f.state.devCalls, 0);
  const complete = clone(f.state.canonical); result = PE.resumeFinalization(complete, f);
  assert.strictEqual(result.completed, true); assert.strictEqual(f.state.hallCalls, 0); assert.strictEqual(f.state.devCalls, 0);
  result = PE.resumeFinalization(complete, { ...f, readOnly: true }); assert.strictEqual(result.status, "read-only");
}
// Completion save failure restores the durable development-written checkpoint.
{
  const f = fixture("development-written"); f.state.failComplete = true; const result = PE.resumeFinalization(f.run, f);
  assert.strictEqual(result.completed, false); assert.strictEqual(f.run.phase, "finalization"); assert.strictEqual(f.run.finalization.status, "development-written");
}

const app = fs.readFileSync("js/app.js", "utf8");
const resumeStart = app.indexOf("async function resumeRun()");
const finalizationRoute = app.indexOf('run.phase === "finalization"', resumeStart);
const genericRouter = app.indexOf('run.gameOver || run.phase === "gameover"', resumeStart);
assert(resumeStart >= 0 && finalizationRoute > resumeStart && finalizationRoute < genericRouter, "writable finalization resume must precede the generic phase router");
const finalizationController = fs.readFileSync("js/finalization/finalization-controller.js", "utf8");
assert(finalizationController.includes("function resume({ render = true } = {})"));
assert.match(app, /finalization\.completed \? \{ destination: "season-complete"/);
console.log("cross-store finalization resume tests passed");
