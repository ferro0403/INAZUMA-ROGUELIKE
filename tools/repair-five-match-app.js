"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");

function mustReplace(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing replacement target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Replacement target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let app = execFileSync("git", ["show", "HEAD:js/app.js"], { encoding: "utf8" });
const startMarker = "  const fiveMatchMarkupCache = new Map();";
const endMarker = "  function persistMatchState() {";
const start = app.indexOf(startMarker);
const end = app.indexOf(endMarker, start);
if (start < 0 || end <= start) throw new Error("Original five-match cluster not found");

const wrappers = `  function fiveFormationRows(...args) { return fiveMatchPresentation.fiveFormationRows(...args); }\n  function fiveUserPlayersBySlot(...args) { return fiveMatchPresentation.fiveUserPlayersBySlot(...args); }\n  function fiveOpponentLevel(...args) { return fiveMatchPresentation.fiveOpponentLevel(...args); }\n  function createOrLoadFiveMatch(...args) { return fiveMatchPresentation.createOrLoadFiveMatch(...args); }\n  function fiveOpponentPlayersBySlot(...args) { return fiveMatchPresentation.fiveOpponentPlayersBySlot(...args); }\n  function fiveMatchCard(...args) { return fiveMatchPresentation.fiveMatchCard(...args); }\n  function fiveMatchPlayerDetail(...args) { return fiveMatchPresentation.fiveMatchPlayerDetail(...args); }\n  function fiveMatchField(...args) { return fiveMatchPresentation.fiveMatchField(...args); }\n  function openFiveMatchPlayerSwap(...args) { return fiveMatchPresentation.openFiveMatchPlayerSwap(...args); }\n  function fiveMatchStatAverage(...args) { return fiveMatchPresentation.fiveMatchStatAverage(...args); }\n  function fiveMatchComparisonMarkup(...args) { return fiveMatchPresentation.fiveMatchComparisonMarkup(...args); }\n  function formatMatchProbability(...args) { return fiveMatchPresentation.formatMatchProbability(...args); }\n\n`;
app = app.slice(0, start) + wrappers + app.slice(end);

const marker = "  const matchEngine = global.MatchControllerRuntime.create({";
const runtimeBlock = `  const fiveMatchPresentation = global.FiveMatchPresentationRuntime.create({\n    getRun: () => run,\n    getUi: () => ui,\n    getFreeAgentsDb: () => freeAgentsDb,\n    getFreeAgentsById: () => freeAgentsById,\n    ensureFiveVFive: (...args) => ensureFiveVFive(...args),\n    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),\n    escapeHtml: (...args) => escapeHtml(...args),\n    playerPortraitUrl: (...args) => playerPortraitUrl(...args),\n    rarityClass: (...args) => rarityClass(...args),\n    imageFallbackAttributes: (...args) => imageFallbackAttributes(...args),\n    resolvePlayerVisual: (...args) => resolvePlayerVisual(...args),\n    scrollSnapshot: (...args) => scrollSnapshot(...args),\n    renderFivePlayerPicker: (...args) => renderFivePlayerPicker(...args),\n    restorePageScroll: (...args) => restorePageScroll(...args),\n    commitFiveEditorMutation: (...args) => commitFiveEditorMutation(...args),\n    fiveRoleForPlayerId: (...args) => fiveRoleForPlayerId(...args),\n    renderMatch: (...args) => renderMatch(...args),\n    afterNextPaint: (...args) => afterNextPaint(...args),\n    cssEscape: (...args) => cssEscape(...args),\n  });\n\n`;
app = mustReplace(app, marker, runtimeBlock + marker, "five-match runtime composition");
fs.writeFileSync("js/app.js", app);
console.log("app.js repaired from HEAD with exact cluster replacement");
