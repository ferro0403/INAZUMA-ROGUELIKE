"use strict";

const fs = require("fs");

let app = fs.readFileSync("js/app.js", "utf8");
const startMarker = "  async function loadSeason(seasonId) {\n";
const endMarker = "  global.__INAZUMA_UI_TEST__ =";
const start = app.indexOf(startMarker);
const end = app.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error("bootstrap block markers missing");

const replacement = `  const appBootstrap = global.AppBootstrapRuntime.create({
    app,
    fetchResource: (...args) => fetch(...args),
    escapeHtml,
    persistenceWritesAllowed,
    renderHome,
    setRun,
    getActiveSeason: () => activeSeason,
    setActiveSeason: (value) => { activeSeason = value; },
    setSeasonDb: (value) => { seasonDb = value; },
    setSeasonPlayersById: (value) => { seasonPlayersById = value; },
    setSeasonTeamsById: (value) => { seasonTeamsById = value; },
    setFreeAgentsDb: (value) => { freeAgentsDb = value; },
    setFreeAgentsById: (value) => { freeAgentsById = value; },
    setPlayerVisualsById: (value) => { playerVisualsById = value; },
  });
  function loadSeason(...args) { return appBootstrap.loadSeason(...args); }
  function showLoadError(...args) { return appBootstrap.showLoadError(...args); }
  function configureAlbumForBootstrap(...args) { return appBootstrap.configureAlbumForBootstrap(...args); }
  function setPermanentClubTestContext(...args) { return appBootstrap.setPermanentClubTestContext(...args); }

`;
app = app.slice(0, start) + replacement + app.slice(end);

const oldInit = "  init();\n})(globalThis);";
if (!app.includes(oldInit)) throw new Error("init call marker missing");
app = app.replace(oldInit, "  appBootstrap.init();\n})(globalThis);");
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/app/app-bootstrap.js")) {
  const anchor = '    <script src="js/app/ui-shell.js?v=20260903-app-ui-shell-1"></script>\n';
  if (!index.includes(anchor)) throw new Error("ui shell index anchor missing");
  index = index.replace(anchor, anchor + '    <script src="js/app/app-bootstrap.js?v=20260903-app-bootstrap-1"></script>\n');
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("app/app-bootstrap.js")) continue;
  const candidates = ['"app/ui-shell.js"', '"js/app/ui-shell.js"'];
  const anchor = candidates.find((candidate) => text.includes(candidate));
  if (!anchor) throw new Error(`ui shell loader anchor missing: ${file}`);
  const insert = anchor.startsWith('"js/') ? '"js/app/app-bootstrap.js", ' : '"app/app-bootstrap.js", ';
  text = text.replace(anchor, anchor + ", " + insert.replace(/, $/, ""));
  fs.writeFileSync(file, text);
}

console.log("application bootstrap extraction applied");
