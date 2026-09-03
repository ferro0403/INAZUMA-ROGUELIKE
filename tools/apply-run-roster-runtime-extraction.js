"use strict";

const fs = require("fs");

function replaceFunction(source, name, replacement) {
  const marker = `  function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const brace = source.indexOf("{", start);
  if (brace < 0) throw new Error(`opening brace not found: ${name}`);
  let depth = 0;
  let quote = null;
  let templateDepth = 0;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (quote === "`" && ch === "$" && next === "{") { templateDepth += 1; depth += 1; i += 1; continue; }
      if (ch === quote && (quote !== "`" || templateDepth === 0)) { quote = null; continue; }
      if (quote === "`" && templateDepth > 0 && ch === "}") { templateDepth -= 1; depth -= 1; continue; }
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; continue; }
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

const stateAnchor = "  let playerVisualsById = new Map();\n";
if (!app.includes(stateAnchor)) throw new Error("state anchor missing");
app = app.replace(stateAnchor, stateAnchor + `  let sharedRunRosterRuntime = null;\n  function runRosterRuntime() {\n    sharedRunRosterRuntime ||= global.RunRosterRuntime.create({\n      getRun: () => run,\n      getSeasonDb: () => seasonDb,\n      getFreeAgentsDb: () => freeAgentsDb,\n      getFreeAgentsById: () => freeAgentsById,\n      getSeasonPlayersById: () => seasonPlayersById,\n      getSeasonTeamsById: () => seasonTeamsById,\n    });\n    return sharedRunRosterRuntime;\n  }\n`);

const adapters = {
  isProfileAwareSeason: '  function isProfileAwareSeason(...args) { return runRosterRuntime().isProfileAwareSeason(...args); }',
  formationById: '  function formationById(...args) { return runRosterRuntime().formationById(...args); }',
  fiveRoleForPlayerId: '  function fiveRoleForPlayerId(...args) { return runRosterRuntime().roleForPlayerId(...args); }',
  effectiveRosterRole: '  function effectiveRosterRole(...args) { return runRosterRuntime().roleForPlayerId(...args); }',
  fiveOverallForPlayerId: '  function fiveOverallForPlayerId(...args) { return runRosterRuntime().overallForPlayerId(...args); }',
  sourcePlayer: '  function sourcePlayer(...args) { return runRosterRuntime().sourcePlayer(...args); }',
  legacyRosterPlayer: '  function legacyRosterPlayer(...args) { return runRosterRuntime().legacyRosterPlayer(...args); }',
  rosterEntry: '  function rosterEntry(...args) { return runRosterRuntime().rosterEntry(...args); }',
  activeBasePotential: '  function activeBasePotential(...args) { return runRosterRuntime().activeBasePotential(...args); }',
  runtimeTrainingState: '  function runtimeTrainingState(...args) { return runRosterRuntime().runtimeTrainingState(...args); }',
  resolvedRosterPlayer: '  function resolvedRosterPlayer(...args) { return runRosterRuntime().resolvedRosterPlayer(...args); }',
  averageOverall: '  function averageOverall(...args) { return runRosterRuntime().averageOverall(...args); }',
  permanentRosterFields: '  function permanentRosterFields(...args) { return runRosterRuntime().permanentRosterFields(...args); }',
  playerTeamIdentity: '  function playerTeamIdentity(...args) { return runRosterRuntime().playerTeamIdentity(...args); }',
  historicalTeamIdentity: '  function historicalTeamIdentity(...args) { return runRosterRuntime().historicalTeamIdentity(...args); }',
  addLevels: '  function addLevels(...args) { return runRosterRuntime().addLevels(...args); }',
};
for (const [name, replacement] of Object.entries(adapters)) app = replaceFunction(app, name, replacement);
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
const indexAnchor = '    <script src="js/player/player-visuals.js?v=20260902-player-presentation-1"></script>\n';
if (!index.includes(indexAnchor)) throw new Error("index player anchor missing");
if (!index.includes('js/run/run-roster-runtime.js')) {
  index = index.replace(indexAnchor, '    <script src="js/run/run-roster-runtime.js?v=20260903-run-roster-runtime-1"></script>\n' + indexAnchor);
}
fs.writeFileSync("index.html", index);

const loaderFiles = [
  "tests/helpers/production-runtime.js",
  "tests/recruitment-production-path-e2e-test.js",
];
for (const file of loaderFiles) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes('run/run-roster-runtime.js')) continue;
  const relativeAnchor = '"player/player-visuals.js"';
  const fullAnchor = '"js/player/player-visuals.js"';
  if (text.includes(relativeAnchor)) text = text.replace(relativeAnchor, '"run/run-roster-runtime.js", ' + relativeAnchor);
  else if (text.includes(fullAnchor)) text = text.replace(fullAnchor, '"js/run/run-roster-runtime.js", ' + fullAnchor);
  else throw new Error(`player loader anchor missing: ${file}`);
  fs.writeFileSync(file, text);
}

let ci = fs.readFileSync(".github/workflows/stacked-regression.yml", "utf8");
if (!ci.includes("tests/run-roster-runtime-domain-test.js")) {
  const anchor = "            tests/player-presentation-production-path-test.js\n";
  if (!ci.includes(anchor)) throw new Error("CI extracted-domain anchor missing");
  ci = ci.replace(anchor, "            tests/run-roster-runtime-domain-test.js\n" + anchor);
  fs.writeFileSync(".github/workflows/stacked-regression.yml", ci);
}

console.log("run roster runtime extraction applied");
