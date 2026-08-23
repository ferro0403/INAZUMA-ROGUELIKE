"use strict";
const assert = require("assert");
const fs = require("fs");
const { createCrashHarness, once } = require("./helpers/crash-harness");

const base = () => ({ runId: "run-v11", phase: "map", lives: 2, bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], roster: [], activeMatch: null, pendingBossVictory: null, postBossFlow: null, currentZone: { bossIndex: 0, currentNodeId: "before-boss", completedNodeIds: [] }, generation: 1 });
const save = (h, run, label) => { h.save(run, label); run.generation += 1; return h.fresh(); };
const start = (run) => { run.phase = "match"; run.activeMatch = { matchId: "boss-0-match", type: "boss", bossIndex: 0, nodeId: "boss-node", state: "pre-match", simulation: { seed: "fixed", valid: true } }; };
const result = (run, winner) => { Object.assign(run.activeMatch, { state: `completed-${winner === "user" ? "victory" : "defeat"}`, result: winner === "user" ? "victory" : "defeat", score: [2, 1], log: [{ minute: "FT" }] }); };
const accept = (run) => { once(run.currentZone.completedNodeIds, "boss-node"); run.pendingBossVictory = { bossIndex: 0, bossId: "boss-0", rewardsRemaining: 2, candidateIds: [] }; run.postBossFlow = { status: "reward", bossIndex: 0, remainingRewards: 2, rewardNumber: 1, candidateIds: [], excludedIds: [] }; };
const candidates = (run) => { run.postBossFlow.candidateIds = ["p1", "p2", "p3"]; run.pendingBossVictory.candidateIds = [...run.postBossFlow.candidateIds]; };
const pick = (run, id) => { once(run.roster, id); run.postBossFlow.remainingRewards -= 1; run.postBossFlow.rewardNumber = 2; run.postBossFlow.candidateIds = []; run.pendingBossVictory.rewardsRemaining = run.postBossFlow.remainingRewards; };
const finish = (run) => { once(run.completedBossIds, "boss-0"); once(run.unlockedTeamIds, "boss-0"); run.bossIndex = Math.max(run.bossIndex, 1); run.currentZone = { bossIndex: 1, currentNodeId: "zone-1-start", completedNodeIds: [] }; run.activeMatch = run.pendingBossVictory = run.postBossFlow = null; run.phase = "map"; };

const points = {};
let h = createCrashHarness(base());
points.P0 = h.fresh();
let run = h.fresh(); start(run); run = save(h, run, "boss-match-start"); points.P1 = h.fresh();
let memoryOnly = h.fresh(); result(memoryOnly, "user"); points.P2 = h.fresh(); assert.strictEqual(points.P2.activeMatch.result, undefined);
run = h.fresh(); result(run, "user"); run = save(h, run, "boss-match-result"); points.P3 = h.fresh(); assert.deepStrictEqual(points.P3.activeMatch.score, [2, 1]);
run = h.fresh(); accept(run); run = save(h, run, "boss-victory-accepted"); points.P4 = h.fresh();
points.P5 = h.fresh(); candidates(run); run = save(h, run, "boss-reward-candidates"); points.P6 = h.fresh(); assert.deepStrictEqual(points.P6.postBossFlow.candidateIds, ["p1", "p2", "p3"]);
pick(run, "p1"); run = save(h, run, "boss-reward-pick-1"); points.P7 = h.fresh(); points.P8 = h.fresh(); assert.deepStrictEqual(points.P8.roster, ["p1"]); assert.strictEqual(points.P8.postBossFlow.remainingRewards, 1);
candidates(run); pick(run, "p2"); run.postBossFlow.status = "next-zone"; run = save(h, run, "boss-rewards-complete"); points.P9 = h.fresh();
finish(run); run = save(h, run, "boss-next-zone"); points.P10 = h.fresh(); assert.strictEqual(points.P10.bossIndex, 1); assert.deepStrictEqual(points.P10.completedBossIds, ["boss-0"]); assert.deepStrictEqual(points.P10.roster, ["p1", "p2"]);

const failed = h.fresh(); failed.bossIndex = 99; assert.throws(() => h.save(failed, "injected", { fail: true })); assert.strictEqual(h.fresh().bossIndex, 1, "failed writes never update canonical state");
for (const point of ["P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]) assert.notStrictEqual(points[point], run, `${point} is a fresh canonical clone`);

const app = fs.readFileSync("js/app.js", "utf8");
assert.match(app, /label: "boss-reward-candidates"/);
assert.match(app, /label: "boss-reward-advance"/);
assert.match(app, /syncPendingBossReward\(flow\)/);
console.log("boss-crash-matrix-test: P0-P10 canonical fresh-runtime boundaries OK");
