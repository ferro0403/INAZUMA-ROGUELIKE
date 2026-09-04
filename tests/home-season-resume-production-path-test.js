"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};

function routingMatrix() {
  const context = {
    console,
    structuredClone,
    RunState: { clone: structuredClone },
    MapEngine: { normalizeSpecialMatchNode: () => false },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync("js/run-entry/run-resume-controller.js", "utf8"),
    context,
  );

  async function route(run) {
    let destination = null;
    const go = (name) => () => {
      destination = name;
    };
    const controller = context.RunResumeController.create({
      getRun: () => run,
      getActiveSeason: () => ({ id: "ie1" }),
      getSeasonDb: () => ({}),
      selectSeason: async () => {},
      renderHome: go("Home"),
      resumeFinalization: go("Finalization"),
      persistGameplayMutation: () => ({ ok: true }),
      renderMapFailureRecovery: go("MapFailure"),
      recoverInterruptedMatchAccess: () => ({ ok: true }),
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
      resumePendingItemReward: () =>
        run.pendingItemReward ? ((destination = "Pending Item"), true) : false,
      renderMap: go("Map"),
    });
    await controller.resumeRun();
    return destination;
  }

  return Promise.all(
    [
      [{ phase: "formation" }, "Formation"],
      [{ phase: "draft" }, "Draft"],
      [{ phase: "map", gameOver: true }, "GameOver"],
      [{ phase: "map", pendingSpecialMatchReward: {} }, "Special Reward"],
      [{ phase: "map", postBossFlow: {} }, "PostBoss"],
      [{ phase: "finalization" }, "Finalization"],
      [{ phase: "final-summary" }, "Final Summary"],
      [{ phase: "final-celebration" }, "Final Celebration"],
      [{ phase: "complete" }, "Final Celebration"],
      [{ phase: "squad" }, "Squad"],
      [{ phase: "five" }, "5v5"],
      [{ phase: "inventory" }, "Inventory"],
      [{ phase: "match", activeMatch: {} }, "Match"],
      [{ phase: "map", pendingItemReward: {} }, "Pending Item"],
      [{ phase: "map" }, "Map"],
    ].map(async ([input, expected]) =>
      assert.equal(await route({ seasonId: "ie1", ...input }), expected),
    ),
  );
}

function runFixture(runId, seasonId, phase = "squad") {
  return {
    saveVersion: 2,
    runId,
    seasonId,
    phase,
    teamIdentity: { name: `Team ${seasonId}` },
    lives: 2,
    bossIndex: 0,
    roster: [],
    lineup: [],
    bench: [],
    inventory: [],
    completedBossIds: [],
    unlockedTeamIds: [],
    fiveVFive: { formation: "diamond", assignments: {} },
  };
}

