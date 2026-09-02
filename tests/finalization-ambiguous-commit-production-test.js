"use strict";
const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");
const ie2 = require("../data/IE2_season_compact.json");

class OneShotReadbackStorage extends BudgetStorage {
  arm() { this.armNextPrimary = true; }
  setItem(key, value) { super.setItem(key, value); if (this.armNextPrimary && String(key).endsWith(":ie2")) { this.armNextPrimary = false; this.failReadback = true; } }
  getItem(key) { if (this.failReadback && String(key).endsWith(":ie2")) { this.failReadback = false; const error = new Error("one-shot primary readback failure"); error.name = "SecurityError"; throw error; } return super.getItem(key); }
}
const finalBoss = ie2.bossOrder.at(-1);
function finalBossRun(id) { return { runId: id, seasonId: "ie2", lives: 2, bossIndex: ie2.bossOrder.length - 1, phase: "match", completedBossIds: ie2.bossOrder.slice(0, -1).map(x => x.teamId), unlockedTeamIds: [], inventory: [], roster: [], lineup: [], bench: [], formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, permanentEffectOutbox: [], currentZone: { nodes: [{ id: "barcelona-final", type: "boss" }], path: [], completedNodeIds: [] }, activeMatch: { matchId: `${id}-match`, type: "boss", bossIndex: ie2.bossOrder.length - 1, nodeId: "barcelona-final", state: "playing", simulation: { resolutionApplied: false, score: { user: 2, opponent: 1 } } } }; }
function reachRealFinalization(storage, id) {
  const runtime = load(storage, { run: finalBossRun(id), seasonDb: ie2 }); const flow = runtime.seam;
  flow.completeBossMatch("victory"); flow.resolvePendingRunFlow({ clearMatch: true });
  while (flow.getRun().postBossFlow?.remainingRewards > 1) flow.advanceBossReward();
  return runtime;
}
function injectVerificationFailure(runtime, predicate) {
  const storage = runtime.context.localStorage; const realSave = runtime.context.RunState.save.bind(runtime.context.RunState); let error = null; let armed = false;
  runtime.context.RunState.save = (run, metadata = {}) => {
    if (!armed && predicate(metadata)) { armed = true; storage.arm(); }
    try { return realSave(run, metadata); } catch (caught) { if (!error) error = caught; throw caught; }
  };
  return () => error;
}
for (const scenario of [
  { name: "hall-effect-marker", match: metadata => String(metadata.effectMarker || "").includes(":hall:") },
  { name: "development-effect-marker", match: metadata => String(metadata.effectMarker || "").includes(":development:victory") },
  { name: "finalization-complete", match: metadata => metadata.finalizationComplete === true },
]) {
  const storage = new OneShotReadbackStorage(2_000_000); const runtime = reachRealFinalization(storage, `final-${scenario.name}`);
  const observed = injectVerificationFailure(runtime, scenario.match);
  while (runtime.seam.getRun().postBossFlow?.remainingRewards > 0) runtime.seam.advanceBossReward();
  if (!/retry-run-finalization/.test(runtime.seam.getAppMarkup())) {
    runtime.seam.continueAfterMatch({ preventDefault() {} });
    const transition = runtime.seam.finishBossVictoryTransition();
    runtime.seam.navigateBossVictoryDestination(transition || { destination: "season-complete" });
  }
  assert.equal(observed()?.code, "canonical-verification-failed", scenario.name);
  assert.match(runtime.seam.getAppMarkup(), /retry-run-finalization/);
  const canonicalStatus = runtime.canonical.finalization.status;
  assert(["hall-written", "development-written", "complete"].includes(canonicalStatus), `${scenario.name}: canonical advanced`);
  runtime.context.document.getElementById("retry-run-finalization").click();
  assert.equal(runtime.canonical.finalization.status, "complete", `${scenario.name}: same-mounted retry completes`);
  assert.match(runtime.seam.getAppMarkup(), /data-development-reward-reveal/);
  assert.equal(runtime.hall.length, 1, `${scenario.name}: one Hall champion`);
  const account = runtime.context.DevelopmentV2.read();
  assert.equal(account.redeemedRunIds.filter(id => id === runtime.canonical.runId).length, 1);
  assert.equal(account.victoryRewardRunIds.filter(id => id === runtime.canonical.runId).length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter(effect => effect.type === "hall-champion").length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter(effect => effect.type === "development-run-end").length, 1);
}
assert.equal(finalBoss.teamId, "barcelona_orb");
console.log("real finalization ambiguous commits: Hall marker, Development marker and completion retry canonically");
