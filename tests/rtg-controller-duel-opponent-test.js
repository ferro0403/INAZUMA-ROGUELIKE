"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),c);
const p=(id,role)=>({playerId:id,name:id,normalizedRole:role,position:role,overall:80});
const userLineup=[p("ug","GK"),p("u1","DF"),p("u2","DF"),p("u3","DF"),p("u4","DF"),p("um1","MF"),p("um2","MF"),p("um3","MF"),p("uf1","FW"),p("uf2","FW"),p("uf3","FW")];
const userBench=[p("ubg","GK"),p("ubd","DF"),p("ubm","MF"),p("ubf","FW")];
const oppLineup=[p("og","GK"),p("o1","DF"),p("o2","DF"),p("o3","DF"),p("o4","DF"),p("om1","MF"),p("om2","MF"),p("om3","MF"),p("of1","FW"),p("of2","FW"),p("of3","FW")];
const state={activeSeasonId:"ie1",squads:{ie1:{formationId:"4-3-3",lineup:userLineup.map(x=>x.playerId),bench:userBench.map(x=>x.playerId),activeRoleVariantByPlayerId:{}}},gachaAcquiredPlayerIds:[],activeMatch:{
 matchId:"m1",status:"active",period:"first_half",score:{user:0,opponent:0},possession:"opponent",fieldZone:"attack",actionIndex:1,actionTarget:20,
 userSquad:{formationId:"4-3-3",lineup:userLineup,bench:userBench},opponentSquad:{formationId:"4-3-3",lineup:oppLineup,bench:[],name:"Occult"},
 moveUsesByPlayerId:{},
 pendingEncounter:{actorSide:"opponent",opponentSide:"user",actorPlayerId:"of1",opponentPlayerId:"u1",userSide:"user",userPlayerId:"u1",userKind:"defense",userBaseActionLabel:"Difesa",aiSide:"opponent",aiPlayerId:"of1",aiKind:"dribble",aiChoice:"base",normalPreviewProbability:60}
}};
let captured=null;
const overlay={innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]};
const app={innerHTML:"",querySelector:s=>s==="[data-rtg-match-overlay]"?overlay:null,querySelectorAll:()=>[]};
const controller=c.RoadToGloryController.create({
 app,
 repository:{ensureCampaign:async()=>JSON.parse(JSON.stringify(state)),read:async()=>JSON.parse(JSON.stringify(state)),update:async(_l,fn)=>fn(JSON.parse(JSON.stringify(state)))},
 runView:{lockedMarkup:()=>"",runMarkup:()=>""},
 squadView:{renderModel:()=>({}),markup:()=>"",bind:()=>{},formationOptionsMarkup:()=>"",replacementPickerMarkup:()=>"",replacementPickerResultsMarkup:()=>""},
 matchView:{matchMarkup:()=>"<match>",encounterMarkup:(_m,preview)=>{captured=preview;return"<duel>";},bind:()=>{},halftimeMarkup:()=>"",penaltyMarkup:()=>"",resultMarkup:()=>""},
 ensureSeason1Db:async()=>({formations:{eleven:[{id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}}]},players:[],teams:[],bossOrder:[]}),
 getFreeAgentsDb:()=>({players:[...userLineup,...userBench]}),
 getAlbumProgress:()=>({}),
 entitlements:{accessStatus:()=>({unlocked:true,count:15}),unlockedFreeAgentIds:()=>userLineup.concat(userBench).map(x=>x.playerId)},
 squadRuntime:{accessiblePlayerIds:({freeAgentIds})=>freeAgentIds,validateSquad:()=>({valid:true,reasons:[]})},
 playerResolver:{resolveAtLevel20:()=>null,resolveMove:()=>null},
 config:{buildSeasonNodes:()=>[]},progression:{},gacha:{},matchEngine:{},opponentGenerator:{},rng:{},aiPolicy:{},penaltyRuntime:{},
 closeModal:()=>{},resetRenderedViewScroll:()=>{},renderHome:()=>{},openModal:()=>{},toast:()=>{},getModalRoot:()=>null
});
(async()=>{await controller.open();assert(captured);assert.strictEqual(captured.userPlayer.playerId,"u1");assert.strictEqual(captured.opponentPlayer.playerId,"of1");console.log("rtg-controller-duel-opponent-test: PASS");})().catch(e=>{console.error(e);process.exitCode=1;});
