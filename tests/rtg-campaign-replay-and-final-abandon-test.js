"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),test=require("node:test");
const read=p=>fs.readFileSync(p,"utf8");
const ctx={console,Math,JSON,Set,Map,Array,Object,String,Number,Promise,Error,TypeError};
ctx.globalThis=ctx;
ctx.RoadToGloryRng={weightedPick:()=>({amount:200}),float:()=>0};
ctx.SeasonRegistry={loadDatabase:async sid=>({seasonId:sid,players:[],profiles:[]})};
vm.createContext(ctx);
for(const p of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-progression.js",
  "js/road-to-glory/rtg-season-transition-controller.js",
  "js/road-to-glory/rtg-route-view.js"])
  vm.runInContext(read(p),ctx,{filename:p});
const C=ctx.RoadToGloryConfig,P=ctx.RoadToGloryProgression;
const copy=x=>JSON.parse(JSON.stringify(x));
function finished(campaignId,terminal){
 const cfg=C.season(terminal),last=cfg.mainTeams.at(-1),nodes=C.buildSeasonNodes(terminal);
 const squad={formationId:"4-3-3",lineup:["a","b"],bench:["c"],coachId:"208",
   coachPowerSelection:{coachId:"208",cardIds:["a","b"]},activeRoleVariantByCardId:{a:"fw"}};
 return {
  campaignId,campaignSeed:"permanent-seed",schemaVersion:3,
  activeSeasonId:terminal,seasonComplete:true,currentNodeId:"main:"+last,
  checkpointMainIndex:cfg.checkpointMainIndexes.at(-1),furthestNodeIndex:nodes.length-1,
  lives:1,tokens:5432,defeatedTeamIds:[...cfg.mainTeams],
  firstClearMatchIds:["main:original-final"],attemptsByNode:{sentinel:{clears:4}},
  seasonTransitionRewardedIds:campaignId==="rtg-ie-trilogy"
    ?["ie1->ie1_s2","ie1_s2->ie1_s3"]
    :["ie2->orion"],
  coachOwnedIds:["208","4401"],coachPullCount:31,
  gachaAcquiredCards:[{cardId:"free_agents::100"},{cardId:"ie1_s3::p4"}],
  gacha:{pullCount:19,recruitmentPullCount:6},
  developmentByCardId:{"free_agents::100":{currentRarity:"Elite",targetPotential:95}},
  projects:{Elite:8},squads:{ie1:copy(squad),ie1_s2:copy(squad),ie1_s3:copy(squad),
    ie2:copy(squad),orion:copy(squad)},activeMatch:null,
 };
}
function runner(initial,{fail=false,stale=false}={}){
 let current=copy(initial),writes=0,applies=0,renders=0;
 const transition=ctx.RoadToGlorySeasonTransitionController.create({
  getCampaign:()=>current,activeSeasonId:()=>current.activeSeasonId,id:String,config:C,clone:copy,
  repository:{update:async(_label,mutate)=>{
    writes++;
    if(fail)throw new Error("canonical write failed");
    const draft=copy(current);
    if(stale)draft.activeSeasonId="ie1_s2";
    const result=mutate(draft);
    current=copy(result);return current;
  }},
  applyTransition:payload=>{applies++;current=payload.campaign;},
  renderRun:()=>{renders++;return current},
 });
 return {transition,state:()=>current,counts:()=>({writes,applies,renders})};
}
for(const [campaignId,terminal,first] of [
 ["rtg-ie-trilogy","ie1_s3","ie1"],["rtg-ares-orion","orion","ie2"],
])test("A completed "+terminal+" can restart the full campaign atomically",async()=>{
 const initial=finished(campaignId,terminal),run=runner(initial);
 const state=await run.transition.restartCompletedCampaign();
 assert.equal(state.activeSeasonId,first);
 assert.equal(state.currentNodeId,C.buildSeasonNodes(first)[0].id);
 assert.equal(state.seasonComplete,false);
 assert.equal(state.checkpointMainIndex,-1);
 assert.equal(state.furthestNodeIndex,0);
 assert.equal(state.lives,C.season(first).livesPerCheckpoint);
 assert.deepEqual(copy(state.defeatedTeamIds),[]);
 assert.deepEqual(copy(state.firstClearMatchIds),[]);
 assert.deepEqual(copy(state.attemptsByNode),{});
 assert.equal(state.activeMatch,null);
 for(const key of ["campaignId","campaignSeed","tokens","projects","coachOwnedIds",
   "coachPullCount","gachaAcquiredCards","gacha","developmentByCardId","squads"]){
   assert.deepEqual(copy(state[key]),copy(initial[key]),"permanent field "+key);
 }
 const ledger=new Set(state.seasonTransitionRewardedIds);
 assert(ledger.has("completion:"+terminal),"finished terminal bonus cannot be duplicated");
 assert(ledger.has(campaignId==="rtg-ie-trilogy"?"completion:ie1":"completion:ie2"));
 assert.deepEqual(run.counts(),{writes:1,applies:1,renders:1});
 await assert.rejects(()=>run.transition.restartCompletedCampaign(),{code:"rtg-replay-unavailable"});
 assert.deepEqual(run.counts(),{writes:1,applies:1,renders:1},"second attempt performs no write");
 const replayedFinal={...copy(state),activeSeasonId:terminal,currentNodeId:"main:"+C.season(terminal).mainTeams.at(-1),
  seasonComplete:false,defeatedTeamIds:C.season(terminal).mainTeams.slice(0,-1)};
 const won=P.recordMainVictory(replayedFinal,{teamId:C.season(terminal).mainTeams.at(-1),matchId:"second-final"});
 const reward=C.season(terminal).mainRewards[C.season(terminal).mainTeams.at(-1)];
 assert.equal(won.tokens,state.tokens+reward,"replay awards normal match reward, never one-time finale bonus");
});
test("Restart rejects unfinished campaigns and matches in progress before writing",async()=>{
 for(const change of [{seasonComplete:false},{activeSeasonId:"ie1_s2"},{activeMatch:{matchId:"alive"}}]){
  const run=runner({...finished("rtg-ie-trilogy","ie1_s3"),...change});
  await assert.rejects(()=>run.transition.restartCompletedCampaign(),{code:"rtg-replay-unavailable"});
  assert.equal(run.counts().writes,0);
 }
});
test("Persistence errors and stale canonical state cannot partially restart a campaign",async()=>{
 const base=finished("rtg-ie-trilogy","ie1_s3");
 for(const opts of [{fail:true},{stale:true}]){
  const run=runner(base,opts);
  await assert.rejects(()=>run.transition.restartCompletedCampaign());
  assert.deepEqual(run.state(),base,"canonical current must survive failed commit");
  assert.equal(run.counts().applies,0);
  assert.equal(run.counts().renders,0);
 }
});
for(const sid of C.SEASON_IDS)test(sid+" final: one defeat costs one life; only exhaustion rolls back to checkpoint",()=>{
 const cfg=C.season(sid),teams=cfg.mainTeams;
 const checkpoint=cfg.checkpointMainIndexes.at(-1);
 assert(Number.isInteger(checkpoint)&&checkpoint<teams.length-1);
 const allNodes=C.buildSeasonNodes(sid),after=allNodes.findIndex(x=>x.id==="main:"+teams[checkpoint]);
 const expected=allNodes[after+1]?.id;
 const base={activeSeasonId:sid,campaignSeed:"final-abandon",seasonComplete:false,tokens:1200,
  currentNodeId:"main:"+teams.at(-1),checkpointMainIndex:-1, // old or stale checkpoint index
  defeatedTeamIds:teams.slice(0,-1),firstClearMatchIds:["first"],lives:2,furthestNodeIndex:allNodes.length-1,
  seasonTransitionRewardedIds:[]};
 const firstLoss=P.recordMainLoss(base,{nodeId:base.currentNodeId});
 assert.equal(firstLoss.currentNodeId,base.currentNodeId,"first loss must leave the final match available");
 assert.equal(firstLoss.lives,1);
 assert.equal(firstLoss.tokens,1200);
 const exhausted=P.recordMainLoss(firstLoss,{nodeId:base.currentNodeId});
 assert.equal(exhausted.currentNodeId,expected,"use the most recent ACTUALLY WON checkpoint");
 assert.equal(exhausted.lives,cfg.livesPerCheckpoint);
 assert.equal(exhausted.seasonComplete,false);
 assert.deepEqual(copy(exhausted.firstClearMatchIds),["first"]);
 assert.equal(exhausted.tokens,1200);
 const malformed={...base,checkpointMainIndex:cfg.checkpointMainIndexes.at(-1),defeatedTeamIds:[],lives:1};
 assert.equal(P.recordMainLoss(malformed,{nodeId:base.currentNodeId}).currentNodeId,
  "main:"+teams[0],"a checkpoint not actually earned must not unlock later nodes");
});
test("Only completed terminal Season 3 and Orion maps expose voluntary restart",()=>{
 const view=ctx.RoadToGloryRouteView.create({escapeHtml:x=>String(x),header:()=>"",tabs:()=>"",
   seasonNumber:sid=>C.season(sid)?.seasonNumber||1,
   teamEmblemMarkup:()=>""});
 for(const sid of C.SEASON_IDS){
   const cfg=C.season(sid),state={activeSeasonId:sid,seasonComplete:true,tokens:500,lives:1,
     currentNodeId:"main:"+cfg.mainTeams.at(-1)};
   const html=view.runMarkup({state,nodes:C.buildSeasonNodes(sid),
     seasonDb:{teams:[],bossOrder:[]},seasonConfig:cfg});
   assert.equal(html.includes("data-rtg-restart-campaign"),sid==="ie1_s3"||sid==="orion");
   assert.equal(html.includes("data-rtg-enter-next-season"),!!cfg.nextSeasonId);
   const unfinished=view.runMarkup({state:{...state,seasonComplete:false},nodes:C.buildSeasonNodes(sid),
     seasonDb:{teams:[],bossOrder:[]},seasonConfig:cfg});
   assert(!unfinished.includes("data-rtg-restart-campaign"));
 }
 const controller=read("js/road-to-glory/rtg-controller.js");
 assert.match(controller,/data-rtg-restart-campaign/);
 assert.match(controller,/data-rtg-restart-confirm/);
 assert.match(controller,/await restartCampaign\(\)/);
 const replay=read("js/road-to-glory/rtg-season-transition-controller.js");
 assert.match(replay,/repository\.update\("rtg-restart-completed-campaign"/);
 assert.doesNotMatch(replay,/localStorage\.setItem|firebase|indexedDB/);
});
