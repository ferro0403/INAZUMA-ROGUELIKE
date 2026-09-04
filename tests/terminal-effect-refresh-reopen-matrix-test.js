"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const season = require("../data/ORION_season_compact.json");

class FaultStorage extends BudgetStorage {
  armReadback() { this.readbackAfterPrimary = true; }
  armPrimaryWrite({ persistent = false } = {}) { this.primaryWriteFailure = true; this.persistent = persistent; }
  setItem(key, value) {
    if (this.primaryWriteFailure && String(key).endsWith(":orion")) {
      if (!this.persistent) this.primaryWriteFailure = false;
      const error = new Error("primary storage unavailable"); error.name = "QuotaExceededError"; throw error;
    }
    super.setItem(key, value);
    if (this.readbackAfterPrimary && String(key).endsWith(":orion")) { this.readbackAfterPrimary = false; this.failReadback = true; }
  }
  getItem(key) {
    if (this.failReadback && String(key).endsWith(":orion")) { this.failReadback = false; const error = new Error("readback unavailable"); error.name = "SecurityError"; throw error; }
    return super.getItem(key);
  }
}
function gameover(id) { return { version: 2, runId: id, seasonId: "orion", lives: 0, gameOver: true, phase: "gameover", bossIndex: 1, completedBossIds: ["boss"], roster: [], lineup: [], bench: [], inventory: [], statistics: {}, teamIdentity: { name: "Raimon" }, permanentEffectOutbox: [] }; }
function pendingRuntime(storage, id) {
  let runtime = load(storage, { run: gameover(id), seasonDb: season });
  const run = runtime.context.RunState.load("orion", { readOnly: true });
  runtime.context.PermanentEffects.enqueueDevelopment(run, { endReason: "gameover", defeatedBosses: 1 });
  runtime.context.RunState.save(run); runtime.destroy();
  return load(storage, { fullRuntime: true, seasonId: "orion", seasonDb: season });
}
function assertOnce(runtime, id, effectId, account) {
  const current = runtime.context.DevelopmentV2.read();
  assert.equal(current.coins, account.coins); assert.equal(current.cupsBySeason.orion, account.cupsBySeason.orion);
  assert.equal(current.redeemedRunIds.filter(value => value === id).length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter(effect => effect.id === effectId).length, 1);
  assert(runtime.canonical.developmentRewardPresentation);
}

// A: the primary marker commit is durable. A full reopen already recovered on #384.
{
  const storage = new FaultStorage(Infinity); let runtime = pendingRuntime(storage, "reopen-ambiguous");
  const effectId = runtime.context.PermanentEffects.developmentId(runtime.seam.getRun(), "gameover");
  storage.armReadback(); runtime.seam.renderGameOver();
  assert.equal(runtime.canonical.permanentEffectOutbox.find(effect => effect.id === effectId).status, "applied");
  const account = runtime.context.DevelopmentV2.read(); runtime = runtime.reopen({ seasonDb: season }); runtime.seam.renderGameOver();
  assert.match(runtime.seam.getAppMarkup(), /data-development-reward-reveal/); assertOnce(runtime, "reopen-ambiguous", effectId, account);
}

// B: account receipt is durable but the marker primary write never happened.
{
  const storage = new FaultStorage(Infinity); let runtime = pendingRuntime(storage, "reopen-pending-marker");
  const effectId = runtime.context.PermanentEffects.developmentId(runtime.seam.getRun(), "gameover");
  storage.armPrimaryWrite(); runtime.seam.renderGameOver();
  assert.equal(runtime.canonical.permanentEffectOutbox.find(effect => effect.id === effectId).status, "pending");
  const account = runtime.context.DevelopmentV2.read(); runtime = runtime.reopen({ seasonDb: season }); runtime.seam.renderGameOver();
  assert.match(runtime.seam.getAppMarkup(), /data-development-reward-reveal/); assertOnce(runtime, "reopen-pending-marker", effectId, account);
}

// C: a genuinely unwritable primary remains pending after reopen; no false success.
{
  const storage = new FaultStorage(Infinity); let runtime = pendingRuntime(storage, "reopen-storage-broken");
  storage.armPrimaryWrite({ persistent: true }); runtime.seam.renderGameOver();
  const account = runtime.context.DevelopmentV2.read(); runtime = runtime.reopen({ seasonDb: season }); runtime.seam.renderGameOver();
  assert.match(runtime.seam.getAppMarkup(), /FINALIZZAZIONE NON SALVATA/);
  assert.equal(runtime.context.DevelopmentV2.read().coins, account.coins);
  assert.equal(runtime.context.DevelopmentV2.read().redeemedRunIds.filter(id => id === "reopen-storage-broken").length, 1);
}
console.log("terminal reopen matrix: ambiguous commit and redeemed pending marker recover; real storage failure remains pending");
