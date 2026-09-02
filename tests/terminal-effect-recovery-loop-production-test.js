"use strict";

const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const season = require("../data/ORION_season_compact.json");

class OneShotReadbackStorage extends BudgetStorage {
  armVerificationFailure() { this.failAfterPrimaryWrite = true; }
  setItem(key, value) {
    super.setItem(key, value);
    if (this.failAfterPrimaryWrite && String(key).endsWith(":orion")) {
      this.failAfterPrimaryWrite = false;
      this.failReadback = true;
    }
  }
  getItem(key) {
    if (this.failReadback && String(key).endsWith(":orion")) {
      this.failReadback = false;
      const error = new Error("one-shot primary readback failure");
      error.name = "SecurityError";
      throw error;
    }
    return super.getItem(key);
  }
}

function terminal(runId, endReason) {
  const victory = endReason === "victory";
  return {
    version: 2, runId, seasonId: "orion", lives: victory ? 1 : 0,
    gameOver: !victory, phase: victory ? "final-celebration" : "gameover",
    bossIndex: 1, completedBossIds: ["boss"], roster: [], lineup: [], bench: [],
    inventory: [], statistics: {}, teamIdentity: { name: "Raimon" },
    permanentEffectOutbox: [], ...(victory ? { finalization: { status: "complete" } } : {}),
  };
}

function preparePendingEffect(storage, endReason) {
  let runtime = load(storage, { run: terminal(`terminal-ambiguous-${endReason}`, endReason), seasonDb: season });
  const canonical = runtime.context.RunState.load("orion", { readOnly: true });
  runtime.context.PermanentEffects.enqueueDevelopment(canonical, { endReason, defeatedBosses: 1 });
  runtime.context.RunState.save(canonical);
  runtime.destroy();
  return load(storage, { fullRuntime: true, seasonId: "orion", seasonDb: season });
}

for (const endReason of ["gameover", "victory"]) {
  const storage = new OneShotReadbackStorage(Infinity);
  const runtime = preparePendingEffect(storage, endReason);
  const effectId = runtime.context.PermanentEffects.developmentId(runtime.seam.getRun(), endReason);
  let observedError = null;
  const save = runtime.context.RunState.save.bind(runtime.context.RunState);
  runtime.context.RunState.save = (...args) => {
    try { return save(...args); } catch (error) { observedError = error; throw error; }
  };
  storage.armVerificationFailure();
  runtime.seam.resolveDevelopmentEndRunFlow({ endReason, onComplete() {} });

  assert.equal(observedError?.code, "canonical-verification-failed");
  assert.equal(runtime.canonical.permanentEffectOutbox.find(effect => effect.id === effectId)?.status, "applied", "primary marker write is canonical");
  assert.equal(runtime.seam.getRun().permanentEffectOutbox.find(effect => effect.id === effectId)?.status, "applied", "terminal recovery rebases the rolled-back runtime marker from canonical");
  const accountAfterFailure = runtime.context.DevelopmentV2.read();
  assert.equal(accountAfterFailure.redeemedRunIds.filter(id => id === runtime.canonical.runId).length, 1);
  assert.match(runtime.seam.getAppMarkup(), /FINALIZZAZIONE NON SALVATA/);

  const retry = runtime.context.document.getElementById("retry-terminal-effect");
  retry.click();
  assert.match(runtime.seam.getAppMarkup(), /data-development-reward-reveal/, `${endReason}: same-mounted retry trusts the advanced canonical marker`);
  const accountAfterRetry = runtime.context.DevelopmentV2.read();
  assert.equal(accountAfterRetry.coins, accountAfterFailure.coins, `${endReason}: coins are not duplicated`);
  assert.equal(accountAfterRetry.cupsBySeason.orion, accountAfterFailure.cupsBySeason.orion, `${endReason}: cups are not duplicated`);
  assert.equal(accountAfterRetry.redeemedRunIds.filter(id => id === runtime.canonical.runId).length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter(effect => effect.id === effectId).length, 1);
  assert.equal(runtime.canonical.developmentRewardPresentation.seen, false);
}

console.log("terminal effect recovery: ambiguous effectMarker commit rebases canonical for gameover and victory");
