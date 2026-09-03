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

const appSource = fs.readFileSync("js/app.js", "utf8");
const start = appSource.indexOf("function resumePostBossFlowOrMap");
const end = appSource.indexOf("function bossVictoryMatch", start);
const source = appSource.slice(start, end);
assert.doesNotMatch(source, /RunState\.save/, "post-boss map fallback has no raw RunState.save ownership");
assert.match(source, /resolvePendingRunFlow\(\{ clearMatch: true \}\)/, "real pending PostBoss flow remains delegated first");
assert.match(source, /label: "post-boss-map-navigation"/, "fallback Map transition uses gameplay persistence adapter");
assert.match(source, /ensureCurrentZoneMutation\(current\)/, "zone normalization is part of the same atomic mutation");
assert.match(source, /renderMap\(\{ persist: false \}\)/, "Map UI is read-only after the verified commit");

console.log("post-boss map navigation hardening: failure rollback, same-mounted retry, idempotence and reopen OK");
