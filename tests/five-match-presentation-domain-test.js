"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/five-v-five/five-match-presentation.js", "utf8");
for (const forbidden of ["RunState.save", "RunStorage", "Firebase", "Firestore", "CloudSave", "CloudRestore"]) {
  assert.ok(!source.includes(forbidden), "five-match presentation must not own " + forbidden);
}
for (const token of [
  "fiveOpponents",
  "const used = new Set()",
  "!userIds.has",
  'type: "five_v_five"',
  'state: "pre-match"',
  "five-match-quick-swap",
  "fiveMatchComparisonMarkup",
  "fiveMatchPlayerDetail",
]) assert.ok(source.includes(token), "missing production parity token: " + token);

const slots = [
  { key: "GK", role: "GK", line: "goal" },
  { key: "DF", role: "DF", line: "defense" },
  { key: "MF1", role: "MF", line: "midfield" },
  { key: "MF2", role: "MF", line: "midfield" },
  { key: "FW", role: "FW", line: "attack" },
];
const formations = {
  "1-2-1": { id: "1-2-1", slots },
  "1-1-2": { id: "1-1-2", slots },
};
let seededWith = null;
const context = {
  console, Map, Set, Object, Array, String, Number, Math, JSON, Error, Intl,
  document: { querySelector: () => null },
  FiveVFive: { formationById: id => formations[id] || formations["1-2-1"] },
  DraftEngine: { randomFromSeed(seed) { seededWith = seed; let n = 0; return () => ([0.1, 0.02, 0.22, 0.42, 0.62, 0.82][n++] ?? 0.15); } },
  RunStatistics: { createStableMatchId: (run, match) => run.runId + "::" + match.nodeId + "::five_v_five::" + match.attemptNumber },
  InazumaProgression: { getPlayerAtLevel: (player, level) => ({ ...player, overall: 40 + level }) },
  FiveFormationFloatingPicker: { close() {}, prepare() {} },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "five-match-presentation.js" });

let run = {
  runId: "run-five", teamLevel: 3, roster: [{ playerId: "owned" }], statistics: { processedMatchIds: {} },
  currentZone: { currentNodeId: "previous" }, fiveVFive: { formation: "1-2-1", slots: {} }, activeMatch: null,
};
const freeAgents = [
  { playerId: "owned", position: "GK", name: "Owned" },
  { playerId: "gk", position: "GK", name: "GK" },
  { playerId: "df", position: "DF", name: "DF" },
  { playerId: "mf1", position: "MF", name: "MF1" },
  { playerId: "mf2", position: "MF", name: "MF2" },
  { playerId: "fw", position: "FW", name: "FW" },
  { playerId: "extra", position: "FW", name: "Extra" },
];
let freeAgentsDb = { players: freeAgents };
let freeAgentsById = new Map(freeAgents.map(player => [String(player.playerId), player]));
const ui = { bossMatchState: "pre-match", bossMatchLog: [], match: null };
const runtime = context.FiveMatchPresentationRuntime.create({
  getRun: () => run, getUi: () => ui, getFreeAgentsDb: () => freeAgentsDb, getFreeAgentsById: () => freeAgentsById,
  ensureFiveVFive() {}, resolvedRosterPlayer: id => ({ playerId: String(id), name: String(id) }),
  escapeHtml: value => String(value ?? ""), playerPortraitUrl: player => player?.portraitUrl || "portrait.webp", rarityClass: () => "",
  imageFallbackAttributes: () => "", resolvePlayerVisual: () => ({ cardFallbacks: [] }), scrollSnapshot: () => 0,
  renderFivePlayerPicker: () => "", restorePageScroll() {}, commitFiveEditorMutation: () => ({ ok: true }),
  fiveRoleForPlayerId: () => "FW", renderMatch() {}, afterNextPaint: callback => callback(), cssEscape: value => String(value),
});

const node = { id: "node-five" };
const match = runtime.createOrLoadFiveMatch(node);
assert.strictEqual(seededWith, "run-five:node-five:fiveOpponents");
assert.strictEqual(match.type, "five_v_five");
assert.strictEqual(match.state, "pre-match");
assert.strictEqual(match.level, 3);
assert.strictEqual(match.previousNodeId, "previous");
assert.strictEqual(match.opponents.length, 5);
assert.strictEqual(new Set(match.opponents.map(item => item.playerId)).size, 5, "opponents stay unique");
assert.ok(match.opponents.every(item => item.playerId !== "owned"), "owned players stay excluded");
assert.strictEqual(match.matchId, "run-five::node-five::five_v_five::1");
run.activeMatch = match;
assert.strictEqual(runtime.createOrLoadFiveMatch(node), match, "existing valid five match is reused");

run.teamLevel = 8;
assert.strictEqual(runtime.fiveOpponentLevel(), 8, "dynamic run getter is read at call time");
const resolved = runtime.fiveOpponentPlayersBySlot({ ...match, level: 8 });
assert.strictEqual(resolved.GK.displayLevel, 8);
assert.strictEqual(resolved.GK.overall, 48);

const field = runtime.fiveMatchField({ GK: { playerId: "gk", name: "Keeper", position: "GK", category: "Normale", overall: 48, displayLevel: 8 } }, "1-2-1", "opponent");
assert.match(field, /five-match-field-side--opponent/);
assert.match(field, /data-five-match-player="gk"/);
const detail = runtime.fiveMatchPlayerDetail({ playerId: "gk", name: "Keeper", position: "GK", category: "Normale", stats: { save: 7, defense: 5, grit: 6, control: 4 } }, "opponent");
assert.match(detail, /Scheda completa/);
assert.match(detail, /Parata/);
const comparison = runtime.fiveMatchComparisonMarkup([{ stats: { attack: 10, control: 8, defense: 6, grit: 6, speed: 7, save: 1 } }], [{ stats: { attack: 9, control: 7, defense: 5, grit: 5, speed: 6, save: 4 } }], { userStrength: 60, opponentStrength: 55, probability: 58.5, userFormation: "1-2-1", opponentFormation: "1-1-2", userOverall: 60, opponentOverall: 55 });
assert.match(comparison, /58.5%/);
assert.match(comparison, /Svincolati/);

console.log("five-match presentation domain: stable opponent seed, uniqueness, ownership exclusion, dynamic getters and markup parity OK");
