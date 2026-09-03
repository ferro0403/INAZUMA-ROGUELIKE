"use strict";
const assert = require("assert");
const fs = require("fs");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const roles = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = roles.map((position, index) => ({
  playerId: `dev-p${index}`,
  name: `DEV P${index}`,
  position,
  category: "Normale",
  overall: 50,
  finalOverall: 50,
  stats: {},
}));
const formation = { id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 }, slotRoles: roles };
const seasonDb = {
  seasonId: "ie1",
  players,
  profiles: players,
  teams: [],
  formations: { eleven: [formation] },
  bossOrder: [
    { teamId: "dev-boss-a", teamName: "DEV Boss A", bossLevel: 1, startingXIPlayerIds: players.map((player) => player.playerId) },
    { teamId: "dev-boss-b", teamName: "DEV Boss B", bossLevel: 2, startingXIPlayerIds: players.map((player) => player.playerId) },
    { teamId: "dev-boss-c", teamName: "DEV Boss C", bossLevel: 3, startingXIPlayerIds: players.map((player) => player.playerId) },
  ],
};
function zone(bossIndex = 0, bossId = "dev-boss-a") {
  return {
    bossIndex,
    bossId,
    seed: `dev-shortcut-zone-${bossIndex}`,
    currentNodeId: `zone_${bossIndex}_start`,
    startNodeId: `zone_${bossIndex}_start`,
    pendingNodeId: null,
    completedNodeIds: [`zone_${bossIndex}_start`],
    path: [`zone_${bossIndex}_start`],
    nodes: [{ id: `zone_${bossIndex}_start`, type: "start", layer: 0 }],
    edges: [],
  };
}
function baseRun(id) {
  return {
    version: 2,
    runId: id,
    seasonId: "ie1",
    phase: "map",
    lives: 2,
    gameOver: false,
    bossIndex: 0,
    completedBossIds: [],
    unlockedTeamIds: [],
    completedSpecialMatchIds: [],
    unlockedSpecialTeamIds: [],
    claimedSpecialMatchRewardIds: [],
    permanentEffectOutbox: [],
    roster: players.map((player) => ({ playerId: player.playerId, source: "ie1", level: 0 })),
    lineup: players.map((player) => player.playerId),
    bench: [],
    inventory: [],
    formationId: formation.id,
    fiveVFive: { formation: "none", slots: {} },
    teamIdentity: { name: "DEV Team" },
    statistics: {},
    messages: [],
    currentZone: zone(),
    activeMatch: null,
    pendingBossVictory: null,
    postBossFlow: null,
  };
}
function runtimeWith(storage, id) {
  return load(storage, { run: baseRun(id), seasonDb, locationSearch: "?dev=1" });
}
function generation(runtime) {
  return runtime.context.RunStorage.diagnostics("ie1").canonicalGeneration;
}

class OneShotReadbackStorage extends BudgetStorage {
  arm() { this.armNextPrimary = true; }
  setItem(key, value) {
    super.setItem(key, value);
    if (this.armNextPrimary && String(key).endsWith(":ie1")) {
      this.armNextPrimary = false;
      this.failReadback = true;
    }
  }
  getItem(key) {
    if (this.failReadback && String(key).endsWith(":ie1")) {
      this.failReadback = false;
      const error = new Error("one-shot primary readback failure");
      error.name = "SecurityError";
      throw error;
    }
    return super.getItem(key);
  }
}

// DEV Game Over must obey the same commit-first rule as gameplay navigation.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = runtimeWith(storage, "dev-gameover-quota");
  const beforeGeneration = generation(runtime);
  const beforeMarkup = runtime.seam.getAppMarkup();
  storage.budget = 0;
  const failed = runtime.seam.devGameOverNow();
  assert.equal(failed, false, "DEV Game Over must report failed persistence");
  assert.equal(runtime.canonical.phase, "map", "failed DEV Game Over must not change canonical phase");
  assert.equal(runtime.canonical.gameOver, false);
  assert.equal(runtime.seam.getRun().phase, "map", "runtime must rebase to canonical after failure");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "failed DEV Game Over must not advance UI");
  assert.equal(generation(runtime), beforeGeneration, "failed DEV Game Over creates no generation");

  storage.budget = Infinity;
  assert.equal(runtime.seam.devGameOverNow(), true, "same-runtime retry must commit DEV Game Over");
  assert.equal(runtime.canonical.phase, "gameover");
  assert.equal(runtime.canonical.gameOver, true);
  assert.equal(runtime.canonical.lives, 0);
  assert.equal(generation(runtime), beforeGeneration + 1, "successful DEV Game Over is exactly one gameplay commit");
}

