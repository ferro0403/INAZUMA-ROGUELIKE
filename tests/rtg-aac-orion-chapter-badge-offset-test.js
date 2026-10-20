"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};
context.globalThis=context;vm.createContext(context);
for(const file of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-route-view.js"]){
  vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
}
const cfg=context.RoadToGloryConfig;
const view=context.RoadToGloryRouteView.create({
  escapeHtml:String,teamEmblemMarkup:teamId=>"<i>"+teamId+"</i>",
  seasonNumber:()=>3,header:()=>"",tabs:()=>""
});
function route(seasonId){
  const nodes=Array.from(cfg.buildSeasonNodes(seasonId));
  return view.runMarkup({
    state:{activeSeasonId:seasonId,currentNodeId:nodes[0].id,tokens:0,lives:2,attemptsByNode:{},defeatedTeamIds:[]},
    nodes,seasonDb:{teams:[]},seasonConfig:cfg.season(seasonId)
  });
}
const orion=route("orion");
assert.match(orion,/left:31%;top:15%[^>]*data-rtg-node-id="main:los_invencibles"/);
assert.match(orion,/left:67%;top:15%[^>]*data-rtg-node-id="main:guardians_of_the_queen"/);
assert(orion.includes("M 31 15"),"chapter 3 SVG must start at the lowered Los Invencibles position");
assert(orion.includes("M 67 15"),"chapter 4 SVG must start at the lowered Guardians position");
assert.match(orion,/left:31%;top:20%[^>]*data-rtg-node-id="main:raging_bulls"/,"existing Orion chapter 1 shift remains");
const ie2=route("ie1_s2");
assert.match(ie2,/left:31%;top:9%[^>]*data-rtg-node-id="main:cloister_divinity"/,"IE2 chapter 3 remains unchanged");
const ares=route("ie2");
assert.match(ares,/left:31%;top:9%[^>]*data-rtg-node-id="main:polestar_academy"/,"Ares map remains unchanged");
console.log("rtg-orion-chapter-badge-offset-test: Orion chapters 3/4, SVG anchors and other Seasons PASS");
