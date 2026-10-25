"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const test=require("node:test");
const read=p=>fs.readFileSync(p,"utf8");
const sandbox={console,Math,JSON,Object,Array,Set,Map,String,Number};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
for(const path of [
  "js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-encounter-runtime.js",
  "js/road-to-glory/rtg-ai-policy.js",
  "js/road-to-glory/rtg-penalty-runtime.js",
])vm.runInContext(read(path),sandbox,{filename:path});
const types=["shot","shot","shot","shot"];
sandbox.RtgFourMovesRuntime={
  isReady:()=>true,error:()=>null,
  ptBreakdown:(stats,rarity)=>{
    const base=120+Math.max(0,Math.round(Number(stats?.stamina||0)*0.5));
    const bonus=rarity==="Mondiale"?12:rarity==="Elite"?10:0;
    return {base,bonus,total:base+bonus};
  },
  movesFor:()=>types.map((type,index)=>({
    type,name:"Test technique "+index,power:[85,55,75,101][index],
    ptCost:[85,55,75,101][index],element:["fire","forest","wind","mountain"][index],
  })),
};
sandbox.RoadToGloryCoaches={owned:s=>new Set(s.coachOwnedIds||[])};
for(const path of [
  "js/road-to-glory/rtg-coach-powers-runtime.js",
  "js/road-to-glory/rtg-match-pt-runtime.js",
  "js/road-to-glory/rtg-match-engine.js",
])vm.runInContext(read(path),sandbox,{filename:path});
const powers=sandbox.RoadToGloryCoachPowerRuntime;
const E=sandbox.RoadToGloryMatchEngine;
const PT=sandbox.RoadToGloryMatchPtRuntime;
const encounter=sandbox.RoadToGloryEncounterRuntime;
const mkPlayer=(id,role,el="fire")=>({
  playerId:id,cardId:id,name:id,normalizedRole:role,position:role,
  category:"Elite",overall:87,element:el,legacySeasonId:"ie1",
  stats:{stamina:60,grit:85,control:85,physical:85,attack:85,defense:85,save:85,speed:85},
  baseStats:{stamina:60,grit:85,control:85,physical:85},
  attack:85,control:85,grit:85,physical:85,defense:85,save:85,speed:85,stamina:60,
  move:{name:"Fallback",type:"shot",power:75,element:el},
});
const makeSquad=(prefix)=>{
  const roles=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"];
  return {
    formationId:"4-3-3",seasonId:"ie1",
    lineup:roles.map((role,i)=>mkPlayer(prefix+i,role,i%2?"forest":"fire")),
    bench:["GK","DF","MF","FW"].map((role,i)=>mkPlayer(prefix+"b"+i,role,"mountain")),
  };
};
const create=()=>{
 const state=E.createMatch({matchId:"integration",nodeId:"main:test",
   matchType:"main",attemptNumber:1,seed:"coach-integration",
   seasonId:"ie1",userSquad:makeSquad("u"),opponentSquad:makeSquad("o")});
 assert.equal(state.ptModeVersion,1);
 return state;
};
const withPower=(match,coachId,selection,options={})=>powers.applyToMatch(match,{
 coachId,coachPowerSelection:{coachId,...selection},
},{coachOwnedIds:[coachId]},options);
test("Hillman starts the real match with +50 PT; saves retain modified balances exactly once",()=>{
 const match=create();
 const chosen=[match.userSquad.lineup[8].cardId,match.userSquad.lineup[9].cardId];
 const result=withPower(match,"208",{cardIds:chosen});
 for(const key of chosen){
  assert.equal(result.ptMaxByPlayerId["user:"+key],match.ptMaxByPlayerId["user:"+key]+50);
  assert.equal(result.ptCurrentByPlayerId["user:"+key],match.ptCurrentByPlayerId["user:"+key]+50);
 }
 assert.equal(match.ptCurrentByPlayerId["user:"+chosen[0]],160);
 const recovered=JSON.parse(JSON.stringify(result));
 assert.equal(powers.applyToMatch(recovered,{coachId:"208",coachPowerSelection:{coachId:"208",cardIds:chosen}},{coachOwnedIds:["208"]}),recovered);
 assert.equal(match.userSquad.lineup[8].overall,87);
});
test("Aquilina's real duels consume half-cost PT for every move of the target, never allies",()=>{
 const match=create(),key=match.userSquad.lineup[8].cardId;
 const powered=withPower(match,"1329",{cardIds:[key],moveIndices:[0,3]});
 assert.deepEqual(Array.from(PT.compatible(powered,"user",key,"shot").map(m=>m.ptCost)),[43,28,38,51]);
 assert.equal(PT.compatible(powered,"user",match.userSquad.lineup[9].cardId,"shot")[0].ptCost,85);
 // Force the selected player into the duel: the test must never skip consumption.
 powered.userSquad.lineup=powered.userSquad.lineup.filter(p=>p.cardId===key);
 powered.fieldZone="shot";powered.possession="user";powered.manualIndexes=[0];
 const prepared=E.prepareNext(powered);
 assert(prepared.pendingEncounter);
 assert.equal(prepared.pendingEncounter.userPlayerId,key);
 const idx=prepared.pendingEncounter.userMoveOptions.findIndex(m=>m.name==="Test technique 0");
 assert(idx>=0);
 const before=PT.pt(prepared,"user",key).remaining;
 const resolved=E.resolvePendingEncounter(prepared,"move:"+idx);
 assert.equal(PT.pt(resolved,"user",key).remaining,before-43);
});
test("Mister Yi changes every move for both targeted players without changing PT and power",()=>{
 const match=create(),a=match.userSquad.lineup[8],b=match.userSquad.lineup[9];
 const powered=withPower(match,"4401",{
   cardIds:[a.cardId,b.cardId],targets:[
     {cardId:a.cardId,element:"wind",moveIndices:[0,2]},
     {cardId:b.cardId,element:"mountain",moveIndices:[1,3]},
   ],
 });
 assert.equal(powered.coachPowerEffect.targets.length,2);
 assert.equal(powered.userSquad.lineup[8].element,"wind");
 assert.equal(powered.userSquad.lineup[9].element,"mountain");
 const aa=PT.compatible(powered,"user",a.cardId,"shot");
 const bb=PT.compatible(powered,"user",b.cardId,"shot");
 assert.equal(aa[0].element,"wind");
 assert.equal(aa[1].element,"wind");
 assert.equal(aa[2].element,"wind");
 assert.equal(aa[3].element,"wind");
 assert.equal(bb[1].element,"mountain");
 assert.equal(bb[3].element,"mountain");
 assert.equal(bb[0].element,"mountain");
 assert.equal(bb[2].element,"mountain");
 assert.deepEqual(Array.from(aa.map(m=>m.power)),[85,55,75,101]);
 assert.deepEqual(Array.from(aa.map(m=>m.ptCost)),[85,55,75,101]);
 const opponent={...match.opponentSquad.lineup[0],element:"mountain"};
 const old=encounter.probability({actor:a,opponent,actorKind:"shot",opponentKind:"save"}).probability;
 const now=encounter.probability({actor:powered.userSquad.lineup[8],opponent,actorKind:"shot",opponentKind:"save"}).probability;
 assert.equal(now-old,10,"player element changes actual duel probability");
 const oldMove=encounter.probability({actor:a,opponent,actorKind:"shot",opponentKind:"save",
   actorMove:{...aa[0],element:"fire"},opponentMove:{type:"save",power:85,element:"mountain"}}).probability;
 const newMove=encounter.probability({actor:a,opponent,actorKind:"shot",opponentKind:"save",
   actorMove:aa[0],opponentMove:{type:"save",power:85,element:"mountain"}}).probability;
 assert.equal(newMove-oldMove,10,"converted technique element changes duel probability");
 assert.equal(powered.ptCurrentByPlayerId["user:"+a.cardId],match.ptCurrentByPlayerId["user:"+a.cardId]);
 const recovered=JSON.parse(JSON.stringify(powered));
 assert.equal(powers.moveElement(recovered,"user",a.cardId,2,"forest"),"wind");
});
test("Travis chosen reserve is counted as 60 for entrance and throughout halftime substitutions",()=>{
 const squad=makeSquad("u"),key=squad.bench[3].cardId;
 const configuration={coachId:"1777",lineup:squad.lineup.map(p=>p.cardId),
  bench:squad.bench.map(p=>p.cardId),
  coachPowerSelection:{coachId:"1777",cardIds:[key]}};
 const before={activeSeasonId:"ie1",coachOwnedIds:["1777"]};
 assert.equal(powers.capOverrideFor(configuration,before),key);
 const live=withPower(create(),"1777",{cardIds:[key]});
 const after={...before,activeMatch:live};
 const swapped={...configuration,lineup:[...configuration.lineup.slice(0,10),key],
   bench:[...configuration.bench.slice(0,3),configuration.lineup[10]]};
 assert.equal(powers.capOverrideFor(swapped,after),key);
 assert.equal(powers.capOverrideFor(swapped,before),null);
 assert.equal(powers.capOverrideFor({...swapped,coachId:"208"},after),null);
 const controller=read("js/road-to-glory/rtg-controller.js");
 assert.match(controller,/candidateState\.squads\?\.\[activeSeasonId\(\)\]/,
   "halftime candidate preserves original squad coach and config");
});
test("David real progression upgrades a player from Elite to Mondiale, stats and match PT",()=>{
 const context={console,Math,JSON,Object,Array,Set,Map,String,Number,
  RoadToGloryCoachPowerRuntime:powers};
 context.globalThis=context;vm.createContext(context);
 vm.runInContext(read("js/roguelike_progression.js"),context);
 vm.runInContext(read("js/road-to-glory/rtg-coach-powers-rarity.js"),context);
 const ratings={attack:8,control:8,speed:8,grit:8,physical:8,stamina:8,defense:8,save:8};
 const base={playerId:"u8",position:"FW",normalizedRole:"FW",category:"Elite",
  finalOverall:88,ratings,maxLevel:20};
 const actual=context.InazumaProgression.getPlayerAtLevel(base,20,{players:[base]});
 assert.equal(actual.overall,88);
 const resolver={
  resolveVersion:()=>({player:base}),
  resolveBaseAtLevel20:(_card,_season,_variant,_database,options)=>
    context.InazumaProgression.getPlayerAtLevel(base,20,{players:[base]},options),
 };
 const upgraded=context.RoadToGloryCoachRarityPower.upgrade({player:actual,
  targetRarity:"Mondiale",cardId:"u8",playerResolver:resolver,seasonId:"ie1"});
 assert(upgraded,"real progression oracle should return next rarity");
 assert.equal(upgraded.category,"Mondiale");
 assert.equal(upgraded.overall,90);
 assert(Object.keys(ratings).some(k=>upgraded.stats[k]>actual.stats[k]),"real stats must grow");
 const match=create(),who=match.userSquad.lineup[8];
 match.userSquad.lineup[8]={...who,...actual,cardId:who.cardId,playerId:who.playerId,category:"Elite"};
 const boosted=withPower(match,"1974",{cardIds:[who.cardId]},{
   upgradeRarity:(p,rarity)=>context.RoadToGloryCoachRarityPower.upgrade({
     player:p,targetRarity:rarity,cardId:p.cardId,playerResolver:resolver,seasonId:"ie1"}),
 });
 assert.equal(boosted.userSquad.lineup[8].category,"Mondiale");
 assert.equal(boosted.userSquad.lineup[8].overall,90);
 assert(boosted.ptMaxByPlayerId["user:"+who.cardId]>match.ptMaxByPlayerId["user:"+who.cardId],
  "the real rarity bonus updates match PT");
 assert.equal(match.userSquad.lineup[8].overall,88,"canonical match draft is unchanged");
});


