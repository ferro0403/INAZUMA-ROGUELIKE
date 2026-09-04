"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const freeAgentFixture = require("../data/FREE_AGENTS_compact.json");

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};

function click(runtime, selector) {
  const target = runtime.query(selector);
  assert.ok(target, `missing real DOM target ${selector}`);
  target.click();
  return target;
}

function gameplaySnapshot(run) {
  return structuredClone({
    runId: run.runId,
    seasonId: run.seasonId,
    roster: run.roster,
    lineup: run.lineup,
    bench: run.bench,
    inventory: run.inventory,
    activeMatch: run.activeMatch,
    currentZone: run.currentZone,
    lives: run.lives,
    bossIndex: run.bossIndex,
    postBossFlow: run.postBossFlow,
    pendingBossVictory: run.pendingBossVictory,
    phase: run.phase,
  });
}

async function main() {
  const storage = new BudgetStorage();
  const bootstrap = load(storage);
  const player = structuredClone(
    freeAgentFixture.players.find(
      (candidate) => candidate.category === "Normale",
    ),
  );
  const developmentPlayer = structuredClone(
    freeAgentFixture.players.find(
      (candidate) =>
        candidate.category === "Debole" &&
        String(candidate.playerId) !== String(player.playerId),
    ),
  );
  player.frontFullbodyUrl = "bad-fullbody.png";
  player.portraitUrl = "portrait.png";
  const equipment = {
    id: "test_boots",
    itemId: "test_boots",
    instanceId: "equipment-1",
    kind: "equipment",
    name: "Scarpini test",
    description: "Fixture equipaggiamento",
    stat: "attack",
    bonus: 5,
  };
  const seasonDb = {
    seasonId: "ie1",
    players: [player, developmentPlayer],
    teams: [
      {
        teamId: "raimon-test",
        teamName: "Raimon Test",
        playerIds: [player.playerId, developmentPlayer.playerId],
      },
    ],
    formations: {
      eleven: [{ id: "one", name: "Uno", rows: [[player.position]] }],
    },
    bossOrder: [],
    recruitmentPool: { entries: [] },
  };
  const freeAgentsDb = { players: [developmentPlayer] };
  const run = bootstrap.RunState.createRun({ name: "Presentation" }, "ie1");
  Object.assign(run, {
    runId: "player-presentation-run",
    phase: "squad",
    formationId: "one",
    roster: [
      {
        playerId: player.playerId,
        source: "ie1",
        level: 3,
        equippedItem: equipment,
      },
    ],
    lineup: [String(player.playerId)],
    bench: [],
    inventory: [],
    currentZone: 0,
    bossIndex: 0,
    activeMatch: null,
    postBossFlow: null,
    pendingBossVictory: null,
    fiveVFive: {
      formation: "test-five",
      slots: { only: String(player.playerId) },
    },
  });
  const fiveFormation = {
    id: "test-five",
    name: "Test Five",
    summary: "1 player",
    slots: [{ key: "only", role: player.position, line: "goal" }],
  };
  const fiveVFive = {
    formations: [fiveFormation],
    ensure: (current) => current.fiveVFive,
    formationById: () => fiveFormation,
    emptySlots: () => ({ only: null }),
    validate: (state) => ({
      valid: Boolean(state?.slots?.only),
      messages: [],
      assignedCount: state?.fiveVFive?.slots?.only ? 1 : 0,
      formation: fiveFormation,
    }),
    assign: () => true,
    clearSlot: () => true,
    changeFormation: () => true,
    removeUnavailable: () => {},
  };
  const runtime = load(storage, {
    fullRuntime: true,
    run,
    seasonId: "ie1",
    seasonDb,
    useProductionDevelopmentAccount: true,
    contextOverrides: {
      FiveVFive: fiveVFive,
      FormationLayout: {
        displayRows: (formation) =>
          formation.rows.map((row) => ({ role: row[0], count: row.length })),
      },
    },
  });
  runtime.seam.setContext({
    run: runtime.seam.getRun(),
    seasonDb,
    freeAgentsDb,
  });
  const ui = runtime.context.__INAZUMA_UI_TEST__;
  ui.setPermanentClubTestContext({
    run: runtime.seam.getRun(),
    seasonDb,
    freeAgentsDb,
    activeSeason: { id: "ie1" },
  });

  // Squad -> real card click -> current detail.
  const beforeReadOnlyPaths = gameplaySnapshot(runtime.canonical);
  runtime.seam.renderSquad();
  const squadCard = runtime.query(`[data-squad-player="${player.playerId}"]`);
  assert.ok(squadCard, "Squad must render the real shared player card");
  squadCard.click();
  assert.strictEqual(
    runtime.seam.getUi().selectedSquadPlayerId,
    String(player.playerId),
    "real Squad card click selects player",
  );
  click(runtime, "#squad-player-info");
  assert.match(runtime.modalMarkup, /player-detail-modal/);
  assert.match(runtime.modalMarkup, new RegExp(player.name));
  assert.strictEqual(
    (runtime.modalMarkup.match(/player-stat-card/g) || []).length,
    8,
  );
  assert.ok(runtime.query("[data-detail-unequip]"));

  // onClose and preserveScroll retain the openModal contract.
  click(runtime, "[data-close-modal]");
  let closeCalls = 0;
  const preserveScroll = { windowX: 4, windowY: 12, appTop: 18 };
  runtime.seam.showPlayerDetailsFor(player, {
    readOnly: true,
    onClose: () => {
      closeCalls += 1;
    },
    preserveScroll,
  });
  assert.strictEqual(
    runtime.context.document.getElementById("modal-root")._restoreScrollTo,
    preserveScroll,
  );
  click(runtime, "[data-close-modal]");
  assert.strictEqual(closeCalls, 1, "onClose fires exactly once");

  // Album -> collection -> team -> player, only through real DOM clicks.
  runtime.context.AlbumProgress.unlockAlbumPlayer("ie1", player.playerId, {
    source: "player-presentation-test",
  });
  await ui.renderAlbumCollections();
  click(runtime, '[data-album-collection="ie1"]');
  await flush();
  click(runtime, '[data-album-team="raimon-test"]');
  await flush();
  click(runtime, `[data-album-player-entry="${player.playerId}"]`);
  assert.match(runtime.modalMarkup, /album-player-detail-modal/);
  assert.match(runtime.modalMarkup, /album-detail-badge/);
  assert.match(runtime.modalMarkup, new RegExp(player.name));
  assert.strictEqual(
    (runtime.modalMarkup.match(/player-stat-card/g) || []).length,
    8,
  );
  assert.strictEqual(runtime.query("[data-detail-unequip]"), null);
  click(runtime, "[data-close-modal]");

  // Hall -> champion -> historical player, only through real DOM clicks.
  const champion = {
    archiveKey: "presentation::ie1::boss",
    hallTeamId: "hall-presentation",
    runId: "historical-run",
    teamName: "Golden Raimon",
    modeId: "ie1",
    seasonId: "ie1",
    seasonName: "Inazuma Eleven 1",
    victoryDate: "2026-09-03T00:00:00.000Z",
    finalBossId: "boss",
    finalBossName: "Royal",
    finalFormation: "one",
    finalAverageOverall: 81,
    finalStartingEleven: [
      {
        ...player,
        role: player.position,
        finalRarity: "Buono",
        finalOverall: 81,
        finalLevel: 20,
        finalStats: player.stats,
      },
    ],
    fullRoster: [
      {
        ...player,
        role: player.position,
        finalRarity: "Buono",
        finalOverall: 81,
        finalLevel: 20,
        finalStats: player.stats,
      },
    ],
    bench: [],
    playerStatistics: { [player.playerId]: { appearances: 4, goals: 3 } },
    runStatistics: {},
    awards: [],
  };
  runtime.context.HallOfFameStorage.addChampion(champion);
  const hallBefore = structuredClone(
    runtime.context.HallOfFameStorage.listTeams(),
  );
  ui.renderHallOfFame();
  click(runtime, '[data-open-hall-team="hall-presentation"]');
  click(runtime, `[data-hall-player="${player.playerId}"]`);
  assert.match(runtime.modalMarkup, /Squadra campione/);
  assert.match(runtime.modalMarkup, /player-detail-historical/);
  assert.match(runtime.modalMarkup, /PRESTAZIONI NELLA RUN/);
  assert.match(runtime.modalMarkup, /Golden Raimon/);
  assert.strictEqual(runtime.query("[data-detail-unequip]"), null);
  assert.strictEqual(
    JSON.stringify(runtime.context.HallOfFameStorage.listTeams()),
    JSON.stringify(hallBefore),
    "Hall detail is read-only",
  );
  click(runtime, "[data-close-modal]");

  // Development -> player -> selected card -> detail.
  runtime.context.AlbumProgress.unlockAlbumPlayer(
    "ie1",
    developmentPlayer.playerId,
    { source: "player-presentation-test" },
  );
  ui.renderDevelopmentCenter("players");
  click(runtime, `[data-development-player="${developmentPlayer.playerId}"]`);
  click(
    runtime,
    `[data-development-selected-card="${developmentPlayer.playerId}"]`,
  );
  assert.match(runtime.modalMarkup, new RegExp(developmentPlayer.name));
  assert.match(
    runtime.modalMarkup,
    new RegExp(`rarity-${developmentPlayer.category.toLowerCase()}`),
  );
  assert.match(runtime.modalMarkup, /Overall/);
  assert.match(runtime.modalMarkup, /Potenziale/);
  assert.strictEqual(
    (runtime.modalMarkup.match(/player-stat-card/g) || []).length,
    8,
  );
  click(runtime, "[data-close-modal]");

  // Real 5v5 editor renders the shared compact card.
  runtime.seam.renderFiveVFive();
  const fiveCard = runtime.query('[data-five-slot="only"]');
  assert.ok(fiveCard, "5v5 shared card exists");
  assert.strictEqual(fiveCard.dataset.fiveSlot, "only");
  const fiveMarkup = runtime.seam.getAppMarkup();
  for (const token of [
    player.name,
    player.position,
    "player-overall",
    "player-level",
    "portrait.png",
    "data-image-fallbacks",
  ]) {
    assert.ok(fiveMarkup.includes(token), `5v5 shared card includes ${token}`);
  }

  assert.deepStrictEqual(
    gameplaySnapshot(runtime.canonical),
    beforeReadOnlyPaths,
    "all detail opens and shared-card renders leave the run unchanged",
  );

  // Current equipment removal crosses the existing Inventory confirmation/mutation.
  runtime.seam.renderSquad();
  click(runtime, `[data-squad-player="${player.playerId}"]`);
  assert.strictEqual(runtime.seam.getUi().selectedSquadPlayerId, String(player.playerId));
  click(runtime, "#squad-player-info");
  assert.match(runtime.modalMarkup, /player-detail-modal/);
  click(runtime, "[data-detail-unequip]");
  assert.match(runtime.modalMarkup, /Rimuovere Scarpini test/);
  click(runtime, "#confirm-inventory-action");
  const afterUnequip = runtime.canonical;
  assert.strictEqual(afterUnequip.roster[0].equippedItem, null);
  assert.deepStrictEqual(
    afterUnequip.inventory.map((item) => item.instanceId),
    ["equipment-1"],
  );
  assert.match(runtime.seam.getAppMarkup(), /squad-screen/);

  // Execute legacy augmenters and explicitly characterize the harness limitation.
  runtime.context.Element = class {
    static [Symbol.hasInstance](value) {
      return Boolean(value && value.dataset);
    }
  };
  for (const file of [
    "js/inventory-pull-detail-copy.js",
    "js/player-detail-element-badges.js",
    "js/player-detail-element-badges-global.js",
  ]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), runtime.context, {
      filename: file,
    });
  }
  runtime.seam.renderSquad();
  click(runtime, `[data-squad-player="${player.playerId}"]`);
  click(runtime, "#squad-player-info");
  assert.ok(runtime.query(".detail-element-chip"));
  assert.strictEqual(
    runtime.query(".detail-element-chip").dataset.element,
    undefined,
    "LEGACY AUGMENTATION NOT FULLY EMULATED BY TEST HARNESS: MutationObserver is a no-op",
  );

  runtime.destroy();
  console.log(
    "player presentation production paths: Squad, Album, Hall, Development, 5v5, unequip, close and immutability OK; legacy MutationObserver limitation explicit",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
