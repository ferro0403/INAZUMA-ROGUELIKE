"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={console};context.globalThis=context;
for(const path of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-progression.js","js/road-to-glory/rtg-route-view.js"]){
 vm.runInNewContext(fs.readFileSync(path,"utf8"),context,{filename:path});
}
const C=context.RoadToGloryConfig,P=context.RoadToGloryProgression;
const config=C.ORION,nodes=Array.from(C.buildSeasonNodes("orion"));
assert.strictEqual(config.secondaryMatchesPerGap,1);
assert.strictEqual(nodes.length,25);
assert.strictEqual(nodes.filter(n=>n.type==="main").length,13);
assert.strictEqual(nodes.filter(n=>n.type==="secondary").length,12);
for(let i=0;i<13;i++){
 const main=nodes[i*2];
 assert.strictEqual(main.type,"main");
 assert.strictEqual(main.id,`main:${config.mainTeams[i]}`);
 assert.strictEqual(main.checkpointAfter,config.checkpointMainIndexes.includes(i));
 if(i===12)continue;
 const secondary=nodes[i*2+1],next=config.mainTeams[i+1],before=config.mainTeams[i];
 assert.strictEqual(secondary.type,"secondary");
 assert.strictEqual(secondary.id,`secondary:${before}:${next}:1`);
 assert.strictEqual(secondary.afterTeamId,before);
 assert.strictEqual(secondary.beforeTeamId,next);
 assert.strictEqual(secondary.slot,1);
 assert.strictEqual(secondary.userCap,config.constraints[next].cap);
 assert.strictEqual(secondary.opponentTargetMin,Math.max(70,secondary.userCap-4));
 assert.strictEqual(secondary.opponentTargetMax,secondary.userCap-1);
}
// Existing seasons and the Orion economy must be unaffected.
assert.strictEqual(C.buildSeasonNodes("ie1_s2").filter(n=>n.type==="secondary").length,16);
assert.strictEqual(C.buildSeasonNodes("ie1_s3").filter(n=>n.type==="secondary").length,18);
assert.strictEqual(C.buildSeasonNodes("ie2").filter(n=>n.type==="secondary").length,10);
assert.strictEqual(config.pullCost,300);
assert.strictEqual(config.recruitmentPullCost,150);
const db=JSON.parse(fs.readFileSync("data/ORION_season_compact.json","utf8"));
const escape=String,view=context.RoadToGloryRouteView.create({
 escapeHtml:escape,teamEmblemMarkup:()=>"<span>⚡</span>",seasonNumber:()=>2,
 header:()=>"",tabs:()=>""
});
const start={activeSeasonId:"orion",currentNodeId:nodes[0].id,seasonComplete:false,defeatedTeamIds:[],attemptsByNode:{}};
const markup=view.runMarkup({state:start,nodes,seasonDb:db,seasonConfig:config});
assert.strictEqual((markup.match(/data-rtg-node-id="main:/g)||[]).length,13);
assert.strictEqual((markup.match(/data-rtg-node-id="secondary:/g)||[]).length,12);
assert(markup.includes('data-rtg-node-id="secondary:raging_bulls:fallen_angels:1"'));
assert(markup.includes('data-rtg-node-id="secondary:inazuma_national_2:zhao_eclipse:1"'));
assert(markup.includes('aria-label="Percorso Orion"'));
// A defeat on secondary must not advance, a victory must advance, a replay must not pull progress backwards.
let state={...start,campaignSeed:"orion-secondary-regression",lives:2,tokens:0,checkpointMainIndex:-1,firstClearMatchIds:[],furthestNodeIndex:0};
P.setSeasonContext(state);
let wins=0;
for(const node of nodes){
 assert.strictEqual(state.currentNodeId,node.id,`blocked before ${node.id}`);
 if(node.type==="main"){
  state=P.recordMainVictory(state,{teamId:node.teamId,matchId:node.id});
  wins+=1;
 }else{
  const before=state.tokens;
  const missed=P.recordSecondaryResult(state,{nodeId:node.id,result:"loss",attemptNumber:1});
  assert.strictEqual(missed.currentNodeId,node.id);
  assert.strictEqual(missed.tokens,before);
  assert.strictEqual(missed.attemptsByNode[node.id].clears,0);
  state=P.recordSecondaryResult(missed,{nodeId:node.id,result:"victory",attemptNumber:2});
  assert.strictEqual(state.attemptsByNode[node.id].clears,1);
  assert(state.tokens>before,"victory must award the existing secondary reward");
 }
 if(wins===3&&node.id==="main:eternal_dancers"){
  assert.strictEqual(state.checkpointMainIndex,2);
  const loss1=P.recordMainLoss({...state,lives:1},{nodeId:"main:arabian_firebirds"});
  assert.strictEqual(loss1.currentNodeId,"secondary:eternal_dancers:arabian_firebirds:1","checkpoint rollback must retain the intermediate match");
 }
}
assert.strictEqual(state.seasonComplete,true);
assert.strictEqual(state.defeatedTeamIds.length,13);
assert.strictEqual(Object.keys(state.attemptsByNode).length,12);
assert.strictEqual(state.currentNodeId,"main:zhao_eclipse");
assert.strictEqual(state.furthestNodeIndex,24);
const completedTokens=state.tokens;
const replay=P.recordSecondaryResult(state,{nodeId:nodes[1].id,result:"victory",attemptNumber:3});
assert.strictEqual(replay.currentNodeId,state.currentNodeId);
assert.strictEqual(replay.seasonComplete,true);
assert(replay.tokens>completedTokens);
assert.strictEqual(replay.attemptsByNode[nodes[1].id].clears,2);
// An Orion save already progressed to a boss keeps its existing node ID (no state reset).
const existing={...start,currentNodeId:"main:fallen_angels",defeatedTeamIds:["raging_bulls"],furthestNodeIndex:1};
assert.strictEqual(P.nodeIndex(existing),2);
assert.strictEqual(P.isNodeUnlocked(existing,"main:fallen_angels"),true);
console.log("rtg-orion-secondary-matches-test: all 25 visible nodes, 12 match flows, rewards, checkpoints and saves PASS");
