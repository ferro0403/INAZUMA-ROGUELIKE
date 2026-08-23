"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { console };
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("js/boss-gameover-runtime.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("js/gameplay-persistence.js", "utf8"), context);
const Runtime = context.BossGameOverRuntime;
const seasonDb = { bossOrder: [{ teamId: "b0" }, { teamId: "b1" }] };
const original = { seasonId: "ie1", storageGeneration: 4, phase: "boss-reward", bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], activeMatch: { type: "boss" }, pendingBossVictory: { bossIndex: 0 }, postBossFlow: { bossIndex: 0, status: "next-zone" }, currentZone: { bossIndex: 0 }, checkpoint: null };
let run = structuredClone(original);
let canonical = structuredClone(original);
let insideMutate = false;
let runStateSaveCallsInsideMutate = 0;
let checkpointCallsInsideMutate = 0;
let outerSaveCalls = 0;
let checkpointFails = true;
const runState = {
  save(current) { if (insideMutate) runStateSaveCallsInsideMutate += 1; outerSaveCalls += 1; current.storageGeneration += 1; canonical = structuredClone(current); },
  createCheckpoint(current) { if (insideMutate) checkpointCallsInsideMutate += 1; if (checkpointFails) throw new Error("checkpoint failure"); current.checkpoint = { bossIndex: current.bossIndex, postBossFlow: current.postBossFlow }; runState.save(current); },
};
const mapEngine = { ensureCurrentZone(current) { current.currentZone = { bossIndex: current.bossIndex, bossId: "b1", currentNodeId: "next", nodes: [], completedNodeIds: [] }; return { generated: true, changed: true }; } };
const mutate = (current) => {
  insideMutate = true;
  try {
    return Runtime.applyBossVictoryHandoffMutation({ run: current, seasonDb, ensureCurrentZoneMutation: (target) => Runtime.ensureCurrentZoneMutation({ run: target, seasonDb, mapEngine }), buildFinalization: () => { throw new Error("not final"); } });
  } finally { insideMutate = false; }
};
const persist = context.GameplayPersistence.create({ getRun: () => run, replaceRun: (next) => { run = next; }, save: (current) => runState.save(current), load: () => structuredClone(canonical), cloneRun: structuredClone });
const committed = persist({ label: "boss-victory-handoff", mutate });
assert.strictEqual(committed.ok, true);
assert.strictEqual(runStateSaveCallsInsideMutate, 0);
assert.strictEqual(checkpointCallsInsideMutate, 0);
assert.strictEqual(outerSaveCalls, 1, "GameplayPersistence is the only canonical commit owner");
assert.strictEqual(canonical.storageGeneration, 5);

// Hard crash boundary: reopen the canonical G+1 without ever creating a checkpoint.
const reopened = structuredClone(canonical);
assert.strictEqual(reopened.bossIndex, 1);
assert.deepStrictEqual(reopened.completedBossIds, ["b0"]);
assert.deepStrictEqual(reopened.unlockedTeamIds, ["b0"]);
assert.strictEqual(reopened.currentZone.bossIndex, 1);
assert.strictEqual(reopened.postBossFlow, null);
assert.strictEqual(reopened.activeMatch, null);
assert.strictEqual(reopened.phase, "map");
assert.strictEqual(reopened.checkpoint, null, "checkpoint is recovery support, not the boss commit");

// A failed post-commit checkpoint cannot change the already successful transaction.
assert.throws(() => runState.createCheckpoint(run), /checkpoint failure/);
assert.strictEqual(committed.ok, true);
assert.deepStrictEqual(canonical, reopened);
checkpointFails = false;
runState.createCheckpoint(run);
assert.deepStrictEqual(run.completedBossIds, ["b0"]);
assert.strictEqual(run.bossIndex, 1);
assert.strictEqual(canonical.storageGeneration, 6);

// Source/wiring audit supplements (and does not replace) the runtime counters above.
const app = fs.readFileSync("js/app.js", "utf8");
const handoff = app.slice(app.indexOf("function finishBossVictoryTransition"), app.indexOf("function devSkipCurrentBoss"));
const mutateSlice = handoff.slice(handoff.indexOf("mutate:"), handoff.indexOf("onCommitted:"));
assert.doesNotMatch(mutateSlice, /RunState\.save|createCheckpoint/);
assert.match(mutateSlice, /ensureCurrentZoneMutation/);
assert.doesNotMatch(mutateSlice, /run: current, seasonDb, ensureCurrentZone[,\s]/);
assert.ok(handoff.indexOf("createPostBossCheckpoint(run)") > handoff.indexOf("if (!committed.ok)"), "checkpoint wiring is strictly post-commit");
console.log("boss-handoff-no-nested-save-test: 0 nested saves, one outer G+1 commit, crash-safe reopen and non-destructive checkpoint failure OK");
