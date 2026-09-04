"use strict";
const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");
const ie2 = require("../data/IE2_season_compact.json");

const finalBoss = ie2.bossOrder.at(-1);

function legacyCompleteRun(id) {
  return {
    runId: id,
    seasonId: "ie2",
    lives: 2,
    bossIndex: ie2.bossOrder.length,
    phase: "complete",
    completedBossIds: ie2.bossOrder.map((boss) => String(boss.teamId)),
    unlockedTeamIds: [],
    inventory: [],
    roster: [],
    lineup: [],
    bench: [],
    formationId: "4-3-3",
    teamIdentity: { name: "Raimon" },
    statistics: {},
    permanentEffectOutbox: [],
    currentZone: null,
    activeMatch: null,
    pendingBossVictory: null,
    postBossFlow: null,
  };
}

function hallEffects(run) {
  return (run.permanentEffectOutbox || []).filter((effect) => effect.type === "hall-champion");
}

// Hard failure before the finalization entry is canonically proven must not leak Hall effects.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: legacyCompleteRun("final-entry-hard-failure"), seasonDb: ie2 });
  const realSave = runtime.context.RunState.save.bind(runtime.context.RunState);
  runtime.context.RunState.save = () => { const error = new Error("blocked finalization entry save"); error.name = "QuotaExceededError"; throw error; };

  assert.equal(typeof runtime.seam.persistChampionBeforeFinalUi, "function", "terminal production seam exposes the legacy finalization entry");
  assert.doesNotThrow(() => runtime.seam.persistChampionBeforeFinalUi(finalBoss));
  assert.equal(runtime.hall.length, 0, "Hall remains untouched before a verified run commit");
  assert.equal(runtime.canonical.phase, "complete", "failed entry leaves canonical phase unchanged");
  assert.equal(runtime.canonical.finalization, undefined, "failed entry leaves canonical finalization absent");
  assert.equal(runtime.seam.getRun().phase, "complete", "failed entry rebases runtime to canonical phase");
  assert.equal(runtime.seam.getRun().finalization, undefined, "failed entry removes runtime-only finalization state");

  runtime.context.RunState.save = realSave;
  runtime.seam.persistChampionBeforeFinalUi(finalBoss);
  assert.equal(runtime.hall.length, 1, "same-mounted retry writes one Hall champion after commit");
  assert.equal(hallEffects(runtime.canonical).length, 1, "canonical run contains one stable Hall effect");
  assert(["pending", "hall-written", "development-written", "complete"].includes(runtime.canonical.finalization?.status), "retry canonically enters finalization");

  const reopened = runtime.reopen({ seasonDb: ie2 });
  reopened.seam.persistChampionBeforeFinalUi(finalBoss);
  assert.equal(reopened.hall.length, 1, "reopen/retry does not duplicate the Hall champion");
  assert.equal(hallEffects(reopened.canonical).length, 1, "reopen retains one Hall effect receipt");
}

// Ambiguous primary readback: the canonical entry may already exist, but no permanent effect may run until retry.
{
  class OneShotReadbackStorage extends BudgetStorage {
    arm() { this.armNextPrimary = true; }
    setItem(key, value) {
      super.setItem(key, value);
      if (this.armNextPrimary && String(key).endsWith(":ie2")) { this.armNextPrimary = false; this.failReadback = true; }
    }
    getItem(key) {
      if (this.failReadback && String(key).endsWith(":ie2")) {
        this.failReadback = false;
        const error = new Error("one-shot finalization entry readback failure");
        error.name = "SecurityError";
        throw error;
      }
      return super.getItem(key);
    }
  }
  const storage = new OneShotReadbackStorage(2_000_000);
  const runtime = load(storage, { run: legacyCompleteRun("final-entry-ambiguous"), seasonDb: ie2 });
  const realSave = runtime.context.RunState.save.bind(runtime.context.RunState);
  let observed = null;
  let armed = false;
  runtime.context.RunState.save = (run, metadata = {}) => {
    if (!armed) { armed = true; storage.arm(); }
    try { return realSave(run, metadata); } catch (error) { observed ||= error; throw error; }
  };

  runtime.seam.persistChampionBeforeFinalUi(finalBoss);
  assert.equal(observed?.code, "canonical-verification-failed", "entry readback ambiguity is surfaced by RunState");
  assert.equal(runtime.hall.length, 0, "ambiguous entry does not run Hall effect before retry");
  assert.equal(runtime.seam.getRun().phase, "finalization", "runtime rebases to the canonically committed entry");
  assert.equal(runtime.seam.getRun().finalization?.status, "pending", "canonical pending finalization is preserved");
  assert.equal(hallEffects(runtime.canonical).length, 1, "canonical entry already owns exactly one Hall effect");

  runtime.context.RunState.save = realSave;
  runtime.seam.persistChampionBeforeFinalUi(finalBoss);
  assert.equal(runtime.hall.length, 1, "same-mounted retry drains the canonically owned Hall effect once");
  assert.equal(hallEffects(runtime.canonical).length, 1, "retry does not enqueue a second Hall effect");
}

console.log("finalization entry persistence hardening: hard failure, ambiguous commit, same-mounted retry, exact-once Hall and reopen OK");
