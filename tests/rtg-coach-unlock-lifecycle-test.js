"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8"),copy=x=>JSON.parse(JSON.stringify(x));
const ctx={console,Math,JSON,Array,Number,String,Object,Set,Map,Promise,Error};
ctx.globalThis=ctx;
ctx.SeasonRegistry={loadDatabase:async seasonId=>({seasonId,players:[],profiles:[]})};
ctx.RoadToGloryRng={int:()=>0};
vm.createContext(ctx);
for(const name of ["rtg-config","rtg-coaches","rtg-season-transition-controller"])
  vm.runInContext(read("js/road-to-glory/"+name+".js"),ctx,{filename:name});
const C=ctx.RoadToGloryConfig,M=ctx.RoadToGloryCoaches;
function state(campaignId,sid,completed=false,ledger=[],owned=[]){
 const cfg=C.season(sid);
 return {campaignId,activeSeasonId:sid,seasonComplete:completed,activeMatch:null,
  seasonTransitionRewardedIds:[...ledger],coachOwnedIds:[...owned],
  coachPullCount:0,campaignSeed:"unlock-lifecycle",tokens:10000,
  currentNodeId:"main:"+cfg.mainTeams.at(-1),
  defeatedTeamIds:completed?[...cfg.mainTeams]:[],
  lives:1,checkpointMainIndex:-1,furthestNodeIndex:0,firstClearMatchIds:[],
  attemptsByNode:{},squads:{[sid]:{formationId:"4-4-2",lineup:["a"],bench:["b"],coachId:"",coachPowerSelection:null}}};
}
function controller(initial){
 let current=copy(initial),writes=0;
 const api=ctx.RoadToGlorySeasonTransitionController.create({
  getCampaign:()=>current,activeSeasonId:()=>current.activeSeasonId,config:C,
  id:String,clone:copy,repository:{update:async(_label,modify)=>{writes++;current=copy(modify(copy(current)));return current;}},
  applyTransition:({campaign})=>{current=campaign;},
  renderRun:()=>current,
 });
 return {api,get:()=>current,writes:()=>writes};
}
const ids=s=>Array.from(M.eligible(s),coach=>String(coach.id)).sort(),expected=values=>[...values].sort();
test("IE1→IE2→IE3 transitions keep prior coach unlocks without prematurely unlocking later ones",async()=>{
 const first=controller(state("rtg-ie-trilogy","ie1",true,["completion:ie1"],["36"]));
 assert.equal(M.status(first.get(),"36"),"owned");
 assert.equal(M.status(first.get(),"208"),"available");
 assert.equal(M.status(first.get(),"1225"),"locked");
 await first.api.enterNextSeason();
 assert.equal(first.get().activeSeasonId,"ie1_s2");
 assert.equal(M.status(first.get(),"36"),"owned");
 assert.deepEqual(ids(first.get()),expected(["208"]));
 assert.equal(M.status(first.get(),"1777"),"locked");
 assert.equal(first.writes(),1);

 const second=controller(state("rtg-ie-trilogy","ie1_s2",true,
  ["completion:ie1","ie1->ie1_s2","completion:ie1_s2"],["36"]));
 assert.deepEqual(ids(second.get()),expected(["208","1225","1329","1275"]));
 await second.api.enterNextSeason();
 assert.equal(second.get().activeSeasonId,"ie1_s3");
 assert.equal(M.status(second.get(),"36"),"owned");
 assert.deepEqual(ids(second.get()),expected(["208","1225","1329","1275"]));
 for(const id of ["1777","1940","1974"])assert.equal(M.status(second.get(),id),"locked");
});
test("Completed IE3→IE1 replay retains every prior coach unlock, including unpurchased ones",async()=>{
 // Legacy clears record only transition IDs; replay must infer both older seasons.
 const end=controller(state("rtg-ie-trilogy","ie1_s3",true,
  ["ie1->ie1_s2","ie1_s2->ie1_s3","completion:ie1_s3"],["36","1225"]));
 assert.equal(M.status(end.get(),"1974"),"available");
 await end.api.restartCompletedCampaign();
 const again=end.get();
 assert.equal(again.activeSeasonId,"ie1");
 assert.equal(again.seasonComplete,false);
 for(const coach of M.CATALOG.filter(c=>["ie1","ie1_s2","ie1_s3"].includes(c.seasonId)))
  assert.equal(M.status(again,coach.id),again.coachOwnedIds.includes(coach.id)?"owned":"available",coach.name);
 assert.deepEqual(ids(again),expected(["208","1329","1275","1777","1940","1974"]));
 assert.equal(M.status(again,"4401"),"locked","other campaign never auto-unlocks");
 assert.equal(again.seasonTransitionRewardedIds.includes("completion:ie1"),true);
 assert.equal(again.seasonTransitionRewardedIds.includes("completion:ie1_s2"),true);
});
test("ARES→Orion progression and Orion→ARES replay retain Yi and René even when not bought",async()=>{
 const ares=controller(state("rtg-ares-orion","ie2",true,["completion:ie2"]));
 assert.deepEqual(ids(ares.get()),["4401"]);
 assert.equal(M.status(ares.get(),"4761"),"locked");
 await ares.api.enterNextSeason();
 assert.equal(ares.get().activeSeasonId,"orion");
 assert.deepEqual(ids(ares.get()),["4401"]);
 assert.equal(M.status(ares.get(),"4761"),"locked");
 const orion=controller(state("rtg-ares-orion","orion",true,
  ["ie2->orion","completion:orion"]));
 assert.deepEqual(ids(orion.get()),expected(["4401","4761"]));
 await orion.api.restartCompletedCampaign();
 assert.equal(orion.get().activeSeasonId,"ie2");
 assert.deepEqual(ids(orion.get()),expected(["4401","4761"]));
 const purchased=M.draw(orion.get(),{int:(_seed,_channel,_count,size)=>size-1});
 assert.equal(purchased.coach.id,"4761");
 assert.equal(M.status(purchased.state,"4761"),"owned");
 assert.equal(M.status(state("rtg-ares-orion","ie2",false,[]),"4761"),"locked");
});
