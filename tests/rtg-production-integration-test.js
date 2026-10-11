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

assert(!index.includes("css/road-to-glory.css"), "obsolete road-to-glory.css must not be loaded");
for(const stylesheet of[
  "css/rtg-foundation.css","css/rtg-theme.css","css/rtg-shell.css","css/rtg-run.css",
  "css/rtg-squad.css","css/rtg-match.css","css/rtg-vending.css","css/rtg-economy.css"
]) assert(index.includes(stylesheet), stylesheet);

for(const script of["rtg-run-view.js","rtg-squad-view.js","rtg-match-view.js","rtg-controller.js"]) assert(index.includes(script), script);
for(const bootstrap of[
  "js/app/ui-shell.js","js/app/app-bootstrap.js","js/home/home-view.js","js/home/home-controller.js",
  "js/run/run-roster-runtime.js","js/player/player-detail-controller.js","js/app.js"
]) assert(index.includes(bootstrap), bootstrap);
assert(index.indexOf("rtg-controller.js")<index.indexOf("js/app.js"));
console.log("rtg-production-integration-test: PASS");
