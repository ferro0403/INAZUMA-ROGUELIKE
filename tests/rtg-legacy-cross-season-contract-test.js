"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const databases={
  ie1:{seasonId:"ie1",players:[{playerId:"mark",name:"Mark S1",position:"GK",normalizedRole:"GK",overall:94,finalOverall:94,category:"Elite",teamId:"raimon",teamIds:["raimon"]}],teams:[{teamId:"raimon",playerIds:["mark"]}],bossOrder:[]},
  ie1_s2:{seasonId:"ie1_s2",requiresProfileAwareRuntime:true,players:[{playerId:"mark",name:"Mark S2",position:"GK",normalizedRole:"GK",overall:95,finalOverall:95,category:"Mondiale",teamId:"raimon_go",teamIds:["raimon_go"]}],teams:[{teamId:"raimon_go",playerIds:["mark"]}],bossOrder:[]},
};
const context={
  globalThis:null,Object,Array,String,Number,JSON,Math,Set,Map,Error,
  RoadToGloryConfig:{SEASON1:{pullCost:300,rarityWeights:{Elite:100,Mondiale:100},formations:[{id:"test",requirements:{GK:2,DF:0,MF:0,FW:0}}],constraints:{},mainTeams:[]}},
  RoadToGloryRng:{float:()=>0,weightedPick:(items)=>items[0],int:()=>0},
  SeasonRegistry:{
    normalizeSeasonId:v=>String(v),
    database:s=>databases[s]||null,
    player:(pid,sid)=>(databases[sid]?.players||[]).find(p=>String(p.playerId)===String(pid))||null,
  },
  ProfiledSeasonRuntime:{
    canonicalPlayerId:(_sid,pid)=>String(pid),
    resolveEffectivePlayerAtLevel:(entry,ctx)=>{const p=ctx.database.players.find(x=>x.playerId===entry.playerId);return p?{...p,level:20}:null;},
  },
  DevelopmentAccountV3:{read:()=>({players:{}})},
  DevelopmentRuntime:{},
  InazumaProgression:{getPlayerAtLevel:(player,level)=>({...player,level})},
  MatchMoveRuntime:{moveForPlayer:()=>null},
};
context.globalThis=context;vm.createContext(context);
for(const file of[
  "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-player-resolver.js",
  "js/road-to-glory/rtg-gacha.js",
  "js/road-to-glory/rtg-squad-runtime.js",
  "js/road-to-glory/rtg-match-engine.js",
  "js/road-to-glory/rtg-squad-view-base.js",
]) vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});

const C=context.RoadToGloryCardIdentity;
const G=context.RoadToGloryGacha;
const R=context.RoadToGloryPlayerResolver;
const S=context.RoadToGlorySquadRuntime;
const M=context.RoadToGloryMatchEngine;

let state={campaignSeed:"legacy-contract",activeSeasonId:"ie1",tokens:300,defeatedTeamIds:["raimon"],gachaAcquiredCards:[],gacha:{pullCount:0},squads:{ie1:{formationId:"test",lineup:[],bench:[],activeRoleVariantByCardId:{}}}};
const s1=G.pull(state,{seasonDb:databases.ie1,accessibleCardIds:[]});
assert.strictEqual(s1.result.cardId,"ie1::mark");
assert.strictEqual(R.resolveAtLevel20(s1.result.cardId,"ie1_s2",null,{players:[]}).overall,94);

state={...s1.state,activeSeasonId:"ie1_s2",tokens:300,defeatedTeamIds:["raimon_go"]};
const s2=G.pull(state,{seasonDb:databases.ie1_s2,accessibleCardIds:[s1.result.cardId]});
assert.strictEqual(s2.result.cardId,"ie1_s2::mark");
assert.notStrictEqual(s2.result.cardId,s1.result.cardId);
assert.strictEqual(R.resolveAtLevel20(s2.result.cardId,"ie1_s2",null,{players:[]}).overall,95);
assert.strictEqual(s2.state.gachaAcquiredCards.length,2);
assert.throws(()=>G.pull({...s2.state,tokens:300},{seasonDb:databases.ie1_s2,accessibleCardIds:[s1.result.cardId,s2.result.cardId]}),e=>e.code==="rtg-gacha-empty-pool");

const userSquad={formationId:"test",lineup:[
  R.resolveAtLevel20(s1.result.cardId,"ie1_s2",null,{players:[]}),
  R.resolveAtLevel20(s2.result.cardId,"ie1_s2",null,{players:[]}),
],bench:[]};
const match=M.createMatch({matchId:"legacy:match",userSquad,opponentSquad:{lineup:[],bench:[]}});
assert.deepStrictEqual(Array.from(match.userRosterIds),["ie1::mark","ie1_s2::mark"]);
assert.strictEqual(new Set(match.userRosterIds).size,2);

const view=context.RoadToGlorySquadView.create({escapeHtml:v=>String(v),playerResolver:R});
const cardS1=view.playerCard({cardId:s1.result.cardId,playerId:"mark",source:"RTG",player:userSquad.lineup[0]},"catalog");
const cardS2=view.playerCard({cardId:s2.result.cardId,playerId:"mark",source:"RTG",player:userSquad.lineup[1]},"catalog");
assert.match(cardS1,/rtg-legacy-badge/);assert.match(cardS1,/rtg-legacy-tab/);assert.match(cardS1,/>S1<\/span>/);
assert.match(cardS2,/rtg-legacy-badge/);assert.match(cardS2,/rtg-legacy-tab/);assert.match(cardS2,/>S2<\/span>/);
const freeCardId=C.cardIdForFreeAgent("mark");
const freeCard=view.playerCard({cardId:freeCardId,playerId:"mark",source:"Svincolato",player:{...userSquad.lineup[0],cardId:freeCardId,legacySeasonId:C.FREE_AGENTS}},"catalog");
assert.doesNotMatch(freeCard,/rtg-legacy-badge/);

console.log("rtg-legacy-cross-season-contract-test: PASS");
