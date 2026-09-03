"use strict";

const fs = require("fs");

let app = fs.readFileSync("js/app.js", "utf8");

const devToolsStart = '  if (DEV_MODE) global.addEventListener("DOMContentLoaded", () => {\n';
const appMarker = '  const app = document.getElementById("app");\n';
const devStart = app.indexOf(devToolsStart);
const appStart = app.indexOf(appMarker);
if (devStart < 0 || appStart < 0 || appStart <= devStart) throw new Error("top diagnostics block markers missing");
app = app.slice(0, devStart) + app.slice(appStart);

const repairStart = '  function repairResultMessage(result = {}) {\n';
const persistenceMarker = '  function persistenceWritesAllowed() {\n';
const repairIndex = app.indexOf(repairStart);
const persistenceIndex = app.indexOf(persistenceMarker);
if (repairIndex < 0 || persistenceIndex < 0 || persistenceIndex <= repairIndex) throw new Error("repairResultMessage markers missing");
app = app.slice(0, repairIndex) + app.slice(persistenceIndex);

const diagnosticsStart = '  const gameplayFailureDiagnostics = [];\n';
const persistenceRuntimeMarker = '  const persistGameplayMutation = global.GameplayPersistence.create({\n';
const diagnosticsIndex = app.indexOf(diagnosticsStart);
const runtimeIndex = app.indexOf(persistenceRuntimeMarker);
if (diagnosticsIndex < 0 || runtimeIndex < 0 || runtimeIndex <= diagnosticsIndex) throw new Error("gameplay diagnostics markers missing");
const diagnosticsReplacement = `  const devDiagnosticsRuntime = global.AppDevDiagnosticsRuntime.create({\n    devMode: DEV_MODE,\n    getRun: () => run,\n    getUi: () => ui,\n    getActiveSeason: () => activeSeason,\n  });\n  devDiagnosticsRuntime.mountPersistenceTools();\n  function repairResultMessage(...args) { return devDiagnosticsRuntime.repairResultMessage(...args); }\n  function recordGameplayFailure(...args) { return devDiagnosticsRuntime.recordGameplayFailure(...args); }\n\n`;
app = app.slice(0, diagnosticsIndex) + diagnosticsReplacement + app.slice(runtimeIndex);

const globalDiagnosticsStart = '  if (DEV_MODE) global.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__ =';
const testSeamMarker = '  if (global.__INAZUMA_TEST_MODE__ === true) {\n';
const globalsIndex = app.indexOf(globalDiagnosticsStart);
const testIndex = app.indexOf(testSeamMarker);
if (globalsIndex < 0 || testIndex < 0 || testIndex <= globalsIndex) throw new Error("bottom diagnostics markers missing");
app = app.slice(0, globalsIndex) + '  devDiagnosticsRuntime.installGlobals();\n' + app.slice(testIndex);
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/app/dev-diagnostics-runtime.js")) {
  const anchor = '    <script src="js/profile/team-profile-runtime.js?v=20260903-team-profile-1"></script>\n';
  if (!index.includes(anchor)) throw new Error("team profile index anchor missing");
  index = index.replace(anchor, anchor + '    <script src="js/app/dev-diagnostics-runtime.js?v=20260903-dev-diagnostics-1"></script>\n');
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("app/dev-diagnostics-runtime.js")) continue;
  const candidates = ['"profile/team-profile-runtime.js"', '"js/profile/team-profile-runtime.js"'];
  const anchor = candidates.find((candidate) => text.includes(candidate));
  if (!anchor) throw new Error(`team profile loader anchor missing: ${file}`);
  const insert = anchor.startsWith('"js/') ? '"js/app/dev-diagnostics-runtime.js"' : '"app/dev-diagnostics-runtime.js"';
  text = text.replace(anchor, `${anchor}, ${insert}`);
  fs.writeFileSync(file, text);
}

console.log("dev diagnostics extraction applied");
