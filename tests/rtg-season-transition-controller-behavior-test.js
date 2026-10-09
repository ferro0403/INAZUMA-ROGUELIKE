"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};context.globalThis=context;
context.SeasonRegistry={loadDatabase:async seasonId=>({seasonId,players:[],profiles:[]})};vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-season-transition-controller.js","utf8"),context);
const configs={ie1:{nextSeasonId:"ie1_s2"},ie1_s2:{nextSeasonId:"ie1_s3"},ie1_s3:{nextSeasonId:null}};
const config={SEASON_TRANSITION_REWARD:1000,season:id=>configs[id],buildSeasonNodes:id=>[{id:`${id}:first`}]};
async function transition(initial){
 let state=JSON.parse(JSON.stringify(initial)),applied=null,renders=0;
 const runtime=context.RoadToGlorySeasonTransitionController.create({
  getCampaign:()=>state,activeSeasonId:()=>state.activeSeasonId,config,id:String,clone:value=>JSON.parse(JSON.stringify(value)),
  repository:{update:async(_label,mutator)=>{state=mutator(JSON.parse(JSON.stringify(state)));return state;}},
  applyTransition:value=>{applied=value;state=value.campaign;},renderRun:()=>{renders++;return state;},
 });
 await runtime.enterNextSeason();return {state,applied,renders,runtime};
}
(async()=>{
 const squad={formationId:"4-3-3",lineup:["a"],bench:["b"],activeRoleVariantByCardId:{a:"fw"}};
 const base={activeSeasonId:"ie1",seasonComplete:true,tokens:275,gachaAcquiredCards:[{cardId:"ie1::p1"}],developmentByCardId:{"ie1::p1":{currentRarity:"Forte"}},squads:{ie1:squad},seasonTransitionRewardedIds:[],lives:1,checkpointMainIndex:8,currentNodeId:"old",furthestNodeIndex:9,defeatedTeamIds:["zeus"],firstClearMatchIds:["m"],attemptsByNode:{old:{clears:1}},activeMatch:{matchId:"m"}};
 const s2=await transition(base);assert.strictEqual(s2.state.activeSeasonId,"ie1_s2");assert.strictEqual(s2.state.tokens,1275);assert.deepStrictEqual(s2.state.gachaAcquiredCards,base.gachaAcquiredCards);assert.deepStrictEqual(s2.state.developmentByCardId,base.developmentByCardId);assert.deepStrictEqual(s2.state.squads.ie1_s2,squad);assert.strictEqual(s2.state.currentNodeId,"ie1_s2:first");assert.strictEqual(s2.state.activeMatch,null);
 s2.state.seasonComplete=true;const s3=await transition(s2.state);assert.strictEqual(s3.state.activeSeasonId,"ie1_s3");assert.strictEqual(s3.state.tokens,2275);assert.deepStrictEqual(s3.state.squads.ie1_s3,squad);
 s3.state.activeSeasonId="ie1_s2";s3.state.seasonComplete=true;s3.state.tokens=2275;const repeated=await transition(s3.state);assert.strictEqual(repeated.state.tokens,2275,"transition reward stays idempotent");
 console.log("rtg-season-transition-controller-behavior-test: S1->S2, S2->S3, preservation and idempotence PASS");
})().catch(error=>{throw error;});