async function productionPaths() {
  const storage = new BudgetStorage();
  const seasonDb = {
    seasonId: "ie1",
    players: [],
    teams: [],
    bossOrder: [],
    formations: { eleven: [] },
  };
  const runtime = load(storage, {
    fullRuntime: true,
    run: runFixture("run-a", "ie1"),
    seasonId: "ie1",
    seasonDb,
    useProductionDevelopmentAccount: true,
  });
  const { context, query } = runtime;
  const ui = context.__INAZUMA_UI_TEST__;
  vm.runInContext(fs.readFileSync("js/shop-catalog.js", "utf8"), context, {
    filename: "shop-catalog.js",
  });
  await flush(); // Let the production bootstrap's intentionally unavailable fixture fetch settle.
  context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => 0;
  ui.setPermanentClubTestContext({
    run: context.RunState.load("ie1"),
    seasonDb,
    freeAgentsDb: { players: [] },
    activeSeason: { id: "ie1" },
  });

  await ui.renderHome();
  assert.match(
    context.document.getElementById("app").innerHTML,
    /data-run-state="active"/,
  );
  assert.strictEqual(
    ui.getRun(),
    context.run,
    "Home keeps runtime run and global.run coherent",
  );
  query("#open-shop-home").click();
  await flush();
  const shop = context.document.getElementById("app").innerHTML;
  assert.match(shop, /<main class="shop-screen">/);
  assert.match(shop, /data-shop-tab="general" aria-current="page"/);
  assert.match(shop, /data-buy-project=/);

  query(".shop-back").click();
  await flush();
  await ui.renderHome();
  query("#open-development-home").click();
  await flush();
  const development = context.document.getElementById("app").innerHTML;
  assert.match(development, /CENTRO DI SVILUPPO/);
  assert.match(
    development,
    /class="active" data-development-tab="players">GIOCATORI/,
  );

  await ui.renderHome();
  query("#home-primary-cta").click();
  await flush();
  assert.match(
    context.document.getElementById("app").innerHTML,
    /squad-screen/,
  );

  await ui.renderSeasonSelect();
  query('[data-season-continue="ie1"]').click();
  await flush();
  assert.match(
    context.document.getElementById("app").innerHTML,
    /squad-screen/,
  );
  assert.strictEqual(
    ui.getRun(),
    context.run,
    "selectSeason keeps runtime run and global.run coherent",
  );

  const runB = runFixture("run-b", "ie2", "map");
  context.RunState.save(runB);
  const beforeB = context.RunState.clone(
    context.RunState.load("ie2", { readOnly: true }),
  );

  ui.setPermanentClubTestContext({
    run: context.RunState.load("ie1"),
    seasonDb,
    activeSeason: { id: "ie1" },
  });
  await ui.renderSeasonSelect();
  query('[data-season-delete="ie1"]').click();
  query("[data-confirm-delete-run]").click();
  await flush();
  assert.equal(context.RunState.load("ie1", { readOnly: true }), null);
  assert.equal(
    JSON.stringify(context.RunState.load("ie2", { readOnly: true })),
    JSON.stringify(beforeB),
  );

  const recreated = context.RunState.createRun({ name: "Team ie1" }, "ie1");
  recreated.runId = "run-a-recreated";
  recreated.phase = "squad";
  context.RunState.save(recreated, { replaceRun: true });
  ui.setPermanentClubTestContext({
    run: context.RunState.load("ie1"),
    seasonDb,
    activeSeason: { id: "ie1" },
  });
  await ui.renderSeasonSelect();
  query('[data-season-delete="ie1"]').click();
  const newer = context.RunState.load("ie1", { readOnly: true });
  newer.bossIndex = 3;
  context.RunState.save(newer);
  query("[data-confirm-delete-run]").click();
  await flush();
  assert.equal(context.RunState.load("ie1", { readOnly: true }).bossIndex, 3);

  context.RunState.saveProfileTeamIdentity({
    name: "Persistent Team",
    emblemId: "default-lightning",
  });
  ui.setPermanentClubTestContext({
    run: context.RunState.load("ie1"),
    seasonDb,
    activeSeason: { id: "ie1" },
  });
  await ui.renderSeasonSelect();
  query('[data-season-new="ie1"]').click();
  await flush();
  query("#cancel-new-run").click();
  assert.equal(context.RunState.load("ie1", { readOnly: true }).bossIndex, 3);
  await ui.renderSeasonSelect();
  query('[data-season-new="ie1"]').click();
  await flush();
  query("#confirm-new-run").click();
  await flush();
  assert.notEqual(
    context.RunState.load("ie1", { readOnly: true }).runId,
    "run-a-recreated",
  );
  assert.equal(
    JSON.stringify(context.RunState.load("ie2", { readOnly: true })),
    JSON.stringify(beforeB),
  );
  assert.strictEqual(
    ui.getRun(),
    context.run,
    "NewRun keeps runtime run and global.run coherent",
  );
  assert.match(
    context.document.getElementById("app").innerHTML,
    /formation-choice-screen/,
  );

  runtime.destroy();

  const emptyRuntime = load(new BudgetStorage(), {
    fullRuntime: true,
    seasonId: "ie1",
    seasonDb,
  });
  await flush();
  emptyRuntime.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => 0;
  await emptyRuntime.context.__INAZUMA_UI_TEST__.renderHome();
  assert.match(
    emptyRuntime.context.document.getElementById("app").innerHTML,
    /data-run-state="empty"/,
  );
  assert.equal(emptyRuntime.context.__INAZUMA_UI_TEST__.getRun(), null);
  assert.equal(emptyRuntime.context.run, null);
  emptyRuntime.destroy();
}

(async () => {
  await routingMatrix();
  await productionPaths();
  console.log("home/season/resume production paths and routing matrix: OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
