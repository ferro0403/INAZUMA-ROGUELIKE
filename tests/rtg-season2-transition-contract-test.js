"use strict";const assert=require("assert"),fs=require("fs");
const ctl=["js/road-to-glory/rtg-season-transition-controller.js","js/road-to-glory/rtg-controller.js"].map(file=>fs.readFileSync(file,"utf8")).join("\n"),body=fs.readFileSync("js/road-to-glory/rtg-season-transition-controller.js","utf8");
assert(body.includes("fromConfig?.nextSeasonId"));assert(body.includes('const rewardId=`${fromId}->${nextSeasonId}`'));
assert(body.includes("current.seasonTransitionRewardedIds.includes(rewardId)"));assert(body.includes("current.activeSeasonId=nextSeasonId"));assert(body.includes("current.currentNodeId=firstNode"));assert(body.includes("current.defeatedTeamIds=[]"));assert(body.includes("current.squads[nextSeasonId]"));assert(!/gachaAcquiredCards\s*=\s*\[\]|current\.tokens\s*=\s*0/.test(body));
assert(ctl.includes('[data-rtg-enter-next-season]'));console.log("rtg-season2-transition-contract-test: PASS");
