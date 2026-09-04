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

function terminal(runId) {
  return {
    version: 2, runId, seasonId: "orion", lives: 0,
    gameOver: true, phase: "gameover",
    bossIndex: 1, completedBossIds: ["boss"], roster: [], lineup: [], bench: [],
    inventory: [], statistics: {}, teamIdentity: { name: "Raimon" },
    permanentEffectOutbox: [],
  };
}

function preparePendingEffect(storage) {
  let runtime = load(storage, { run: terminal("terminal-ambiguous-gameover"), seasonDb: season });
  const canonical = runtime.context.RunState.load("orion", { readOnly: true });
  runtime.context.PermanentEffects.enqueueDevelopment(canonical, { endReason: "gameover", defeatedBosses: 1 });
  runtime.context.RunState.save(canonical);
  runtime.destroy();
  return load(storage, { fullRuntime: true, seasonId: "orion", seasonDb: season });
}

{
  const storage = new OneShotReadbackStorage(Infinity);
  const runtime = preparePendingEffect(storage);
  const effectId = runtime.context.PermanentEffects.developmentId(runtime.seam.getRun(), "gameover");
  let observedError = null;
  const save = runtime.context.RunState.save.bind(runtime.context.RunState);
  runtime.context.RunState.save = (...args) => {
    try { return save(...args); } catch (error) { observedError = error; throw error; }
  };
  storage.armVerificationFailure();
  runtime.seam.resolveDevelopmentEndRunFlow({ endReason: "gameover", onComplete() {} });

  assert.equal(observedError?.code, "canonical-verification-failed");
  assert.equal(runtime.canonical.permanentEffectOutbox.find(effect => effect.id === effectId)?.status, "applied", "primary marker write is canonical");
  assert.equal(runtime.seam.getRun().permanentEffectOutbox.find(effect => effect.id === effectId)?.status, "applied", "terminal recovery rebases the rolled-back runtime marker from canonical");
  const accountAfterFailure = runtime.context.DevelopmentV2.read();
  assert.equal(accountAfterFailure.redeemedRunIds.filter(id => id === runtime.canonical.runId).length, 1);
  assert.match(runtime.seam.getAppMarkup(), /FINALIZZAZIONE NON SALVATA/);

  const retry = runtime.context.document.getElementById("retry-terminal-effect");
  retry.click();
  assert.match(runtime.seam.getAppMarkup(), /data-development-reward-reveal/, "same-mounted retry trusts the advanced canonical marker");
  const accountAfterRetry = runtime.context.DevelopmentV2.read();
  assert.equal(accountAfterRetry.coins, accountAfterFailure.coins, "coins are not duplicated");
  assert.equal(accountAfterRetry.cupsBySeason.orion, accountAfterFailure.cupsBySeason.orion, "cups are not duplicated");
  assert.equal(accountAfterRetry.redeemedRunIds.filter(id => id === runtime.canonical.runId).length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter(effect => effect.id === effectId).length, 1);
  assert.equal(runtime.canonical.developmentRewardPresentation.seen, false);
}

// A stale recovery callback is fenced to its original run identity.
{
  const storage = new OneShotReadbackStorage(Infinity);
  const runtime = preparePendingEffect(storage);
  const originalAccount = runtime.context.DevelopmentV2.read();
  runtime.context.DevelopmentAccountV3 = { read: () => runtime.context.DevelopmentV2.read(), processRunEnd() { throw new Error("hold recovery UI"); } };
  runtime.seam.resolveDevelopmentEndRunFlow({ endReason: "gameover", onComplete() {} });
  const staleRetry = runtime.context.document.getElementById("retry-terminal-effect");
  const replacement = terminal("replacement-run");
  replacement.storageGeneration = runtime.canonical.storageGeneration;
  runtime.context.RunState.save(replacement, { replaceRun: true });
  staleRetry.click();
  assert.equal(runtime.canonical.runId, "replacement-run");
  assert.equal(runtime.context.DevelopmentV2.read().redeemedRunIds.includes("replacement-run"), false);
  assert.equal(runtime.context.DevelopmentV2.read().coins, originalAccount.coins);
}

// A transient account failure retries; a persistent account failure remains pending.
for (const persistent of [false, true]) {
  const storage = new OneShotReadbackStorage(Infinity); const runtime = preparePendingEffect(storage);
  const real = runtime.context.DevelopmentV2; let calls = 0;
  runtime.context.DevelopmentAccountV3 = { read: () => real.read(), processRunEnd(payload) { calls += 1; if (persistent || calls === 1) throw new Error("development account unavailable"); return real.processRunEnd(payload); } };
  runtime.seam.resolveDevelopmentEndRunFlow({ endReason: "gameover", onComplete() {} });
  assert.match(runtime.seam.getAppMarkup(), /FINALIZZAZIONE NON SALVATA/);
  assert.equal(runtime.canonical.permanentEffectOutbox.find(effect => effect.type === "development-run-end").status, "pending");
  runtime.context.document.getElementById("retry-terminal-effect").click();
  if (persistent) {
    assert.match(runtime.seam.getAppMarkup(), /FINALIZZAZIONE NON SALVATA/);
    assert.equal(runtime.context.DevelopmentV2.read().redeemedRunIds.length, 0);
  } else {
    assert.match(runtime.seam.getAppMarkup(), /data-development-reward-reveal/);
    assert.equal(runtime.context.DevelopmentV2.read().redeemedRunIds.length, 1);
  }
}

console.log("terminal effect recovery: ambiguous gameover effectMarker commit rebases canonical");
