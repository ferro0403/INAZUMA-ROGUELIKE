"use strict";

const fs = require("fs");

function mustReplace(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing replacement target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Replacement target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const appPath = "js/app.js";
let app = fs.readFileSync(appPath, "utf8");

const clusterStartMarker = "  const fiveMatchMarkupCache = new Map();";
const clusterEndMarker = "  function persistMatchState() {";
const clusterStart = app.indexOf(clusterStartMarker);
const clusterEnd = app.indexOf(clusterEndMarker, clusterStart);
if (clusterStart < 0 || clusterEnd <= clusterStart) throw new Error("Five-match presentation cluster markers not found");
const cluster = app.slice(clusterStart, clusterEnd);

for (const required of [
  "function fiveFormationRows(",
  "function fiveUserPlayersBySlot(",
  "function fiveOpponentLevel(",
  "function createOrLoadFiveMatch(",
  "function fiveOpponentPlayersBySlot(",
  "function fiveMatchCard(",
  "function fiveMatchPlayerDetail(",
  "function fiveMatchField(",
  "function openFiveMatchPlayerSwap(",
  "function fiveMatchStatAverage(",
  "function fiveMatchComparisonMarkup(",
  "function formatMatchProbability(",
  "five-match-quick-swap",
  "fiveOpponents",
]) {
  if (!cluster.includes(required)) throw new Error(`Expected cluster token missing: ${required}`);
}

const moduleBody = cluster
  .replace(/\brun\b/g, "getRun()")
  .replace(/\bui\b/g, "getUi()")
  .replace(/\bfreeAgentsDb\b/g, "getFreeAgentsDb()")
  .replace(/\bfreeAgentsById\b/g, "getFreeAgentsById()");

const moduleSource = `(function (global) {\n  "use strict";\n\n  function create(deps = {}) {\n    const {\n      getRun, getUi, getFreeAgentsDb, getFreeAgentsById,\n      ensureFiveVFive, resolvedRosterPlayer, escapeHtml, playerPortraitUrl, rarityClass,\n      imageFallbackAttributes, resolvePlayerVisual, scrollSnapshot, renderFivePlayerPicker,\n      restorePageScroll, commitFiveEditorMutation, fiveRoleForPlayerId, renderMatch,\n      afterNextPaint, cssEscape,\n    } = deps;\n\n    if (typeof getRun !== "function" || typeof getUi !== "function" || typeof getFreeAgentsDb !== "function" || typeof getFreeAgentsById !== "function") {\n      throw new Error("FiveMatchPresentationRuntime requires dynamic state getters");\n    }\n\n${moduleBody}\n    return {\n      fiveFormationRows,\n      fiveUserPlayersBySlot,\n      fiveOpponentLevel,\n      createOrLoadFiveMatch,\n      fiveOpponentPlayersBySlot,\n      fiveMatchCard,\n      fiveMatchPlayerDetail,\n      fiveMatchField,\n      openFiveMatchPlayerSwap,\n      fiveMatchStatAverage,\n      fiveMatchComparisonMarkup,\n      formatMatchProbability,\n    };\n  }\n\n  global.FiveMatchPresentationRuntime = { create };\n})(globalThis);\n`;

const runtimeInsertMarker = "  const matchEngine = global.MatchControllerRuntime.create({";
const runtimeBlock = `  const fiveMatchPresentation = global.FiveMatchPresentationRuntime.create({\n    getRun: () => run,\n    getUi: () => ui,\n    getFreeAgentsDb: () => freeAgentsDb,\n    getFreeAgentsById: () => freeAgentsById,\n    ensureFiveVFive: (...args) => ensureFiveVFive(...args),\n    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),\n    escapeHtml: (...args) => escapeHtml(...args),\n    playerPortraitUrl: (...args) => playerPortraitUrl(...args),\n    rarityClass: (...args) => rarityClass(...args),\n    imageFallbackAttributes: (...args) => imageFallbackAttributes(...args),\n    resolvePlayerVisual: (...args) => resolvePlayerVisual(...args),\n    scrollSnapshot: (...args) => scrollSnapshot(...args),\n    renderFivePlayerPicker: (...args) => renderFivePlayerPicker(...args),\n    restorePageScroll: (...args) => restorePageScroll(...args),\n    commitFiveEditorMutation: (...args) => commitFiveEditorMutation(...args),\n    fiveRoleForPlayerId: (...args) => fiveRoleForPlayerId(...args),\n    renderMatch: (...args) => renderMatch(...args),\n    afterNextPaint: (...args) => afterNextPaint(...args),\n    cssEscape: (...args) => cssEscape(...args),\n  });\n\n`;
app = mustReplace(app, runtimeInsertMarker, runtimeBlock + runtimeInsertMarker, "five-match runtime composition");

const wrappers = `  function fiveFormationRows(...args) { return fiveMatchPresentation.fiveFormationRows(...args); }\n  function fiveUserPlayersBySlot(...args) { return fiveMatchPresentation.fiveUserPlayersBySlot(...args); }\n  function fiveOpponentLevel(...args) { return fiveMatchPresentation.fiveOpponentLevel(...args); }\n  function createOrLoadFiveMatch(...args) { return fiveMatchPresentation.createOrLoadFiveMatch(...args); }\n  function fiveOpponentPlayersBySlot(...args) { return fiveMatchPresentation.fiveOpponentPlayersBySlot(...args); }\n  function fiveMatchCard(...args) { return fiveMatchPresentation.fiveMatchCard(...args); }\n  function fiveMatchPlayerDetail(...args) { return fiveMatchPresentation.fiveMatchPlayerDetail(...args); }\n  function fiveMatchField(...args) { return fiveMatchPresentation.fiveMatchField(...args); }\n  function openFiveMatchPlayerSwap(...args) { return fiveMatchPresentation.openFiveMatchPlayerSwap(...args); }\n  function fiveMatchStatAverage(...args) { return fiveMatchPresentation.fiveMatchStatAverage(...args); }\n  function fiveMatchComparisonMarkup(...args) { return fiveMatchPresentation.fiveMatchComparisonMarkup(...args); }\n  function formatMatchProbability(...args) { return fiveMatchPresentation.formatMatchProbability(...args); }\n\n`;
app = app.slice(0, clusterStart) + wrappers + app.slice(clusterEnd);
fs.writeFileSync(appPath, app);
fs.mkdirSync("js/five-v-five", { recursive: true });
fs.writeFileSync("js/five-v-five/five-match-presentation.js", moduleSource);

let index = fs.readFileSync("index.html", "utf8");
index = mustReplace(
  index,
  '    <script src="js/five-v-five/five-v-five-view.js?v=20260901-five-config-extraction-1"></script>\n',
  '    <script src="js/five-v-five/five-v-five-view.js?v=20260901-five-config-extraction-1"></script>\n    <script src="js/five-v-five/five-match-presentation.js?v=20260903-five-match-presentation-1"></script>\n',
  "production script order",
);
fs.writeFileSync("index.html", index);

const runtimePath = "tests/helpers/production-runtime.js";
let runtime = fs.readFileSync(runtimePath, "utf8");
runtime = mustReplace(
  runtime,
  '  "squad/squad-controller.js", "squad/squad-view.js", "five-v-five/five-v-five-controller.js", "five-v-five/five-v-five-view.js",\n',
  '  "squad/squad-controller.js", "squad/squad-view.js", "five-v-five/five-v-five-controller.js", "five-v-five/five-v-five-view.js", "five-v-five/five-match-presentation.js",\n',
  "production runtime module list",
);
fs.writeFileSync(runtimePath, runtime);

const tacticalPath = "tests/tactical-player-card-test.js";
let tactical = fs.readFileSync(tacticalPath, "utf8");
tactical = mustReplace(
  tactical,
  'const app = fs.readFileSync("js/app.js", "utf8");\nconst matchController = fs.readFileSync("js/match/match-controller.js", "utf8");',
  'const app = fs.readFileSync("js/app.js", "utf8");\nconst fiveMatchPresentation = fs.readFileSync("js/five-v-five/five-match-presentation.js", "utf8");\nconst matchController = fs.readFileSync("js/match/match-controller.js", "utf8");',
  "tactical source import",
);
tactical = mustReplace(
  tactical,
  'const matchRenderer = sourceRange(\n  app,\n  "fiveMatchCard",\n  "function fiveMatchField",\n);\nconst quickDetail = sourceRange(\n  app,\n  "fiveMatchPlayerDetail",\n  "function fiveMatchField",\n);',
  'const matchRenderer = sourceRange(\n  fiveMatchPresentation,\n  "fiveMatchCard",\n  "function fiveMatchPlayerDetail",\n);\nconst quickDetail = sourceRange(\n  fiveMatchPresentation,\n  "fiveMatchPlayerDetail",\n  "function fiveMatchField",\n);',
  "tactical five-match source owner",
);
fs.writeFileSync(tacticalPath, tactical);

const domainTest = `"use strict";\n\nconst assert = require("assert");\nconst fs = require("fs");\nconst vm = require("vm");\n\nconst source = fs.readFileSync("js/five-v-five/five-match-presentation.js", "utf8");\nfor (const forbidden of ["RunState.save", "RunStorage", "Firebase", "Firestore", "CloudSave", "CloudRestore"]) {\n  assert.ok(!source.includes(forbidden), "five-match presentation must not own " + forbidden);\n}\nfor (const token of [\n  "fiveOpponents",\n  "const used = new Set()",\n  "!userIds.has",\n  'type: "five_v_five"',\n  'state: "pre-match"',\n  "five-match-quick-swap",\n  "fiveMatchComparisonMarkup",\n  "fiveMatchPlayerDetail",\n]) assert.ok(source.includes(token), "missing production parity token: " + token);\n\nconst slots = [\n  { key: "GK", role: "GK", line: "goal" },\n  { key: "DF", role: "DF", line: "defense" },\n  { key: "MF1", role: "MF", line: "midfield" },\n  { key: "MF2", role: "MF", line: "midfield" },\n  { key: "FW", role: "FW", line: "attack" },\n];\nconst formations = {\n  "1-2-1": { id: "1-2-1", slots },\n  "1-1-2": { id: "1-1-2", slots },\n};\nlet seededWith = null;\nconst context = {\n  console, Map, Set, Object, Array, String, Number, Math, JSON, Error, Intl,\n  document: { querySelector: () => null },\n  FiveVFive: { formationById: id => formations[id] || formations["1-2-1"] },\n  DraftEngine: { randomFromSeed(seed) { seededWith = seed; let n = 0; return () => ([0.1, 0.02, 0.22, 0.42, 0.62, 0.82][n++] ?? 0.15); } },\n  RunStatistics: { createStableMatchId: (run, match) => run.runId + "::" + match.nodeId + "::five_v_five::" + match.attemptNumber },\n  InazumaProgression: { getPlayerAtLevel: (player, level) => ({ ...player, overall: 40 + level }) },\n  FiveFormationFloatingPicker: { close() {}, prepare() {} },\n};\ncontext.globalThis = context;\nvm.createContext(context);\nvm.runInContext(source, context, { filename: "five-match-presentation.js" });\n\nlet run = {\n  runId: "run-five", teamLevel: 3, roster: [{ playerId: "owned" }], statistics: { processedMatchIds: {} },\n  currentZone: { currentNodeId: "previous" }, fiveVFive: { formation: "1-2-1", slots: {} }, activeMatch: null,\n};\nconst freeAgents = [\n  { playerId: "owned", position: "GK", name: "Owned" },\n  { playerId: "gk", position: "GK", name: "GK" },\n  { playerId: "df", position: "DF", name: "DF" },\n  { playerId: "mf1", position: "MF", name: "MF1" },\n  { playerId: "mf2", position: "MF", name: "MF2" },\n  { playerId: "fw", position: "FW", name: "FW" },\n  { playerId: "extra", position: "FW", name: "Extra" },\n];\nlet freeAgentsDb = { players: freeAgents };\nlet freeAgentsById = new Map(freeAgents.map(player => [String(player.playerId), player]));\nconst ui = { bossMatchState: "pre-match", bossMatchLog: [], match: null };\nconst runtime = context.FiveMatchPresentationRuntime.create({\n  getRun: () => run, getUi: () => ui, getFreeAgentsDb: () => freeAgentsDb, getFreeAgentsById: () => freeAgentsById,\n  ensureFiveVFive() {}, resolvedRosterPlayer: id => ({ playerId: String(id), name: String(id) }),\n  escapeHtml: value => String(value ?? ""), playerPortraitUrl: player => player?.portraitUrl || "portrait.webp", rarityClass: () => "",\n  imageFallbackAttributes: () => "", resolvePlayerVisual: () => ({ cardFallbacks: [] }), scrollSnapshot: () => 0,\n  renderFivePlayerPicker: () => "", restorePageScroll() {}, commitFiveEditorMutation: () => ({ ok: true }),\n  fiveRoleForPlayerId: () => "FW", renderMatch() {}, afterNextPaint: callback => callback(), cssEscape: value => String(value),\n});\n\nconst node = { id: "node-five" };\nconst match = runtime.createOrLoadFiveMatch(node);\nassert.strictEqual(seededWith, "run-five:node-five:fiveOpponents");\nassert.strictEqual(match.type, "five_v_five");\nassert.strictEqual(match.state, "pre-match");\nassert.strictEqual(match.level, 3);\nassert.strictEqual(match.previousNodeId, "previous");\nassert.strictEqual(match.opponents.length, 5);\nassert.strictEqual(new Set(match.opponents.map(item => item.playerId)).size, 5, "opponents stay unique");\nassert.ok(match.opponents.every(item => item.playerId !== "owned"), "owned players stay excluded");\nassert.strictEqual(match.matchId, "run-five::node-five::five_v_five::1");\nrun.activeMatch = match;\nassert.strictEqual(runtime.createOrLoadFiveMatch(node), match, "existing valid five match is reused");\n\nrun.teamLevel = 8;\nassert.strictEqual(runtime.fiveOpponentLevel(), 8, "dynamic run getter is read at call time");\nconst resolved = runtime.fiveOpponentPlayersBySlot({ ...match, level: 8 });\nassert.strictEqual(resolved.GK.displayLevel, 8);\nassert.strictEqual(resolved.GK.overall, 48);\n\nconst field = runtime.fiveMatchField({ GK: { playerId: "gk", name: "Keeper", position: "GK", category: "Normale", overall: 48, displayLevel: 8 } }, "1-2-1", "opponent");\nassert.match(field, /five-match-field-side--opponent/);\nassert.match(field, /data-five-match-player="gk"/);\nconst detail = runtime.fiveMatchPlayerDetail({ playerId: "gk", name: "Keeper", position: "GK", category: "Normale", stats: { save: 7, defense: 5, grit: 6, control: 4 } }, "opponent");\nassert.match(detail, /Scheda completa/);\nassert.match(detail, /Parata/);\nconst comparison = runtime.fiveMatchComparisonMarkup([{ stats: { attack: 10, control: 8, defense: 6, grit: 6, speed: 7, save: 1 } }], [{ stats: { attack: 9, control: 7, defense: 5, grit: 5, speed: 6, save: 4 } }], { userStrength: 60, opponentStrength: 55, probability: 58.5, userFormation: "1-2-1", opponentFormation: "1-1-2", userOverall: 60, opponentOverall: 55 });\nassert.match(comparison, /58.5%/);\nassert.match(comparison, /Svincolati/);\n\nconsole.log("five-match presentation domain: stable opponent seed, uniqueness, ownership exclusion, dynamic getters and markup parity OK");\n`;
fs.writeFileSync("tests/five-match-presentation-domain-test.js", domainTest);

const ciPath = ".github/workflows/stacked-regression.yml";
let ci = fs.readFileSync(ciPath, "utf8");
ci = mustReplace(
  ci,
  "            tests/five-prematch-commit-boundary-test.js\n",
  "            tests/five-match-presentation-domain-test.js\n            tests/five-prematch-commit-boundary-test.js\n",
  "stacked CI five-match domain test",
);
fs.writeFileSync(ciPath, ci);

console.log("five-match presentation extraction applied");
