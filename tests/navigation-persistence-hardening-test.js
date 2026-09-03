"use strict";
const assert = require("assert");
const fs = require("fs");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");

const players = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"].map((position, index) => ({
  playerId: `p${index}`,
  name: `P${index}`,
  position,
  category: "Normale",
  overall: 50,
  finalOverall: 50,
  stats: {},
}));
const seasonDb = {
  seasonId: "ie1",
  players,
  teams: [],
  formations: { eleven: [{ id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 } }] },
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossLevel: 1, startingXIPlayerIds: players.map((player) => player.playerId) }],
};
function zone() {
  return {
    bossIndex: 0,
    bossId: "boss",
    seed: "navigation-hardening",
    currentNodeId: "start",
    startNodeId: "start",
    pendingNodeId: null,
    completedNodeIds: [],
    path: ["start"],
    nodes: [{ id: "start", type: "start", layer: 0 }, { id: "next", type: "item", layer: 1 }],
    edges: [["start", "next"]],
  };
}
function baseRun(id, phase) {
  return {
    runId: id,
    seasonId: "ie1",
    phase,
    lives: 2,
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
    formationId: "4-3-3",
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
function sectionRoot(runtime) {
  const button = runtime.query("[data-section-root]");
  assert(button, "section-root button available");
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

// Leaving a run is read-only: navigation must never flush arbitrary in-memory state.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("nav-season-selection", "squad"), seasonDb });
  runtime.seam.renderSquad();
  const beforeGeneration = generation(runtime);
  runtime.seam.getRun().messages.push("transient-runtime-only");
  sectionRoot(runtime).click();
  assert.match(runtime.seam.getAppMarkup(), /season-select-screen/, "season selection opens");
  assert.equal(generation(runtime), beforeGeneration, "read-only exit does not create a run commit");
  assert.equal(runtime.canonical.phase, "squad", "canonical phase is unchanged");
  assert.equal(runtime.canonical.messages.includes("transient-runtime-only"), false, "uncommitted runtime state is never flushed by navigation");
}

// Section-root map navigation: failed save blocks UI and rebases runtime; same mounted retry commits once.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("nav-map-quota", "squad"), seasonDb });
  runtime.seam.renderSquad();
  const button = sectionRoot(runtime);
  button.dataset.sectionRoot = "match";
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);
  storage.budget = 0;
  assert.doesNotThrow(() => button.click(), "quota failure is contained by the gameplay persistence boundary");
  assert.equal(runtime.canonical.phase, "squad", "failed map navigation does not change canonical phase");
  assert.equal(runtime.seam.getRun().phase, "squad", "runtime is rebased to canonical after failure");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "failed map navigation does not advance the UI");
  assert.equal(generation(runtime), beforeGeneration, "failed map navigation creates no canonical generation");

  storage.budget = Infinity;
  button.click();
  assert.equal(runtime.canonical.phase, "map", "same mounted retry commits map phase");
  assert.match(runtime.seam.getAppMarkup(), /route-screen/, "UI advances only after the map commit");
  assert.equal(generation(runtime), beforeGeneration + 1, "successful retry commits exactly once");
  button.click();
  assert.equal(generation(runtime), beforeGeneration + 1, "repeated navigation to the already committed phase is idempotent");
  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "map", "refresh/reopen observes the committed map phase");
  assert.equal(reopened.seam.getRun().phase, "map", "reopened runtime matches canonical map phase");
}

// Bottom-nav Squad navigation obeys the same atomic boundary and preserves a same-mounted retry.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("nav-squad-quota", "map"), seasonDb });
  runtime.seam.renderMap({ persist: false });
  const button = runtime.query('[data-nav="squad"]');
  assert(button, "squad bottom-nav button available");
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);
  storage.budget = 0;
  assert.doesNotThrow(() => button.click(), "squad quota failure is contained");
  assert.equal(runtime.canonical.phase, "map", "failed squad navigation leaves canonical phase on map");
  assert.equal(runtime.seam.getRun().phase, "map", "failed squad navigation rebases runtime");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "failed squad navigation does not advance the UI");
  assert.equal(generation(runtime), beforeGeneration, "failed squad navigation creates no generation");

  storage.budget = Infinity;
  button.click();
  assert.equal(runtime.canonical.phase, "squad", "same mounted retry commits squad phase");
  assert.match(runtime.seam.getAppMarkup(), /squad-screen/, "Squad renders only after commit");
  assert.equal(generation(runtime), beforeGeneration + 1, "squad retry commits exactly once");
  runtime.query('[data-nav="squad"]').click();
  assert.equal(generation(runtime), beforeGeneration + 1, "repeated Squad navigation is idempotent");
  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "squad", "refresh/reopen observes committed Squad phase");
}

// Ambiguous readback: canonical may have advanced, but UI must wait for an explicit retry.
{
  const storage = new OneShotReadbackStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("nav-map-ambiguous", "squad"), seasonDb });
  runtime.seam.renderSquad();
  const button = sectionRoot(runtime);
  button.dataset.sectionRoot = "match";
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);
  storage.arm();
  assert.doesNotThrow(() => button.click(), "canonical verification failure is contained");
  assert.equal(runtime.canonical.phase, "map", "ambiguous commit is recovered from canonical storage");
  assert.equal(runtime.seam.getRun().phase, "map", "runtime rebases to the recovered canonical commit");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "ambiguous commit never causes false-success navigation");
  assert.equal(generation(runtime), beforeGeneration + 1, "ambiguous commit exists exactly once canonically");
  button.click();
  assert.match(runtime.seam.getAppMarkup(), /route-screen/, "same mounted retry resumes from recovered canonical state");
  assert.equal(generation(runtime), beforeGeneration + 1, "retry after recovered ambiguous commit does not duplicate the commit");
}

const appSource = fs.readFileSync("js/app.js", "utf8");
const sectionNav = appSource.slice(appSource.indexOf("function navigateToSectionRoot"), appSource.indexOf("function leaveMatchViaSectionRoot"));
const bottomNav = appSource.slice(appSource.indexOf("function bindBottomNav"), appSource.indexOf("function cssEscape"));
assert.doesNotMatch(sectionNav, /RunState\.save/, "section-root navigation has no raw RunState.save ownership");
assert.match(sectionNav, /label: "section-root-map-navigation"/, "map phase uses the gameplay persistence adapter");
assert.match(sectionNav, /renderMap\(\{ persist: false \}\)/, "committed map navigation renders read-only");
assert.doesNotMatch(bottomNav, /RunState\.save/, "Squad bottom navigation has no raw RunState.save ownership");
assert.match(bottomNav, /label: "bottom-nav-squad-navigation"/, "Squad phase uses the gameplay persistence adapter");

console.log("navigation persistence hardening: read-only exit, quota rollback/retry, idempotence, reopen and ambiguous readback OK");
