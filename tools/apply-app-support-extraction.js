"use strict";

const fs = require("fs");

function functionBodyBrace(source, start) {
  const openParen = source.indexOf("(", start);
  if (openParen < 0) throw new Error("function parameter list missing");
  let depth = 0, quote = null, escaped = false;
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        const brace = source.indexOf("{", i + 1);
        if (brace < 0) throw new Error("function body missing");
        return brace;
      }
    }
  }
  throw new Error("function parameter list not closed");
}

function replaceFunction(source, name, replacement) {
  const marker = `  function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const brace = functionBodyBrace(source, start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        if (source[end] === "\r") end += 1;
        if (source[end] === "\n") end += 1;
        return source.slice(0, start) + replacement + "\n" + source.slice(end);
      }
    }
  }
  throw new Error(`closing brace not found: ${name}`);
}

let app = fs.readFileSync("js/app.js", "utf8");
const devStart = '  if (DEV_MODE) global.addEventListener("DOMContentLoaded", () => {\n';
const appAnchor = '  const app = document.getElementById("app");\n';
const devStartIndex = app.indexOf(devStart);
const appAnchorIndex = app.indexOf(appAnchor);
if (devStartIndex < 0 || appAnchorIndex < 0 || appAnchorIndex <= devStartIndex) throw new Error("DEV diagnostics bootstrap markers missing");
app = app.slice(0, devStartIndex) + app.slice(appAnchorIndex);

app = replaceFunction(app, "repairResultMessage", '  function repairResultMessage(...args) { return devDiagnostics.repairResultMessage(...args); }');

const diagnosticsStart = "  const gameplayFailureDiagnostics = [];\n";
const persistenceAnchor = "  const persistGameplayMutation = global.GameplayPersistence.create({\n";
const diagnosticsStartIndex = app.indexOf(diagnosticsStart);
const persistenceAnchorIndex = app.indexOf(persistenceAnchor);
if (diagnosticsStartIndex < 0 || persistenceAnchorIndex < 0 || persistenceAnchorIndex <= diagnosticsStartIndex) throw new Error("gameplay diagnostics markers missing");
const diagnosticsReplacement = `  const devDiagnostics = global.AppDevDiagnostics.create({\n    devMode: DEV_MODE,\n    getRun: () => run,\n    getActiveSeason: () => activeSeason,\n    getUi: () => ui,\n    toast: (...args) => toast(...args),\n  });\n  function recordGameplayFailure(...args) { return devDiagnostics.recordGameplayFailure(...args); }\n\n`;
app = app.slice(0, diagnosticsStartIndex) + diagnosticsReplacement + app.slice(persistenceAnchorIndex);

const seamsStart = "  global.__INAZUMA_UI_TEST__ =";
const initAnchor = "  appBootstrap.init();\n";
const seamsStartIndex = app.indexOf(seamsStart);
const initAnchorIndex = app.indexOf(initAnchor);
if (seamsStartIndex < 0 || initAnchorIndex < 0 || initAnchorIndex <= seamsStartIndex) throw new Error("test seam markers missing");
const seamsReplacement = `  const appTestSeams = global.AppTestSeams.create({\n    getRun: () => run, setRun, getUi: () => ui, setUiMatch: (value) => { ui.match = value; }, getAppMarkup: () => app.innerHTML,\n    setSeasonDb: (value) => { seasonDb = value; }, setActiveSeason: (value) => { activeSeason = value; },\n    setSeasonPlayersById: (value) => { seasonPlayersById = value; }, setFreeAgentsDb: (value) => { freeAgentsDb = value; }, setFreeAgentsById: (value) => { freeAgentsById = value; },\n    uiTest: { bindAlbumRosterInteractions, configureAlbumForBootstrap, setPermanentClubTestContext, persistenceWritesAllowed, repairResultMessage, showLoadError, renderHome, renderAlbumCollections, renderAlbumTeams, renderAlbumRoster, renderHallOfFame, renderHallOfFameDetail, renderDevelopmentCenter, developmentCurrencyIcon, bindHallPlayerDetails, startNewRunFromHome, startRunWithIdentity, renderSeasonSelect, selectSeason, resumeRun },\n    recruitment: { recruitPlayer, showPlayerOffer, showNextBossReward, showSpecialMatchReward, openPull },\n    initialDraft: { players: (...args) => initialDraftPlayers(...args), renderFormationChoice: (...args) => renderFormationChoice(...args), renderDraft: (...args) => renderDraft(...args) },\n    terminal: {\n      completeBossMatch, completeFiveMatch, completeSpecialMatch, forceMatchOutcome, startMatchSimulation, stepMatchPlayback, skipMatchToResult, resumeMatchSimulationIfNeeded,\n      recoverInterruptedMatchAccess, recoverInterruptedSpecialMatchAccess, recoverInterruptedBossAccess, resumeRun, updateMatchControlsDom, leaveMatchViaSectionRoot,\n      enterNode, dispatchNode, enterMatchFromNode, activePullNodeById, useScoutTokenOnPull, useLuckyCharmOnPull, completePullNodeMutation, renderItemRewardResult, resolveItemNode, resumePendingItemReward, ensurePendingItemReward, finishNonMatchNode,\n      recoverLegacyResolvedMatchRoutingIfNeeded, continueAfterMatch, resolvePendingRunFlow, showNextBossReward, advanceBossReward, finishBossVictoryTransition, navigateBossVictoryDestination,\n      resumeRunFinalization, renderGameOver, renderMatch, specialMatchOpponentMeta: (match) => specialMatchView.opponentMeta(match), renderFiveVFive, renderSquad,\n      showPlayerDetailsFor, showPlayerDetails, openFiveVFiveEditor, openFiveMatchPlayerSwap, resolveDevelopmentEndRunFlow, renderMap, renderMapFailureRecovery, renderInventory,\n      chooseEquipmentPlayer: inventoryController.chooseEquipmentPlayer, useInventoryItem: inventoryController.useInventoryItem, inventoryModel, ensureCurrentZoneMutation,\n    },\n  });\n  devDiagnostics.exposeGlobalDiagnostics();\n  appTestSeams.install();\n`;
app = app.slice(0, seamsStartIndex) + seamsReplacement + app.slice(initAnchorIndex);
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/app/dev-diagnostics.js")) {
  const anchor = '    <script src="js/profile/team-profile-runtime.js?v=20260903-team-profile-1"></script>\n';
  if (!index.includes(anchor)) throw new Error("team profile index anchor missing");
  index = index.replace(anchor, anchor + '    <script src="js/app/dev-diagnostics.js?v=20260903-app-support-1"></script>\n    <script src="js/app/test-seams.js?v=20260903-app-support-1"></script>\n');
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("app/dev-diagnostics.js")) continue;
  const candidates = ['"profile/team-profile-runtime.js"', '"js/profile/team-profile-runtime.js"'];
  const anchor = candidates.find((candidate) => text.includes(candidate));
  if (!anchor) throw new Error(`team profile loader anchor missing: ${file}`);
  const prefix = anchor.startsWith('"js/') ? 'js/' : '';
  text = text.replace(anchor, `${anchor}, "${prefix}app/dev-diagnostics.js", "${prefix}app/test-seams.js"`);
  fs.writeFileSync(file, text);
}

console.log("app support extraction applied");
