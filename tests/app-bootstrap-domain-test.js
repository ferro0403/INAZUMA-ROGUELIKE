"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function harness({ testMode = true, protocol = "https:" } = {}) {
  const app = { innerHTML: "" };
  const state = {
    run: null,
    activeSeason: null,
    seasonDb: null,
    seasonPlayersById: null,
    seasonTeamsById: null,
    freeAgentsDb: null,
    freeAgentsById: null,
    playerVisualsById: null,
  };
  const calls = [];
  const seasonDb = { seasonId: "ie1", players: [{ playerId: 1 }], teams: [{ teamId: "t1" }] };
  const freeAgentsDb = { players: [{ playerId: 7 }, { playerId: "8" }] };
  const visualsDb = { players: { 7: { portraitUrl: "seven" } } };
  const responses = {
    "data/FREE_AGENTS_compact.json": { ok: true, json: async () => freeAgentsDb },
    "data/PLAYER_VISUALS.json": { ok: true, json: async () => visualsDb },
  };
  const context = {
    console: { error: (...args) => calls.push(["console.error", ...args]) },
    globalThis: null,
    location: { protocol },
    __INAZUMA_TEST_MODE__: testMode,
    SeasonRegistry: {
      DEFAULT_SEASON_ID: "ie1",
      setActive: (id) => { calls.push(["setActive", id]); return { id, phase: "set" }; },
      loadDatabase: async (id) => { calls.push(["loadDatabase", id]); return seasonDb; },
      get: (id) => { calls.push(["getSeason", id]); return { id, phase: "loaded" }; },
      playersIndex: (id) => { calls.push(["playersIndex", id]); return new Map([["1", seasonDb.players[0]]]); },
      teamsIndex: (id) => { calls.push(["teamsIndex", id]); return new Map([["t1", seasonDb.teams[0]]]); },
    },
    DevelopmentRuntime: { registerDatabase: (...args) => calls.push(["registerDatabase", ...args]) },
    AlbumProgress: { configureFreeAgentIds: (ids, options) => { calls.push(["configureAlbum", ids, options]); return { ids, options }; } },
    InazumaAccountUI: { buttonMarkup: () => "<button>Account</button>" },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/app/app-bootstrap.js", "utf8"), context);
  const runtime = context.AppBootstrapRuntime.create({
    app,
    fetchResource: async (url) => { calls.push(["fetch", url]); return responses[url]; },
    escapeHtml: (value) => String(value).replaceAll("<", "&lt;"),
    persistenceWritesAllowed: () => true,
    renderHome: async () => { calls.push(["renderHome"]); },
    setRun: (value) => { state.run = value; },
    getActiveSeason: () => state.activeSeason,
    setActiveSeason: (value) => { state.activeSeason = value; calls.push(["setActiveSeasonState", value?.phase || null]); },
    setSeasonDb: (value) => { state.seasonDb = value; calls.push(["setSeasonDb"]); },
    setSeasonPlayersById: (value) => { state.seasonPlayersById = value; },
    setSeasonTeamsById: (value) => { state.seasonTeamsById = value; },
    setFreeAgentsDb: (value) => { state.freeAgentsDb = value; },
    setFreeAgentsById: (value) => { state.freeAgentsById = value; },
    setPlayerVisualsById: (value) => { state.playerVisualsById = value; },
  });
  return { context, runtime, state, calls, app, seasonDb, freeAgentsDb };
}

(async () => {
  {
    const h = harness();
    const db = await h.runtime.loadSeason("ie1");
    assert.strictEqual(db, h.seasonDb);
    assert.strictEqual(h.state.seasonDb, h.seasonDb);
    assert.strictEqual(h.state.activeSeason.phase, "loaded");
    assert.strictEqual(h.state.seasonPlayersById.get("1").playerId, 1);
    assert.strictEqual(h.state.seasonTeamsById.get("t1").teamId, "t1");
    assert(h.calls.find((entry) => entry[0] === "registerDatabase" && entry[1] === "ie1"));
    const firstSet = h.calls.findIndex((entry) => entry[0] === "setActiveSeasonState" && entry[1] === "set");
    const load = h.calls.findIndex((entry) => entry[0] === "loadDatabase");
    assert(firstSet >= 0 && firstSet < load, "active season must be visible before database await, matching BASE");
  }

  {
    const h = harness();
    await h.runtime.init();
    assert.strictEqual(h.state.freeAgentsDb, h.freeAgentsDb);
    assert.deepStrictEqual([...h.state.freeAgentsById.keys()], ["7", "8"]);
    assert.strictEqual(h.state.playerVisualsById.get("7").portraitUrl, "seven");
    assert(h.calls.some((entry) => entry[0] === "configureAlbum" && entry[1].join(",") === "7,8" && entry[2].persist === true));
    assert(h.calls.some((entry) => entry[0] === "renderHome"));
  }

  {
    const h = harness({ protocol: "file:" });
    h.runtime.showLoadError(new Error("Failed to fetch"));
    assert(h.app.innerHTML.includes("Caricamento database non riuscito"));
    assert(h.app.innerHTML.includes("Live Server"));
    assert(!h.app.innerHTML.includes("<button>Account</button>"));
  }

  {
    const h = harness();
    h.runtime.showLoadError(Object.assign(new Error("restore-recovery-required"), { code: "restore-recovery-required" }));
    assert(h.app.innerHTML.includes("Avvio temporaneamente non disponibile"));
    assert(h.app.innerHTML.includes("<button>Account</button>"));
  }

  {
    const h = harness({ testMode: false });
    assert.strictEqual(h.runtime.setPermanentClubTestContext({ run: { runId: "blocked" } }), false);
    assert.strictEqual(h.state.run, null);
  }

  {
    const h = harness({ testMode: true });
    const run = { runId: "test" };
    const seasonDb = { seasonId: "s", players: [{ playerId: 2 }], teams: [{ teamId: "z" }] };
    const freeAgentsDb = { players: [{ playerId: 9 }] };
    assert.strictEqual(h.runtime.setPermanentClubTestContext({ run, seasonDb, freeAgentsDb, activeSeason: { id: "s" } }), true);
    assert.strictEqual(h.state.run, run);
    assert.strictEqual(h.state.seasonDb, seasonDb);
    assert.strictEqual(h.state.seasonPlayersById.get("2").playerId, 2);
    assert.strictEqual(h.state.seasonTeamsById.get("z").teamId, "z");
    assert.strictEqual(h.state.freeAgentsById.get("9").playerId, 9);
    assert.strictEqual(h.state.activeSeason.id, "s");
  }

  const source = fs.readFileSync("js/app/app-bootstrap.js", "utf8");
  assert(!/RunState\.save\s*\(/.test(source));
  assert(!/RunStorage|Firebase|Firestore|CloudSave|CloudRestore/.test(source));
  console.log("app bootstrap domain test: PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
