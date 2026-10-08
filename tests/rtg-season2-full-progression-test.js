"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const ctx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),ctx);
ctx.RoadToGloryRng={weightedPick:items=>items[0],float:()=>0};
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-progression.js","utf8"),ctx);
const C=ctx.RoadToGloryConfig,P=ctx.RoadToGloryProgression,nodes=Array.from(C.buildSeasonNodes("ie1_s2"));
let s={activeSeasonId:"ie1_s2",seasonComplete:false,lives:2,checkpointMainIndex:-1,currentNodeId:nodes[0].id,furthestNodeIndex:0,defeatedTeamIds:[],firstClearMatchIds:[],attemptsByNode:{},tokens:0,campaignSeed:"s2-full"};
P.setSeasonContext(s);
let expectedTokens=0;
for(const node of nodes){
 assert.strictEqual(s.currentNodeId,node.id,`route stopped before ${node.id}`);
 if(node.type==="main"){
   s=P.recordMainVictory(s,{teamId:node.teamId,matchId:`m-${node.mainIndex}`});
   expectedTokens+=Number(C.SEASON2.mainRewards[node.teamId]||0);
 }else{
   s=P.recordSecondaryResult(s,{nodeId:node.id,result:"victory",attemptNumber:1});
   expectedTokens+=Number(C.SEASON2.secondaryRewards[0].amount);
 }
}
assert.strictEqual(s.seasonComplete,true,"final Raimon S2 victory must complete Season 2");
assert.strictEqual(s.currentNodeId,"main:raimon_inazuma_eleven_2","final node remains selected after completion");
assert.strictEqual(s.defeatedTeamIds.length,17);
assert.strictEqual(new Set(s.defeatedTeamIds).size,17);
assert.strictEqual(s.firstClearMatchIds.length,17);
assert.strictEqual(s.tokens,expectedTokens);
assert.strictEqual(s.checkpointMainIndex,14,"last checkpoint must remain after match 15");
assert.strictEqual(s.lives,2);
assert.strictEqual(P.nextNodeId(s),null);
assert.strictEqual(P.isNodeUnlocked(s,nodes[0].id),true);
assert.strictEqual(P.isNodeUnlocked(s,nodes.at(-1).id),true);
console.log("rtg-season2-full-progression-test: PASS");
