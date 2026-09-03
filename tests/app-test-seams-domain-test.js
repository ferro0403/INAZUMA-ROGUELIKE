"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/app/test-seams.js", "utf8");
assert(source.includes("global.AppTestSeams"));
assert(!/RunState\.save|RunStorage|Firebase|Firestore|CloudSave|CloudRestore/.test(source), "test seam registry must not own persistence");

const context = { globalThis: null, Map };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "test-seams.js" });

let run = null;
let ui = { match: null };
let seasonDb = null;
let activeSeason = null;
let seasonPlayersById = null;
let freeAgentsDb = null;
let freeAgentsById = null;
const app = { innerHTML: "<main>game</main>" };
const uiApi = { renderHome() { return "home"; } };

const baseOptions = {
  app,
  getRun: () => run,
  setRun(value) { run = value; },
  getUi: () => ui,
  setUiMatch(value) { ui.match = value; },
  setSeasonDb(value) { seasonDb = value; },
  setActiveSeason(value) { activeSeason = value; },
  setSeasonPlayersById(value) { seasonPlayersById = value; },
  setFreeAgentsDb(value) { freeAgentsDb = value; },
  setFreeAgentsById(value) { freeAgentsById = value; },
  uiApi,
  recruitmentApi: { recruitPlayer() { return "recruit"; } },
  initialDraftApi: { players() { return ["draft"]; } },
  terminalApi: { completeFiveMatch() { return "five"; } },
};

assert.strictEqual(context.AppTestSeams.install({ ...baseOptions, testMode: false }), false);
assert.strictEqual(context.__INAZUMA_UI_TEST__.renderHome(), "home");
assert.strictEqual(context.__INAZUMA_UI_TEST__.getRun(), null);
assert.strictEqual(context.__INAZUMA_RECRUITMENT_TEST__, undefined);

assert.strictEqual(context.AppTestSeams.install({ ...baseOptions, testMode: true }), true);
assert.strictEqual(context.__INAZUMA_RECRUITMENT_TEST__.recruitPlayer(), "recruit");
assert.strictEqual(context.__INAZUMA_INITIAL_DRAFT_TEST__.players()[0], "draft");
assert.strictEqual(context.__INAZUMA_TERMINAL_FLOW_TEST__.completeFiveMatch(), "five");
assert.strictEqual(Object.isFrozen(context.__INAZUMA_INITIAL_DRAFT_TEST__), true);
assert.strictEqual(Object.isFrozen(context.__INAZUMA_TERMINAL_FLOW_TEST__), true);

const recruitmentRun = { runId: "r1", seasonId: "run-season", activeMatch: { matchId: "m1" } };
const recruitmentSeason = { seasonId: "season-a", players: [{ playerId: 7 }, { playerId: "8" }] };
const recruitmentFree = { players: [{ playerId: 9 }] };
context.__INAZUMA_RECRUITMENT_TEST__.setContext({ run: recruitmentRun, seasonDb: recruitmentSeason, freeAgentsDb: recruitmentFree });
assert.strictEqual(run, recruitmentRun);
assert.strictEqual(seasonDb, recruitmentSeason);
assert.strictEqual(activeSeason.id, "season-a");
assert.strictEqual(seasonPlayersById.get("7").playerId, 7);
assert.strictEqual(freeAgentsDb, recruitmentFree);
assert.strictEqual(freeAgentsById.get("9").playerId, 9);
assert.strictEqual(context.__INAZUMA_RECRUITMENT_TEST__.getRun(), recruitmentRun);

const draftRun = { runId: "r2", seasonId: "fallback-season" };
context.__INAZUMA_INITIAL_DRAFT_TEST__.setContext({ run: draftRun, seasonDb: { players: [{ playerId: "p1" }] } });
assert.strictEqual(activeSeason.id, "fallback-season", "draft seam must preserve run-season fallback");
assert.strictEqual(seasonPlayersById.has("p1"), true);

freeAgentsDb = recruitmentFree;
freeAgentsById = new Map([["9", recruitmentFree.players[0]]]);
const terminalRun = { runId: "r3", seasonId: "terminal-season", activeMatch: { matchId: "terminal-match" } };
context.__INAZUMA_TERMINAL_FLOW_TEST__.setContext({ run: terminalRun, seasonDb: { players: [] }, freeAgentsDb: { players: [{ playerId: "should-not-apply" }] } });
assert.strictEqual(run, terminalRun);
assert.strictEqual(ui.match.matchId, "terminal-match");
assert.strictEqual(activeSeason.id, "terminal-season");
assert.strictEqual(freeAgentsDb, recruitmentFree, "terminal seam must not mutate free-agent context");
assert.strictEqual(context.__INAZUMA_TERMINAL_FLOW_TEST__.getUi(), ui);
assert.strictEqual(context.__INAZUMA_TERMINAL_FLOW_TEST__.getAppMarkup(), "<main>game</main>");

console.log("app-test-seams-domain-test: PASS");
