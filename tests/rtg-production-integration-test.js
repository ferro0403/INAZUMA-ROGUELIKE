"use strict";
const assert=require("assert"),fs=require("fs");
const app=fs.readFileSync("js/app.js","utf8");
const index=fs.readFileSync("index.html","utf8");
for(const required of[
  "RoadToGloryStorage.create","RoadToGloryRepository.create","RoadToGloryRunView.create",
  "RoadToGlorySquadView.create","RoadToGloryMatchView.create","RoadToGloryController.create",
  "renderRoadToGlory"
]) assert(app.includes(required), required);
for(const forbidden of["Normale:40","brainwashing:240","scoreDelta","opponentTargetMin","duplicateRefunds"]) assert(!app.includes(forbidden), forbidden);

// The historical stylesheet remains active under the documented staged CSS
// migration; the architecture guard freezes its selector and !important debt.
assert(index.includes("css/road-to-glory.css"), "active transitional RTG CSS must remain loaded");
assert(fs.readFileSync("tests/rtg-css-architecture-test.js","utf8").includes("baselineOccurrences"),"CSS guard must prevent growth of transitional debt");
// The target ownership files exist but are not all loaded yet: the
// documented CSS migration is deliberately staged to avoid visual changes.
assert(index.includes("css/rtg-theme.css"),"active RTG theme must be linked");
const activeTheme=fs.readFileSync("css/rtg-theme.css","utf8");
const activeCore=fs.readFileSync("css/rtg-theme-core.css","utf8");
assert(activeTheme.includes('./rtg-theme-core.css'),"Theme import chain must remain connected");
assert(activeCore.includes('./rtg-theme-base.css'),"Base theme must remain connected");
assert(activeTheme.includes('./rtg-run.css'),"RTG route owner must be imported");
for(const stylesheet of [
  "rtg-foundation.css","rtg-shell.css","rtg-run.css","rtg-squad.css",
  "rtg-match.css","rtg-vending.css","rtg-economy.css"
]) assert(fs.existsSync("css/"+stylesheet), "Target RTG CSS owner is missing: "+stylesheet);

for(const script of["rtg-run-view.js","rtg-squad-view.js","rtg-match-view.js","rtg-controller.js"]) assert(index.includes(script), script);
for(const bootstrap of[
  "js/app/ui-shell.js","js/app/app-bootstrap.js","js/home/home-view.js","js/home/home-controller.js",
  "js/run/run-roster-runtime.js","js/player/player-detail-controller.js","js/app.js"
]) assert(index.includes(bootstrap), bootstrap);
assert(index.indexOf("rtg-controller.js")<index.indexOf("js/app.js"));
console.log("rtg-production-integration-test: PASS");
