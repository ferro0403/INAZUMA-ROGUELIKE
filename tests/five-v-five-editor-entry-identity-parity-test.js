"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { globalThis: null, document: {} }; context.globalThis = context; vm.createContext(context);
for (const file of ["js/five-v-five/five-v-five-controller.js", "js/five-v-five/five-v-five-view.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
let run; let identityChecks; let recoveryCalls; let stale;
const persistMutation = options => {
  const current = structuredClone(run);
  try { const value = options.mutate(current); run = current; return { ok: true, value }; }
  catch (error) { options.rerender?.({ ok: false }); return { ok: false, error }; }
};
function harness() {
  run = { phase: "match", roster: [{ playerId: "p" }], activeMatch: { type: "five_v_five", matchId: "match-1", nodeId: "five", attemptNumber: 1 } };
  identityChecks = 0; recoveryCalls = 0; stale = false;
  const controller = context.FiveVFiveControllerRuntime.create({
    getRun: () => run, fiveVFive: { ensure: current => (current.fiveVFive ||= { formation: "x", slots: {} }), validate: () => ({ valid: true }) },
    getRole: () => "MF", getOverall: () => 1, smartLineup: {}, getPreferences: () => ({}), formationById: () => ({}), toast() {}, persistMutation,
    matchIdentity: match => ({ matchId: match.matchId }),
    canonicalMatch: (_current, identity) => { identityChecks += 1; if (stale || identity.matchId !== "match-1") throw new Error("stale match"); },
    onPersistenceFailure: () => { recoveryCalls += 1; },
  });
  const view = context.FiveVFiveViewRuntime.create({ getRun: () => run, getUi: () => ({}), controller, renderMapFailureRecovery: () => { recoveryCalls += 1; } });
  return view;
}
// A: old entry semantics did not guard an unrelated/non-return editor entry.
let view = harness(); assert.equal(view.open({ returnToMatch: false }).ok, true); assert.equal(identityChecks, 0); assert.equal(run.phase, "five");
// B: returning from a live 5v5 match retains the canonical match identity guard.
view = harness(); assert.equal(view.open({ returnToMatch: true }).ok, true); assert.equal(identityChecks, 1); assert.equal(run.phase, "five");
// C: a stale return-to-match identity rejects the mutation and follows recovery.
view = harness(); stale = true; assert.equal(view.open({ returnToMatch: true }).ok, false); assert.equal(identityChecks, 1); assert.equal(run.phase, "match"); assert.equal(recoveryCalls, 1);
console.log("five editor entry identity parity: unguarded normal entry, guarded return and stale recovery OK");
