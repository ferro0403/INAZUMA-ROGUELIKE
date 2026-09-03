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
    if (ch === "}") {
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

const devUiStart = app.indexOf('  if (DEV_MODE) global.addEventListener("DOMContentLoaded", () => {\n');
const appMarker = '  const app = document.getElementById("app");\n';
const devUiEnd = app.indexOf(appMarker);
if (devUiStart < 0 || devUiEnd < 0 || devUiEnd <= devUiStart) throw new Error("DEV diagnostics UI block markers missing");
app = app.slice(0, devUiStart) + app.slice(devUiEnd);

app = replaceFunction(app, "repairResultMessage", '  function repairResultMessage(...args) { return devDiagnostics.repairResultMessage(...args); }');
const diagnosticsArray = "  const gameplayFailureDiagnostics = [];\n";
if (!app.includes(diagnosticsArray)) throw new Error("gameplay diagnostics array missing");
app = app.replace(diagnosticsArray, "");
app = replaceFunction(app, "recordGameplayFailure", '  function recordGameplayFailure(...args) { return devDiagnostics.recordGameplayFailure(...args); }');

const uiAnchor = '    devLegendaryPullSequence: 0,\n  };\n\n  function stopGameplayRuntime()';
if (!app.includes(uiAnchor)) throw new Error("ui state anchor missing");
app = app.replace(uiAnchor, `    devLegendaryPullSequence: 0,\n  };\n\n  const devDiagnostics = global.AppDevDiagnostics.create({\n    devMode: DEV_MODE,\n    getRun: () => run,\n    getUi: () => ui,\n    getActiveSeason: () => activeSeason,\n  });\n  devDiagnostics.installPersistenceTools();\n  devDiagnostics.installGlobalDiagnostics();\n\n  function stopGameplayRuntime()`);

const seamsStart = app.indexOf("  global.__INAZUMA_UI_TEST__ =");
const initMarker = "  appBootstrap.init();\n";
const seamsEnd = app.indexOf(initMarker, seamsStart);
if (seamsStart < 0 || seamsEnd < 0) throw new Error("test seam block markers missing");
const seamsReplacement = `  global.AppTestSeams.install({
    testMode: global.__INAZUMA_TEST_MODE__ === true,
    app,
    getRun: () => run,
    setRun,
    getUi: () => ui,
    setUiMatch: (match) => { ui.match = match; },
    setSeasonDb: (value) => { seasonDb = value; },
    setActiveSeason: (value) => { activeSeason = value; },
    setSeasonPlayersById: (value) => { seasonPlayersById = value; },
    setFreeAgentsDb: (value) => { freeAgentsDb = value; },
    setFreeAgentsById: (value) => { freeAgentsById = value; },
    uiApi: {
      bindAlbumRosterInteractions, configureAlbumForBootstrap, setPermanentClubTestContext, persistenceWritesAllowed,
      repairResultMessage, showLoadError, renderHome, renderAlbumCollections, renderAlbumTeams, renderAlbumRoster,
      renderHallOfFame, renderHallOfFameDetail, renderDevelopmentCenter, developmentCurrencyIcon, bindHallPlayerDetails,
      startNewRunFromHome, startRunWithIdentity, renderSeasonSelect, selectSeason, resumeRun,
    },
    recruitmentApi: { recruitPlayer, showPlayerOffer, showNextBossReward, showSpecialMatchReward, openPull },
    initialDraftApi: {
      players: (...args) => initialDraftPlayers(...args),
      renderFormationChoice: (...args) => renderFormationChoice(...args),
      renderDraft: (...args) => renderDraft(...args),
    },
    terminalApi: {
      completeBossMatch, completeFiveMatch, completeSpecialMatch, forceMatchOutcome, startMatchSimulation,
      stepMatchPlayback, skipMatchToResult, resumeMatchSimulationIfNeeded, recoverInterruptedMatchAccess,
      recoverInterruptedSpecialMatchAccess, recoverInterruptedBossAccess, resumeRun, updateMatchControlsDom,
      leaveMatchViaSectionRoot, enterNode, dispatchNode, enterMatchFromNode, activePullNodeById,
      useScoutTokenOnPull, useLuckyCharmOnPull, completePullNodeMutation, renderItemRewardResult, resolveItemNode,
      resumePendingItemReward, ensurePendingItemReward, finishNonMatchNode, recoverLegacyResolvedMatchRoutingIfNeeded,
      continueAfterMatch, resolvePendingRunFlow, showNextBossReward, advanceBossReward, finishBossVictoryTransition,
      navigateBossVictoryDestination, resumeRunFinalization, renderGameOver, renderMatch,
      specialMatchOpponentMeta: (match) => specialMatchView.opponentMeta(match),
      renderFiveVFive, renderSquad, showPlayerDetailsFor, showPlayerDetails, openFiveVFiveEditor,
      openFiveMatchPlayerSwap, resolveDevelopmentEndRunFlow, renderMap, renderMapFailureRecovery, renderInventory,
      chooseEquipmentPlayer: inventoryController.chooseEquipmentPlayer,
      useInventoryItem: inventoryController.useInventoryItem,
      inventoryModel, ensureCurrentZoneMutation,
    },
  });
`;
app = app.slice(0, seamsStart) + seamsReplacement + app.slice(seamsEnd);
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/app/dev-diagnostics.js")) {
  const anchor = '    <script src="js/app/app-bootstrap.js?v=20260903-app-bootstrap-1"></script>\n';
  if (!index.includes(anchor)) throw new Error("app bootstrap index anchor missing");
  index = index.replace(anchor, anchor + '    <script src="js/app/dev-diagnostics.js?v=20260903-dev-diagnostics-1"></script>\n    <script src="js/app/test-seams.js?v=20260903-test-seams-1"></script>\n');
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("app/dev-diagnostics.js")) continue;
  const candidates = ['"app/app-bootstrap.js"', '"js/app/app-bootstrap.js"'];
  const anchor = candidates.find((candidate) => text.includes(candidate));
  if (!anchor) throw new Error(`app bootstrap loader anchor missing: ${file}`);
  const prefix = anchor.startsWith('"js/') ? "js/" : "";
  text = text.replace(anchor, `${anchor}, "${prefix}app/dev-diagnostics.js", "${prefix}app/test-seams.js"`);
  fs.writeFileSync(file, text);
}

console.log("dev diagnostics and test seam extraction applied");
