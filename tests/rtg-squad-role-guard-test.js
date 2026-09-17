"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),c);
const roles={g1:"GK",g2:"GK",d1:"DF",d2:"DF",d3:"DF",d4:"DF",d5:"DF",m1:"MF",m2:"MF",m3:"MF",m4:"MF",f1:"FW",f2:"FW",f3:"FW",f4:"FW",f5:"FW"};
const players=Object.entries(roles).map(([playerId,position])=>({playerId,name:playerId,position,normalizedRole:position,overall:80,finalOverall:80}));
const lineup=["g1","d1","d2","d3","d4","m1","m2","m3","f1","f2","f3"],bench=["g2","d5","m4","f4"];
let current={activeSeasonId:"ie1",squads:{ie1:{formationId:"4-3-3",lineup:[...lineup],bench:[...bench],activeRoleVariantByPlayerId:{}}},gachaAcquiredPlayerIds:["f5"]};
const app={innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]};
const ctrl=c.RoadToGloryController.create({
 app,
 repository:{ensureCampaign:async()=>JSON.parse(JSON.stringify(current)),read:async()=>JSON.parse(JSON.stringify(current)),update:async(_l,fn)=>{current=fn(JSON.parse(JSON.stringify(current)));return JSON.parse(JSON.stringify(current));}},
 runView:{runMarkup:()=>"",lockedMarkup:()=>""},
 squadView:{renderModel:()=>({}),markup:()=>"",bind:()=>{},formationOptionsMarkup:()=>""},
 matchView:{},
 ensureSeason1Db:async()=>({formations:{eleven:[{id:"4-3-3",name:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]}]},players,teams:[],bossOrder:[]}),
 getFreeAgentsDb:()=>({players}),
 getAlbumProgress:()=>({read:()=>({sharedUnlockedPlayerIds:Object.fromEntries(Object.keys(roles).map(id=>[id,{}]))})}),
 entitlements:{accessStatus:()=>({unlocked:true,count:16,formationIds:["4-3-3"]}),unlockedFreeAgentIds:()=>Object.keys(roles)},
 squadRuntime:{accessiblePlayerIds:({freeAgentIds,state})=>[...new Set([...freeAgentIds,...(state.gachaAcquiredPlayerIds||[])])],validateSquad:()=>({valid:true,reasons:[]})},
 playerResolver:{resolveAtLevel20:id=>players.find(p=>p.playerId===String(id))||null,resolveMove:()=>null},
 config:{buildSeasonNodes:()=>[],SEASON1:{}},progression:{},gacha:{},matchEngine:{},opponentGenerator:{},rng:{},aiPolicy:{},penaltyRuntime:{},
 resetRenderedViewScroll:()=>{},renderHome:()=>{},toast:()=>{},openModal:()=>{},closeModal:()=>{},getModalRoot:()=>null,
});
(async()=>{
 await ctrl.open();
 ctrl.renderSquad();
 let result=ctrl.swapSquadDraft("d1","g2");
 assert.strictEqual(result.ok,false);
 assert.strictEqual(result.reason,"role-mismatch");
 let state=ctrl.getDraftSquad();
 assert(state.lineup.includes("d1"));assert(state.bench.includes("g2"));
 result=ctrl.swapSquadDraft("d1","d5");
 assert.strictEqual(result.ok,true);
 state=ctrl.getDraftSquad();
 assert(state.lineup.includes("d5"));assert(state.bench.includes("d1"));
 result=ctrl.swapSquadDraft("f1","f5");
 assert.strictEqual(result.ok,true);
 state=ctrl.getDraftSquad();
 assert(state.lineup.includes("f5"));assert(!state.lineup.includes("f1"));assert(!state.bench.includes("f5"));
 const beforeIds=new Set([...state.lineup,...state.bench]);
 assert.strictEqual(ctrl.canUseDraftFormation({requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]}),true);
 const arranged=ctrl.arrangeDraftForFormation({id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]});
 assert.strictEqual(arranged.ok,true);
 const after=ctrl.getDraftSquad();assert.deepStrictEqual(new Set([...after.lineup,...after.bench]),beforeIds);
 console.log("rtg-squad-role-guard-test: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