test("Nerina borrowed substitute survives the actual match halftime/resume engine",()=>{
  vm.runInContext(read("js/road-to-glory/rtg-coach-powers-prematch.js"),sandbox);
  const power=sandbox.RoadToGloryCoachPreMatchRuntime;
  const original=create(),loan=original.opponentSquad.bench[1].cardId;
  const displaced=original.userSquad.bench[1].cardId;
  original.preMatchCoachId="1225";
  original.presentation={preMatchSeen:false,preMatchPowerStatus:"pending"};
  const live=power.apply(original,"1225",{playerIds:[loan,displaced]});
  assert.equal(live.userSquad.bench[1].cardId,loan);
  assert.equal(live.userSquad.bench.length,4);
  assert.equal(live.userRosterIds.length,15);
  assert.equal(new Set(live.userRosterIds).size,15);
  assert.equal(live.ptCurrentByPlayerId["user:"+loan],original.ptCurrentByPlayerId["opponent:"+loan]);
  assert.equal(live.ptCurrentByPlayerId["user:"+displaced],undefined);
  live.status="halftime";live.period="halftime";live.pendingEncounter=null;
  live.actionIndex=live.firstHalfTarget;
  const next=JSON.parse(JSON.stringify(live.userSquad));
  // The borrowed player can even enter the XI, but the roster remains the same 15.
  const outgoing=next.lineup[6],incoming=next.bench[1],role=next.lineup[6].tacticalRole||next.lineup[6].position;
  next.lineup[6]={...incoming,tacticalRole:role};next.bench[1]={...outgoing};
  delete next.bench[1].tacticalRole;
  const resumed=E.confirmHalftime(live,next,{validateHalftime:()=>{
    const controller=read("js/road-to-glory/rtg-controller.js");
    assert.match(controller,/match\.preMatchCoachEffect\?\.coachId==="1225"/);
    return{eligible:true,reasons:[]};
  }});
  assert.notEqual(resumed.status,"halftime");
  assert.equal(resumed.userSquad.lineup[6].cardId,loan);
  assert.equal(resumed.userRosterIds.includes(loan),true);
  assert.equal(resumed.ptCurrentByPlayerId["user:"+loan],live.ptCurrentByPlayerId["user:"+loan]);
});
test("All coach UIs retain their scroll on incremental selection",()=>{
  const squad=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  const prematch=read("js/road-to-glory/rtg-coach-powers-prematch-ui.js");
  for(const ui of [squad,prematch])assert.match(ui,/active\.outerHTML=/);
  // All-move coaches now select their target directly inside the mounted modal,
  // so re-rendering preserves the scroll without opening an extra detail picker.
  assert.match(squad,/if\(active\)active\.outerHTML=main/);
  assert.match(prematch,/if\(active\)active\.outerHTML=markup/);
  assert.doesNotMatch(squad,/coachMovePicker/);
  const control=read("js/road-to-glory/rtg-controller.js");
  assert.match(control,/querySelector\("\.rtg-halftime"\)\?\.scrollTop/);
  assert.match(control,/panel\.scrollTop=top/);
  assert.match(control,/Promise\.resolve\(confirmHalftime/);
  const draft=read("js/road-to-glory/rtg-squad-controller.js");
  assert.match(draft,/preserveScroll:!!oldScroll/);
  assert.match(draft,/forcedBench=fixedBenchId/);
  assert.match(draft,/outgoing\.playerId===fixedBenchId/);
  const squadView=read("js/road-to-glory/rtg-squad-view-base.js");
  assert(squadView.includes('</details></div><button type="button" class="btn rtg-adapt-button'),
    "Adapt action remains visible outside its collapsible requirements section");
  assert.match(draft,/\.\.\.\(state\.squads\?\.\[deps\.activeSeasonId\(\)\]\|\|\{\}\)/);
});
