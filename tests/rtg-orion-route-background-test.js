"use strict";
const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

const assetPath="assets/rtg/rtg-orion-route-map-user.webp";
const bytes=fs.readFileSync(assetPath);
assert(bytes.length>100000,"Orion route image must be the complete non-placeholder artwork");
assert.strictEqual(bytes.toString("ascii",0,4),"RIFF");
assert.strictEqual(bytes.toString("ascii",8,12),"WEBP");

const ctx={console};ctx.globalThis=ctx;
for(const file of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-route-view.js"]){
  vm.runInNewContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const config=ctx.RoadToGloryConfig;
assert.strictEqual(config.ORION.routeBackground,assetPath);
assert.notStrictEqual(config.ORION.routeBackground,config.ARES.routeBackground);

const aresSentinel="data:image/webp;base64,ARES_ONLY_ARTWORK";
ctx.__RTG_ARES_ROUTE_MAP_DATA_URL=aresSentinel;
const routeView=ctx.RoadToGloryRouteView.create({
  escapeHtml:String,
  teamEmblemMarkup:id=>`<i>${id}</i>`,
  seasonNumber:id=>config.season(id)?.seasonNumber||1,
  header:()=>"",
  tabs:()=>"",
});
function render(seasonId){
  const nodes=Array.from(config.buildSeasonNodes(seasonId)).slice(0,6);
  return routeView.runMarkup({
    state:{activeSeasonId:seasonId,currentNodeId:nodes[0].id,tokens:1000,lives:2,attemptsByNode:{},defeatedTeamIds:[]},
    nodes,seasonDb:{teams:[]},seasonConfig:config.season(seasonId),
  });
}
const orionMarkup=render("orion");
assert(orionMarkup.includes(`--rtg-route-image:url('/${assetPath}')`),"Orion must render its own attached island");
assert(!orionMarkup.includes(aresSentinel),"Orion must never render the runtime Ares data URL");
const aresMarkup=render("ie2");
assert(aresMarkup.includes(aresSentinel),"Ares must retain its existing runtime map");

const controller=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert(controller.includes('if(activeSeasonId()==="ie2"){'),"Orion must not fetch Ares map chunks");
const index=fs.readFileSync("index.html","utf8");
assert(index.includes("rtg-config.js?v=20261011-balanced-economy-1"),"rtg-config mobile cache key is stale");
assert(index.includes("rtg-route-view.js?v=20261021-unified-coach-cards-1"),"rtg-route-view mobile cache key is stale");
assert(index.includes("rtg-controller.js?v=20261022-coach-assign-1"),"rtg-controller mobile cache key is stale");
console.log("RTG Orion: independent attached map, Ares preserved, browser cache refreshed: PASS");
