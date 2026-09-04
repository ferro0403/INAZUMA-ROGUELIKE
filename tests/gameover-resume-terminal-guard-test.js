"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadController(counters) {
  const context = {
    console,
    structuredClone,
    RunState: { clone: structuredClone },
    MapEngine: {
      normalizeSpecialMatchNode: () => {
        counters.normalizations += 1;
        return false;
      },
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync("js/run-entry/run-resume-controller.js", "utf8"),
    context,
  );
  return context.RunResumeController;
}

async function route(run, counters) {
  let destination = null;
  const go = (name) => () => {
    destination = name;
  };
  const RunResumeController = loadController(counters);
  const controller = RunResumeController.create({
    getRun: () => run,
    getActiveSeason: () => ({ id: "ie1" }),
    getSeasonDb: () => ({}),
    selectSeason: async () => {},
    renderHome: go("Home"),
    resumeFinalization: go("Finalization"),
    persistGameplayMutation: () => {
      counters.persistence += 1;
      return { ok: true };
    },
    renderMapFailureRecovery: go("MapFailure"),
    recoverInterruptedMatchAccess: () => {
      counters.recoveries += 1;
      return { ok: true };
    },
    renderGameOver: go("GameOver"),
    renderFormationChoice: go("Formation"),
    renderDraft: go("Draft"),
    showSpecialMatchReward: go("Special Reward"),
    resumePostBossFlow: go("PostBoss"),
    renderFinalSummary: go("Final Summary"),
    renderFinalCelebration: go("Final Celebration"),
    renderSquad: go("Squad"),
    renderFiveVFive: go("5v5"),
    renderInventory: go("Inventory"),
    setMatchUi: () => {},
    renderMatch: go("Match"),
    ensureCurrentZone: () => ({ ok: true, seasonComplete: false }),
    renderSeasonComplete: go("Season Complete"),
    resumePendingItemReward: () => false,
    renderMap: go("Map"),
  });
  await controller.resumeRun();
  return destination;
}

function counters() {
  return { normalizations: 0, recoveries: 0, persistence: 0 };
}

(async () => {
  const bossTerminal = {
    seasonId: "ie1",
    phase: "gameover",
    gameOver: true,
    lives: 0,
    activeMatch: null,
    currentZone: {
      pendingNodeId: "boss-node",
      nodes: [{ id: "boss-node", type: "boss" }],
    },
  };
  const bossCounters = counters();
  assert.equal(await route(bossTerminal, bossCounters), "GameOver");
  assert.deepStrictEqual(
    bossCounters,
    { normalizations: 0, recoveries: 0, persistence: 0 },
    "terminal GameOver must preempt every match recovery/normalization write",
  );
  assert.equal(bossTerminal.activeMatch, null);
  assert.equal(bossTerminal.phase, "gameover");

  const specialTerminal = {
    seasonId: "ie1",
    phase: "map",
    gameOver: true,
    lives: 0,
    activeMatch: null,
    currentZone: {
      pendingNodeId: "special-node",
      nodes: [{ id: "special-node", type: "special_match" }],
    },
  };
  const specialCounters = counters();
  assert.equal(await route(specialTerminal, specialCounters), "GameOver");
  assert.deepStrictEqual(
    specialCounters,
    { normalizations: 0, recoveries: 0, persistence: 0 },
    "gameOver flag must also preempt Special Match recovery",
  );

  const liveRun = { seasonId: "ie1", phase: "map", gameOver: false };
  const liveCounters = counters();
  assert.equal(await route(liveRun, liveCounters), "Map");
  assert.equal(liveCounters.normalizations, 1, "non-terminal resume still probes normalization");
  assert.equal(liveCounters.recoveries, 1, "non-terminal resume still executes match recovery");

  console.log("gameover resume terminal guard: Boss/Special recovery cannot resurrect matches after terminal state");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
