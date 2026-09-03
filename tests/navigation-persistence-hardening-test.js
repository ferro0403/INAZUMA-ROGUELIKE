"use strict";
// Final regression gate for the navigation persistence boundary introduced by PR #404.
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

// Bottom-nav Squad navigation: failed save blocks UI and rebases runtime; same mounted retry commits once.
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
  assert.equal(runtime.seam.getRun().phase, "map", "failed squad navigation rebases runtime to canonical");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "failed squad navigation does not advance the UI");
  assert.equal(generation(runtime), beforeGeneration, "failed squad navigation creates no canonical generation");

  storage.budget = Infinity;
  button.click();
  assert.equal(runtime.canonical.phase, "squad", "same mounted retry commits squad phase");
  assert.match(runtime.seam.getAppMarkup(), /squad-screen/, "Squad renders only after commit");
  assert.equal(generation(runtime), beforeGeneration + 1, "successful retry commits exactly once");
  runtime.query('[data-nav="squad"]').click();
  assert.equal(generation(runtime), beforeGeneration + 1, "repeated Squad navigation is idempotent");
  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "squad", "refresh/reopen observes committed Squad phase");
  assert.equal(reopened.seam.getRun().phase, "squad", "reopened runtime matches canonical Squad phase");
}

// Stale generation: an external canonical update wins, the mounted UI stays put, then retry preserves it.
{
  const storage = new BudgetStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("nav-squad-stale", "map"), seasonDb });
  runtime.seam.renderMap({ persist: false });
  const button = runtime.query('[data-nav="squad"]');
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);
  const external = runtime.canonical;
  external.messages.push("external-update");
  runtime.context.RunState.save(external);
  assert.equal(generation(runtime), beforeGeneration + 1, "external writer advances canonical generation once");

  assert.doesNotThrow(() => button.click(), "stale-write failure is contained");
  assert.equal(runtime.canonical.phase, "map", "stale navigation does not overwrite external canonical phase");
  assert.equal(runtime.canonical.messages.includes("external-update"), true, "external canonical update is preserved");
  assert.equal(runtime.seam.getRun().phase, "map", "runtime rebases after stale-write");
  assert.equal(runtime.seam.getRun().messages.includes("external-update"), true, "runtime rebases to the external canonical update");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "stale-write never causes false-success navigation");
  assert.equal(generation(runtime), beforeGeneration + 1, "failed stale navigation creates no extra generation");

  button.click();
  assert.equal(runtime.canonical.phase, "squad", "same mounted retry commits after stale recovery");
  assert.equal(runtime.canonical.messages.includes("external-update"), true, "retry preserves external canonical state");
  assert.equal(generation(runtime), beforeGeneration + 2, "retry adds one and only one navigation commit");
  const reopened = runtime.reopen();
  assert.equal(reopened.canonical.phase, "squad", "reopen observes the retried Squad commit");
  assert.equal(reopened.canonical.messages.includes("external-update"), true, "reopen preserves the external update");
}

// Ambiguous readback: canonical may have advanced, but UI must wait for an explicit retry.
{
  const storage = new OneShotReadbackStorage(2_000_000);
  const runtime = load(storage, { run: baseRun("nav-squad-ambiguous", "map"), seasonDb });
  runtime.seam.renderMap({ persist: false });
  const button = runtime.query('[data-nav="squad"]');
  assert(button, "squad button available for ambiguous commit test");
  const beforeMarkup = runtime.seam.getAppMarkup();
  const beforeGeneration = generation(runtime);
  storage.arm();
  assert.doesNotThrow(() => button.click(), "canonical verification failure is contained");
  assert.equal(runtime.canonical.phase, "squad", "ambiguous commit is recovered from canonical storage");
  assert.equal(runtime.seam.getRun().phase, "squad", "runtime rebases to the recovered canonical commit");
  assert.equal(runtime.seam.getAppMarkup(), beforeMarkup, "ambiguous commit never causes false-success navigation");
  assert.equal(generation(runtime), beforeGeneration + 1, "ambiguous commit exists exactly once canonically");

  button.click();
  assert.match(runtime.seam.getAppMarkup(), /squad-screen/, "same mounted retry resumes from recovered canonical state");
  assert.equal(generation(runtime), beforeGeneration + 1, "retry after recovered ambiguous commit does not duplicate the commit");
}

// Source ownership for section-root navigation is intentionally checked statically because the fake DOM
// does not model its delegated binding reliably. The production path must still use the same adapter.
const appSource = fs.readFileSync("js/app.js", "utf8");
const sectionNav = appSource.slice(appSource.indexOf("function navigateToSectionRoot"), appSource.indexOf("function leaveMatchViaSectionRoot"));
const bottomNav = appSource.slice(appSource.indexOf("function bindBottomNav"), appSource.indexOf("function cssEscape"));
assert.doesNotMatch(sectionNav, /RunState\.save/, "section-root navigation has no raw RunState.save ownership");
assert.match(sectionNav, /label: "section-root-map-navigation"/, "map phase uses the gameplay persistence adapter");
assert.match(sectionNav, /run\.phase === "map"/, "map navigation is idempotent when canonical runtime already has the target phase");
assert.match(sectionNav, /renderMap\(\{ persist: false \}\)/, "committed map navigation renders read-only");
assert.doesNotMatch(bottomNav, /RunState\.save/, "Squad bottom navigation has no raw RunState.save ownership");
assert.match(bottomNav, /label: "bottom-nav-squad-navigation"/, "Squad phase uses the gameplay persistence adapter");
assert.match(bottomNav, /run\.phase === "squad"/, "Squad navigation is idempotent when already committed");

console.log("navigation persistence hardening: quota rollback/retry, stale recovery, ambiguous readback, idempotence and reopen OK");
