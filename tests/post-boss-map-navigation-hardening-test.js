"use strict";
const assert = require("assert");
const fs = require("fs");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");

const roles = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
const players = roles.map((position, index) => ({
  playerId: `p${index}`,
  name: `P${index}`,
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
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossLevel: 1, startingXIPlayerIds: players.map((player) => player.playerId) }],
};
function zone() {
  return {
    bossIndex: 0,
    bossId: "boss",
    seed: "post-boss-map-hardening",
    currentNodeId: "start",
    startNodeId: "start",
    pendingNodeId: null,
    completedNodeIds: [],
    path: ["start"],
    nodes: [{ id: "start", type: "start", layer: 0 }, { id: "next", type: "item", layer: 1 }],
    edges: [["start", "next"]],
  };
}
function baseRun(id) {
  return {
    version: 2,
    runId: id,
    seasonId: "ie1",
    phase: "squad",
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
    teamIdentity: { name: "Raimon" },
    statistics: {},
    messages: [],
    currentZone: zone(),
    activeMatch: null,
    pendingBossVictory: null,
    postBossFlow: null,
  };
}
function generation(runtime) {
  return runtime.context.RunStorage.diagnostics("ie1").canonicalGeneration;
}
function goMap(runtime) {
  const button = runtime.context.document.getElementById("go-map");
  assert(button, "Squad go-map button available");
  return button;
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

// No PostBoss flow is pending: returning from Squad to Map is still a gameplay phase mutation.
// A failed write must keep canonical, runtime and mounted UI on Squad so the same button can retry.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("post-boss-map-quota"), seasonDb });
  runtime.seam.renderSquad();
  const button = goMap(runtime);
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);

  storage.budget = 0;
  assert.doesNotThrow(() => button.click(), "map navigation persistence failure is contained");
  assert.equal(runtime.canonical.phase, "squad", "failed map navigation leaves canonical phase on Squad");
  assert.equal(runtime.seam.getRun().phase, "squad", "failed map navigation rebases runtime to canonical Squad");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "failed map navigation does not advance the mounted UI");
  assert.equal(generation(runtime), beforeGeneration, "failed map navigation creates no canonical generation");

  storage.budget = Infinity;
  button.click();
  assert.equal(runtime.canonical.phase, "map", "same mounted retry commits Map phase");
  assert.match(runtime.seam.getAppMarkup(), /route-screen/, "Map renders only after the verified commit");
  assert.equal(generation(runtime), beforeGeneration + 1, "successful retry creates exactly one commit");

  const mapButton = runtime.query('[data-nav="map"]');
  assert(mapButton, "Map bottom-nav button available after commit");
  mapButton.click();
  assert.equal(generation(runtime), beforeGeneration + 1, "repeated navigation while already on Map is idempotent");

  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "map", "refresh/reopen observes committed Map phase");
  assert.equal(reopened.seam.getRun().phase, "map", "reopened runtime matches canonical Map phase");
}

// A stale mounted Squad must not overwrite a newer canonical writer. Retry uses the recovered canonical run.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("post-boss-map-stale"), seasonDb });
  runtime.seam.renderSquad();
  const button = goMap(runtime);
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);

  const external = runtime.canonical;
  external.messages.push("external-post-boss-update");
  runtime.context.RunState.save(external);
  assert.equal(generation(runtime), beforeGeneration + 1, "external writer advances canonical generation once");

  assert.doesNotThrow(() => button.click(), "stale map navigation is contained");
  assert.equal(runtime.canonical.phase, "squad", "stale navigation cannot overwrite canonical phase");
  assert.equal(runtime.canonical.messages.includes("external-post-boss-update"), true, "external canonical update survives stale navigation");
  assert.equal(runtime.seam.getRun().phase, "squad", "runtime rebases after stale navigation");
  assert.equal(runtime.seam.getRun().messages.includes("external-post-boss-update"), true, "runtime rebases to newest canonical data");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "stale navigation does not falsely advance UI");
  assert.equal(generation(runtime), beforeGeneration + 1, "stale failure adds no generation");

  button.click();
  assert.equal(runtime.canonical.phase, "map", "same mounted retry commits Map after stale recovery");
  assert.equal(runtime.canonical.messages.includes("external-post-boss-update"), true, "retry preserves newer canonical data");
  assert.equal(generation(runtime), beforeGeneration + 2, "retry creates exactly one navigation commit");
  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "map", "reopen observes retried Map phase");
  assert.equal(reopened.canonical.messages.includes("external-post-boss-update"), true, "reopen preserves external update");
}

// If primary readback fails after the write, canonical recovery may reveal that Map already committed.
// The mounted UI stays on Squad until explicit retry, which must not duplicate the commit.
{
  const storage = new OneShotReadbackStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("post-boss-map-ambiguous"), seasonDb });
  runtime.seam.renderSquad();
  const button = goMap(runtime);
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);

  storage.arm();
  assert.doesNotThrow(() => button.click(), "ambiguous readback failure is contained");
  assert.equal(runtime.canonical.phase, "map", "canonical recovery finds the already committed Map phase");
  assert.equal(runtime.seam.getRun().phase, "map", "runtime rebases to recovered canonical Map phase");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "ambiguous commit does not falsely advance mounted UI");
  assert.equal(generation(runtime), beforeGeneration + 1, "ambiguous write exists exactly once canonically");

  button.click();
  assert.match(runtime.seam.getAppMarkup(), /route-screen/, "same mounted retry resumes from recovered canonical Map");
  assert.equal(generation(runtime), beforeGeneration + 1, "retry after ambiguous recovery creates no duplicate commit");
  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "map", "reopen observes recovered Map commit");
}

const appSource = fs.readFileSync("js/app.js", "utf8");
const start = appSource.indexOf("function resumePostBossFlowOrMap");
const end = appSource.indexOf("function bossVictoryMatch", start);
const source = appSource.slice(start, end);
assert.doesNotMatch(source, /RunState\.save/, "post-boss map fallback has no raw RunState.save ownership");
assert.match(source, /resolvePendingRunFlow\(\{ clearMatch: true \}\)/, "real pending PostBoss flow remains delegated first");
assert.match(source, /label: "post-boss-map-navigation"/, "fallback Map transition uses gameplay persistence adapter");
assert.match(source, /ensureCurrentZoneMutation\(current\)/, "zone normalization is part of the same atomic mutation");
assert.match(source, /renderMap\(\{ persist: false \}\)/, "Map UI is read-only after the verified commit");

console.log("post-boss map navigation hardening: quota, stale, ambiguous readback, same-mounted retry, idempotence and reopen OK");
