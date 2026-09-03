"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const diagnosticsSource = fs.readFileSync("js/app/dev-diagnostics.js", "utf8");
const seamsSource = fs.readFileSync("js/app/test-seams.js", "utf8");
assert(diagnosticsSource.includes("global.AppDevDiagnostics"));
assert(seamsSource.includes("global.AppTestSeams"));
assert(!diagnosticsSource.includes("RunState.save("), "dev diagnostics must not own gameplay saves");
assert(!seamsSource.includes("RunState.save("), "test seams must not own gameplay saves");

let currentRun = {
  runId: "run-1",
  seasonId: "ie1",
  phase: "match",
  storageGeneration: 7,
  storageCommitId: "commit-memory",
  activeMatch: {
    matchId: "m1",
    type: "five_v_five",
    state: "completed-victory",
    simulation: { state: "completed", resolutionApplied: true, winner: "user", revealedCount: 4, timeline: [1, 2] },
  },
  permanentEffectOutbox: [{ status: "pending" }, { status: "applied" }],
  currentZone: { currentNodeId: "n1", pendingNodeId: "n2" },
  lives: 2,
  gameOver: false,
  finalization: { status: "pending" },
  postBossFlow: { status: "reward" },
};
let ui = { match: null };
const context = {
  console: { info() {}, error() {} },
  globalThis: null,
  addEventListener() {},
  RunState: {
    load() { return { runId: "run-1", storageGeneration: 8, storageCommitId: "commit-canonical" }; },
    clone(value) { return JSON.parse(JSON.stringify(value)); },
  },
  RunStorage: { diagnostics() { return { bytes: 10, totalKnownBytes: 20, headGeneration: 8, backupGeneration: 7, headMatchesCanonical: true, canonicalGeneration: 8, canonicalCommitId: "commit-canonical", canonicalRunId: "run-1" }; } },
  document: {},
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(diagnosticsSource, context, { filename: "dev-diagnostics.js" });

const diagnostics = context.AppDevDiagnostics.create({
  devMode: true,
  getRun: () => currentRun,
  getActiveSeason: () => ({ id: "ie1" }),
  getUi: () => ui,
  toast() {},
});
assert.strictEqual(diagnostics.repairResultMessage({ blocker: "locked" }), "Riparazione non applicata: locked");
assert.strictEqual(diagnostics.repairResultMessage({ repaired: true }), "Riparazione salvataggio completata. Report copiato.");
const entry = diagnostics.recordGameplayFailure("five", "persistence", Object.assign(new Error("boom"), { code: "quota" }), "save");
assert.strictEqual(entry.label, "five");
assert.strictEqual(entry.generation.memory, 7);
assert.strictEqual(entry.generation.canonical, 8);
assert.strictEqual(entry.match.matchId, "m1");
assert.strictEqual(entry.node.pendingNodeId, "n2");
diagnostics.exposeGlobalDiagnostics();
assert.strictEqual(typeof context.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__, "function");
assert.strictEqual(context.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__().length, 1);
const matchReport = context.__INAZUMA_MATCH_DIAGNOSTICS__();
assert.strictEqual(matchReport.matchType, "five_v_five");
assert.deepStrictEqual(JSON.parse(JSON.stringify(matchReport.permanentEffects)), { pending: 1, applied: 1 });

context.__INAZUMA_TEST_MODE__ = true;
vm.runInContext(seamsSource, context, { filename: "test-seams.js" });
let seasonDb = null;
let activeSeason = null;
let seasonPlayersById = null;
let freeAgentsDb = null;
let freeAgentsById = null;
const marker = () => true;
const seams = context.AppTestSeams.create({
  getRun: () => currentRun,
  setRun: (value) => { currentRun = value; context.run = value; },
  getUi: () => ui,
  setUiMatch: (value) => { ui.match = value; },
  getAppMarkup: () => "<main></main>",
  setSeasonDb: (value) => { seasonDb = value; },
  setActiveSeason: (value) => { activeSeason = value; },
  setSeasonPlayersById: (value) => { seasonPlayersById = value; },
  setFreeAgentsDb: (value) => { freeAgentsDb = value; },
  setFreeAgentsById: (value) => { freeAgentsById = value; },
  uiTest: { renderHome: marker },
  recruitment: { recruitPlayer: marker },
  initialDraft: { players: marker },
  terminal: { completeFiveMatch: marker },
});
seams.install();
assert.strictEqual(context.__INAZUMA_UI_TEST__.renderHome, marker);
assert.strictEqual(context.__INAZUMA_RECRUITMENT_TEST__.recruitPlayer, marker);
assert.strictEqual(context.__INAZUMA_INITIAL_DRAFT_TEST__.players, marker);
assert.strictEqual(context.__INAZUMA_TERMINAL_FLOW_TEST__.completeFiveMatch, marker);

const nextRun = { runId: "run-2", seasonId: "ie2", activeMatch: { matchId: "m2" } };
context.__INAZUMA_RECRUITMENT_TEST__.setContext({
  run: nextRun,
  seasonDb: { seasonId: "ie2", players: [{ playerId: 12 }] },
  freeAgentsDb: { players: [{ playerId: 99 }] },
});
assert.strictEqual(currentRun, nextRun);
assert.strictEqual(seasonDb.seasonId, "ie2");
assert.strictEqual(activeSeason.id, "ie2");
assert.strictEqual(seasonPlayersById.get("12").playerId, 12);
assert.strictEqual(freeAgentsDb.players[0].playerId, 99);
assert.strictEqual(freeAgentsById.get("99").playerId, 99);

context.__INAZUMA_TERMINAL_FLOW_TEST__.setContext({ run: nextRun, seasonDb: { players: [] } });
assert.strictEqual(ui.match.matchId, "m2");
assert.strictEqual(activeSeason.id, "ie2", "terminal seam must fall back to run season id");
assert.strictEqual(context.__INAZUMA_TERMINAL_FLOW_TEST__.getAppMarkup(), "<main></main>");

console.log("app-support-runtime-domain-test: PASS");
