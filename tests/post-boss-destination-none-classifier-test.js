"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/boss/boss-flow-controller.js", "utf8"), context, { filename: "boss-flow-controller.js" });

function classify(run) {
  const calls = [];
  const mark = (destination) => (...args) => { calls.push({ destination, args }); return destination; };
  const controller = context.BossFlowControllerRuntime.create({
    getRun: () => run,
    getSeasonDb: () => ({ bossOrder: [] }),
    renderFinalizationPending: mark("finalization-pending"),
    renderFinalSummary: mark("final-summary"),
    renderFinalCelebration: mark("final-celebration"),
    renderSeasonComplete: mark("season-complete"),
    renderMap: mark("map"),
    renderRecoveryView: mark("recovery"),
  });
  const result = controller.navigate({ destination: "none" });
  assert.equal(calls.length, 1, `one canonical destination for phase ${run.phase}`);
  return { result, call: calls[0] };
}

for (const status of ["pending", "hall-written", "development-written"]) {
  const classified = classify({ phase: "finalization", finalization: { status } });
  assert.equal(classified.result, "finalization-pending");
}

const completed = classify({ phase: "complete", finalization: { status: "complete" } });
assert.equal(completed.result, "season-complete");

const celebration = classify({ phase: "final-celebration", hallTeamId: "hall", finalization: { status: "complete" } });
assert.equal(celebration.result, "final-celebration");
assert.deepEqual([...celebration.call.args], ["hall"]);

const summary = classify({ phase: "final-summary", hallTeamId: "hall", finalization: { status: "complete" } });
assert.equal(summary.result, "final-summary");
assert.deepEqual([...summary.call.args], ["hall"]);

const map = classify({ phase: "map", finalization: { status: "complete" } });
assert.equal(map.result, "map");
assert.deepEqual({ ...map.call.args[0] }, { persist: false });

const unknown = classify({ phase: "unexpected", finalization: { status: "complete" } });
assert.equal(unknown.call.destination, "recovery", "unknown canonical states must not silently route to map");

console.log("post-boss destination none: pending, completed terminal, map and unknown states classified canonically");
