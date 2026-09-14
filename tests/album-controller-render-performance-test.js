"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function makeRuntime({ indexedDbAuthority = true, hallCount = 12, playerCount = 1000 } = {}) {
  let albumReads = 0;
  let backfillCalls = 0;
  let hallListReads = 0;
  let hallTeamReads = 0;
  let seasonLoads = 0;

  const collectionIds = ["ie1", "ie2", "ie1_s2", "ie1_s3", "orion"];
  const freeAgents = Array.from({ length: playerCount }, (_, index) => ({
    playerId: `fa-${index}`,
    name: `Free Agent ${index}`,
    finalOverall: 80,
  }));
  const seasonPlayers = collectionIds.map((collectionId, index) => ({
    playerId: `season-${collectionId}`,
    name: `Season Player ${index}`,
    finalOverall: 80,
  }));
  const seasonDbs = Object.fromEntries(collectionIds.map((collectionId, index) => [collectionId, {
    seasonId: collectionId,
    players: [seasonPlayers[index]],
    teams: [],
    recruitmentPool: { entries: [] },
  }]));

  const unlocked = Object.fromEntries([
    ...freeAgents.map((player) => [String(player.playerId), { firstUnlockedAt: "2026-01-01T00:00:00.000Z", firstSource: "fixture" }]),
    ...seasonPlayers.map((player) => [String(player.playerId), { firstUnlockedAt: "2026-01-01T00:00:00.000Z", firstSource: "fixture" }]),
  ]);
  const albumState = {
    schemaVersion: 2,
    sharedUnlockedPlayerIds: {},
    collections: Object.fromEntries(collectionIds.map((collectionId) => [collectionId, { unlockedPlayerIds: { ...unlocked } }])),
  };

  const app = { innerHTML: "" };
  const listeners = [];
  const document = {
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };

  const context = {
    globalThis: null,
    window: null,
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    TypeError,
    Set,
    Map,
    document,
    AlbumIndexedDbStorage: { isAuthority: () => indexedDbAuthority },
    AlbumProgress: {
      DEFAULT_COLLECTION_ID: "ie1",
      ALBUM_COLLECTIONS: Object.fromEntries(collectionIds.map((id) => [id, { id, name: id, seasonId: id, coverUrl: "" }])),
      read() { albumReads += 1; return structuredClone(albumState); },
      unlockedSet() { throw new Error("render path must reuse the already-read Album snapshot"); },
      backfillAlbumProgress() { backfillCalls += 1; return 0; },
    },
    AlbumCatalog: { freeAgentPlayers: (players) => players || [] },
    HallOfFameStorage: {
      listSummaries() {
        hallListReads += 1;
        return Array.from({ length: hallCount }, (_, index) => ({ hallTeamId: `hall-${index}` }));
      },
      getTeam(hallTeamId) {
        hallTeamReads += 1;
        return { hallTeamId, seasonId: "ie1", fullRoster: [] };
      },
    },
    SeasonRegistry: {
      database: (id) => seasonDbs[id] || null,
      activeId: () => "ie1",
      async loadDatabase(id) { seasonLoads += 1; return seasonDbs[id]; },
      setActive() {},
    },
    RecruitmentPoolRuntime: {
      orderedAlbumTeams() {
        return Array.from({ length: 24 }, (_, index) => ({
          teamId: `team-${index}`,
          teamName: `Team ${index}`,
          playerIds: [seasonPlayers[0].playerId],
        }));
      },
    },
    ProfiledSeasonRuntime: {
      resolveProfile() { return null; },
      resolveEffectiveBase() { return null; },
    },
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/album/album-controller.js", "utf8"), context, { filename: "js/album/album-controller.js" });

  const seasonIndex = new Map(seasonPlayers.map((player) => [String(player.playerId), player]));
  const controller = context.AlbumController.create({
    app,
    getUi: () => ({}),
    getRun: () => ({ seasonId: "ie1", roster: [] }),
    prepareAlbumLegacyContext() {},
    getSeasonDb: () => seasonDbs.ie1,
    getFreeAgentsDb: () => ({ players: freeAgents }),
    getSeasonPlayersById: () => seasonIndex,
    getActiveSeason: () => ({ id: "ie1" }),
    async loadSeason(collectionId) { return seasonDbs[collectionId]; },
    isProfileAwareSeason: () => false,
    closeModal() {},
    resetRenderedViewScroll() {},
    bindSectionRootNav() {},
    showPlayerDetailsFor() {},
    scrollSnapshot: () => 0,
    view: {
      escapeHtml: (value) => String(value ?? ""),
      sectionRootButton: () => "",
      playerCard: () => "<button data-album-player></button>",
    },
  });

  return {
    controller,
    app,
    context,
    counts: () => ({ albumReads, backfillCalls, hallListReads, hallTeamReads, seasonLoads }),
    resetReads() { albumReads = 0; backfillCalls = 0; hallListReads = 0; hallTeamReads = 0; seasonLoads = 0; },
    listeners,
  };
}

(async function main() {
  {
    const runtime = makeRuntime({ indexedDbAuthority: true, hallCount: 40, playerCount: 1400 });
    await runtime.controller.renderCollections();
    const counts = runtime.counts();
    assert.strictEqual(counts.albumReads, 1, "full Album collection page must read the Album snapshot only once");
    assert.strictEqual(counts.backfillCalls, 0, "IndexedDB authority must not invoke the legacy backfill facade");
    assert.strictEqual(counts.hallListReads, 0, "IndexedDB Album opening must not materialize Hall summaries");
    assert.strictEqual(counts.hallTeamReads, 0, "IndexedDB Album opening must not clone historical Hall teams");
    assert.strictEqual(counts.seasonLoads, 5, "collection totals still load every configured season database");
    assert.match(runtime.app.innerHTML, /1401 \/ 1401 giocatori sbloccati/);

    runtime.resetReads();
    await runtime.controller.renderTeams("ie1");
    const teamCounts = runtime.counts();
    assert.strictEqual(teamCounts.albumReads, 1, "team grid must reuse one Album snapshot for every team progress counter");
    assert.strictEqual(teamCounts.backfillCalls, 0);
    assert.strictEqual(teamCounts.hallListReads, 0);
    assert.strictEqual(teamCounts.hallTeamReads, 0);
    assert.match(runtime.app.innerHTML, /Team 23/);
  }

  {
    const runtime = makeRuntime({ indexedDbAuthority: false, hallCount: 8, playerCount: 200 });
    await runtime.controller.renderCollections();
    const counts = runtime.counts();
    assert.strictEqual(counts.backfillCalls, 1, "legacy compatibility backfill must run once per collection-page render");
    assert.strictEqual(counts.hallListReads, 1, "legacy Hall summaries must be collected once, not once per collection");
    assert.strictEqual(counts.hallTeamReads, 8, "legacy Hall teams must be read once each");
    assert.strictEqual(counts.albumReads, 1, "legacy collection counters must also reuse one Album snapshot");
  }

  console.log("album-controller-render-performance-test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