// DEV single-boss skip must not return success when its canonical handoff did not persist.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = runtimeWith(storage, "dev-skip-quota");
  const beforeGeneration = generation(runtime);
  storage.budget = 0;
  const failed = runtime.seam.devSkipCurrentBoss({ renderResult: false, expectedBossIndex: 0 });
  assert.equal(failed, false, "failed DEV boss skip must report false instead of fake success");
  assert.equal(runtime.canonical.bossIndex, 0);
  assert.deepEqual(runtime.canonical.completedBossIds, []);
  assert.equal(runtime.seam.getRun().bossIndex, 0, "failed DEV boss skip rebases runtime");
  assert.equal(generation(runtime), beforeGeneration);

  storage.budget = Infinity;
  assert.equal(runtime.seam.devSkipCurrentBoss({ renderResult: false, expectedBossIndex: 0 }), true);
  assert.equal(runtime.canonical.bossIndex, 1);
  assert(runtime.canonical.completedBossIds.includes("dev-boss-a"));
  assert.equal(runtime.canonical.phase, "map");
  assert.equal(Number(runtime.canonical.currentZone?.bossIndex), 1);
  assert.equal(generation(runtime), beforeGeneration + 1, "one DEV boss skip must be one canonical commit");
}

// Ambiguous readback: canonical may advance, but the failed attempt must not silently turn into a second skip.
{
  const storage = new OneShotReadbackStorage(2_000_000);
  const runtime = runtimeWith(storage, "dev-skip-ambiguous");
  const beforeGeneration = generation(runtime);
  storage.arm();
  const failed = runtime.seam.devSkipCurrentBoss({ renderResult: false, expectedBossIndex: 0 });
  assert.equal(failed, false, "ambiguous verification remains an explicit failed attempt");
  assert.equal(runtime.canonical.bossIndex, 1, "canonical may already own the intended boss skip");
  assert(runtime.canonical.completedBossIds.includes("dev-boss-a"));
  assert.equal(runtime.seam.getRun().bossIndex, 1, "runtime rebases to the advanced canonical state");
  const committedGeneration = generation(runtime);
  assert.equal(committedGeneration, beforeGeneration + 1);

  assert.equal(runtime.seam.devSkipCurrentBoss({ renderResult: false, expectedBossIndex: 0 }), true, "retry of the same mounted DEV action is idempotent");
  assert.equal(runtime.canonical.bossIndex, 1, "retry must not skip the next boss");
  assert.equal(generation(runtime), committedGeneration, "idempotent retry creates no second commit");
}

// Multi-skip is progressive but must stop immediately on a failed sub-commit and never spin on fake success.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = runtimeWith(storage, "dev-multi-skip");
  const beforeGeneration = generation(runtime);
  storage.budget = 0;
  assert.equal(runtime.seam.devSkipToCompletedBosses(2), false, "multi-skip stops on first persistence failure");
  assert.equal(runtime.canonical.bossIndex, 0);
  assert.equal(generation(runtime), beforeGeneration);

  storage.budget = Infinity;
  assert.equal(runtime.seam.devSkipToCompletedBosses(2), true);
  assert.equal(runtime.canonical.bossIndex, 2);
  assert.deepEqual(runtime.canonical.completedBossIds, ["dev-boss-a", "dev-boss-b"]);
  assert.equal(generation(runtime), beforeGeneration + 2, "two requested boss skips create exactly two canonical commits");
}

// Ownership guard: the DEV block must no longer own raw RunState.save calls.
{
  const app = fs.readFileSync("js/app.js", "utf8");
  const start = app.indexOf("  function devSkipCurrentBoss");
  const end = app.indexOf("  function mountRunDevQuickTools", start);
  assert(start >= 0 && end > start, "DEV shortcut block found");
  const block = app.slice(start, end);
  assert.doesNotMatch(block, /RunState\.save\s*\(/, "DEV shortcuts must use the gameplay persistence adapter only");
  assert.match(block, /dev-skip-current-boss/);
  assert.match(block, /dev-gameover-now/);
}

console.log("DEV shortcut persistence hardening: quota rollback/retry, ambiguous idempotence, progressive multi-skip and raw-save ownership OK");
