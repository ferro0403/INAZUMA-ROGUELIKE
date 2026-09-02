"use strict";
const assert = require("assert");
const fs = require("fs");
const files = [
  "js/album/album-controller.js", "js/album/album-view.js",
  "js/hall/hall-controller.js", "js/hall/hall-view.js",
  "js/development/development-center-controller.js", "js/development/development-center-view.js",
];
const source = files.map(file => fs.readFileSync(file, "utf8")).join("\n");
for (const forbidden of ["RunState.save(", "persistGameplayMutation(", "commitMatchMutation(", "activeMatch", "currentZone", "lives", "bossIndex", "postBossFlow", "pendingBossVictory"])
  assert.ok(!source.includes(forbidden), `permanent UI modules do not own ${forbidden}`);
assert.match(fs.readFileSync("js/album/album-controller.js", "utf8"), /LEGACY ONE-WAY RUN → ALBUM BACKFILL BRIDGE/);
assert.match(fs.readFileSync("js/app.js", "utf8"), /championTeam/);
for (const leaked of ["getRun()", "getUi()", "getSeasonDb()", "getFreeAgentsDb()"])
  assert.ok(!source.includes(`\${${leaked}}`), `${leaked} is not user-visible HTML`);
console.log("permanent club UI domain characterization: boundaries OK");
