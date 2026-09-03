"use strict";

const fs = require("fs");
const path = require("path");

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`missing replacement anchor: ${label}`);
  return source.replace(from, to);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`missing range: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const appPath = "js/app.js";
let app = fs.readFileSync(appPath, "utf8");

const runtimeAnchor = "  const hallView = global.HallView.create({ escapeHtml, sectionRootButton });";
const runtimeBlock = `  const championSnapshotRuntime = global.ChampionSnapshotRuntime.create({
    getRun: () => run,
    getSeasonDb: () => seasonDb,
    sourcePlayer: (...args) => sourcePlayer(...args),
    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),
    rosterEntry: (...args) => rosterEntry(...args),
    playerPortraitUrl: (...args) => playerPortraitUrl(...args),
    resolvePlayerVisual: (...args) => resolvePlayerVisual(...args),
    normalizeTeamIdentity: (...args) => normalizeTeamIdentity(...args),
  });
  const championPresentation = global.ChampionPresentation.create({
    getSeasonDb: () => seasonDb,
    escapeHtml: (...args) => escapeHtml(...args),
    formatDate: (...args) => formatDate(...args),
    compactPlayerCardMarkup: (...args) => compactPlayerCardMarkup(...args),
  });

${runtimeAnchor}`;
app = mustReplace(app, runtimeAnchor, runtimeBlock, "champion runtimes before Hall controller");

app = replaceRange(
  app,
  "  function snapshotPlayer(entry, area, slot) {",
  "  function persistChampionBeforeFinalUi(finalBoss = null) {",
  `  function snapshotPlayer(...args) { return championSnapshotRuntime.snapshotPlayer(...args); }
  function collectPlayerStatistics(...args) { return championSnapshotRuntime.collectPlayerStatistics(...args); }
  function buildChampionSnapshot(...args) { return championSnapshotRuntime.buildChampionSnapshot(...args); }

`,
  "champion snapshot helpers",
);

app = replaceRange(
  app,
  "  function snapshotCard(player) {",
  "  function bindFinalTabs() {",
  `  function snapshotCard(...args) { return championPresentation.snapshotCard(...args); }
  function championFormationMarkup(...args) { return championPresentation.championFormationMarkup(...args); }
  function championFiveVFiveMarkup(...args) { return championPresentation.championFiveVFiveMarkup(...args); }
  function compactSeed(...args) { return championPresentation.compactSeed(...args); }
  function formatStatValue(...args) { return championPresentation.formatStatValue(...args); }
  function runStatsSections(...args) { return championPresentation.runStatsSections(...args); }
  function statsMarkup(...args) { return championPresentation.statsMarkup(...args); }
  function awardsMarkup(...args) { return championPresentation.awardsMarkup(...args); }
  function playerStatsMarkup(...args) { return championPresentation.playerStatsMarkup(...args); }

`,
  "champion Hall/final presentation helpers",
);

fs.writeFileSync(appPath, app);

const indexPath = "index.html";
let index = fs.readFileSync(indexPath, "utf8");
const hallScript = "    <script src=\"js/hall/hall-view.js?v=20260902-permanent-club-ui-1\"></script>";
index = mustReplace(
  index,
  hallScript,
  `    <script src="js/hall/champion-snapshot.js?v=20260903-champion-hall-extraction-1"></script>\n    <script src="js/hall/champion-presentation.js?v=20260903-champion-hall-extraction-1"></script>\n${hallScript}`,
  "browser Hall runtime load order",
);
fs.writeFileSync(indexPath, index);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

let loaderUpdates = 0;
for (const file of walk("tests")) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("js/hall/champion-snapshot.js")) continue;
  const doubleAnchor = '"js/hall/hall-view.js"';
  const singleAnchor = "'js/hall/hall-view.js'";
  let next = source;
  if (next.includes(doubleAnchor)) {
    next = next.replace(doubleAnchor, '"js/hall/champion-snapshot.js","js/hall/champion-presentation.js","js/hall/hall-view.js"');
  } else if (next.includes(singleAnchor)) {
    next = next.replace(singleAnchor, "'js/hall/champion-snapshot.js','js/hall/champion-presentation.js','js/hall/hall-view.js'");
  }
  if (next !== source) {
    fs.writeFileSync(file, next);
    loaderUpdates += 1;
  }
}

console.log(`champion/Hall extraction applied; updated ${loaderUpdates} test loader(s)`);
