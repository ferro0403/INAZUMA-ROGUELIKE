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
assert(index.includes("css/road-to-glory.css"));
for(const script of["rtg-run-view.js","rtg-squad-view.js","rtg-match-view.js","rtg-controller.js"]) assert(index.includes(script), script);
assert(index.indexOf("rtg-controller.js")<index.indexOf("js/app.js"));
console.log("rtg-production-integration-test: PASS");
