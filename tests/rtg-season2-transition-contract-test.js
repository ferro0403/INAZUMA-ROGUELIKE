"use strict";const assert=require("assert"),fs=require("fs");
const ctl=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),body=ctl.slice(ctl.indexOf("async function enterNextSeason"),ctl.indexOf("function rtgAlbumEntries"));
assert(body.includes("fromConfig?.nextSeasonId"));assert(body.includes('const rewardId=`${fromId}->${nextSeasonId}`'));
assert(body.includes("current.seasonTransitionRewardedIds.includes(rewardId)"));assert(body.includes("current.activeSeasonId=nextSeasonId"));assert(body.includes("current.currentNodeId=firstNode"));assert(body.includes("current.defeatedTeamIds=[]"));assert(body.includes("current.squads[nextSeasonId]"));assert(!/gachaAcquiredCards\s*=\s*\[\]|current\.tokens\s*=\s*0/.test(body));
assert(ctl.includes('[data-rtg-enter-next-season]'));console.log("rtg-season2-transition-contract-test: PASS");
