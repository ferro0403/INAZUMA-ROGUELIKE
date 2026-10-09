"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={console};c.globalThis=c;
for(const p of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-season-transition-controller.js"])vm.runInNewContext(fs.readFileSync(p,"utf8"),c,{filename:p});
const cfg=c.RoadToGloryConfig,db={seasonId:"orion",players:[]};c.SeasonRegistry={loadDatabase:async id=>{assert.strictEqual(id,"orion");return db;}};
const cards=["ie1::100","ie1_s2::200","ie1_s3::300","ie2::400"];
const squad={formationId:"4-3-3",lineup:cards,bench:["free_agents::500"],activeRoleVariantByCardId:{}};
let state={activeSeasonId:"ie2",seasonComplete:true,tokens:410,seasonTransitionRewardedIds:[],lives:1,checkpointMainIndex:8,currentNodeId:"main:barcelona_orb",defeatedTeamIds:["barcelona_orb"],firstClearMatchIds:[],attemptsByNode:{},activeMatch:null,squads:{ie2:squad},gachaAcquiredCards:cards.map(cardId=>({cardId})),developmentByCardId:{"ie2::400":{currentRarity:"Leggenda"}}};
const old=JSON.parse(JSON.stringify(state));let applied=null,commits=0;
const rt=c.RoadToGlorySeasonTransitionController.create({
 getCampaign:()=>state,activeSeasonId:()=>state.activeSeasonId,config:cfg,id:String,clone:v=>JSON.parse(JSON.stringify(v)),
 repository:{update:async(_label,mutator)=>{commits++;state=mutator(JSON.parse(JSON.stringify(state)));return state;}},
 applyTransition:v=>{applied=v;state=v.campaign;},renderRun:()=>state
});
(async()=>{
 await rt.enterNextSeason();assert.strictEqual(state.activeSeasonId,"orion");assert.strictEqual(state.tokens,1410);
 assert.deepStrictEqual(state.seasonTransitionRewardedIds,["ie2->orion"]);assert.strictEqual(state.currentNodeId,"main:raging_bulls");
 assert.strictEqual(state.lives,2);assert.strictEqual(state.seasonComplete,false);
 assert.deepStrictEqual(state.squads.orion,old.squads.ie2);assert.deepStrictEqual(state.squads.ie2,old.squads.ie2);
 assert.deepStrictEqual(state.gachaAcquiredCards,old.gachaAcquiredCards);assert.deepStrictEqual(state.developmentByCardId,old.developmentByCardId);
 assert.strictEqual(applied.seasonDb,db);assert.strictEqual(applied.transitionRewarded,true);
 await rt.enterNextSeason();assert.strictEqual(state.tokens,1410);assert.strictEqual(commits,1);
 console.log("RTG Ares->Orion: +1000 once and owned S1/S2/S3/AR cards preserved OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
