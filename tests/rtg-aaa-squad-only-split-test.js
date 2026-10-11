"use strict";
const assert=require("assert"),fs=require("fs");
const controller=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
const squad=fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(squad,/global\.RoadToGlorySquadController=Object\.freeze\(\{create\}\)/,"squad controller global must exist");
assert.match(controller,/function getSquadController\(\)/,"main controller must delegate squad orchestration");
assert.match(controller,/function renderSquad\(\)\{return getSquadController\(\)\.renderSquad\(\);\}/,"renderSquad must stay behind the public facade");

for(const marker of[
  "function nodeById(nodeId){",
  "async function startMatch(nodeId){",
  "function renderMatch(match=campaign?.activeMatch,options={}){",
  "async function chooseEncounter(choice){",
  "function showMatchResult(match){"
]) assert(controller.includes(marker),`match flow must remain inline: ${marker}`);

assert.doesNotMatch(controller,/function getMatchController\(\)/,"match controller extraction must stay reverted");
assert.doesNotMatch(index,/rtg-match-controller\.js/,"production must not load the unstable extracted match controller");

const squadPos=index.indexOf("rtg-squad-controller.js");
const controllerPos=index.indexOf("rtg-controller.js");
assert(squadPos>=0&&controllerPos>squadPos,"squad controller must load before the main RTG controller");

const controllerLines=controller.split("\n").length;
assert(controllerLines<1100,`squad-only extraction should keep rtg-controller.js below 1100 lines, got ${controllerLines}`);
console.log("rtg-aaa-squad-only-split-test: PASS");
