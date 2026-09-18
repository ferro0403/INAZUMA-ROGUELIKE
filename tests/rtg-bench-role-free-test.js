"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};
c.globalThis=c;
vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),c);

const formation={id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]};
const specs=[
  ["g1","GK"],["d1","DF"],["d2","DF"],["d3","DF"],["d4","DF"],
  ["m1","MF"],["m2","MF"],["m3","MF"],["f1","FW"],["f2","FW"],["f3","FW"],
  ["bd","DF"],["bm","MF"],["bf","FW"],["bg","GK"],
  ["xf","FW"],["xd","DF"],["xm","MF"],["xg","GK"],
];
const players=specs.map(([playerId,role],index)=>({
  playerId,name:playerId,normalizedRole:role,position:role,overall:70+(index%6),finalOverall:70+(index%6),
}));
const byId=new Map(players.map(player=>[player.playerId,player]));
const freeDb={players};
const seasonDb={formations:{eleven:[formation]},players:[],teams:[],bossOrder:[]};
const allIds=players.map(player=>player.playerId);

let current={
  activeSeasonId:"ie1",
  currentNodeId:"main:occult",
  gachaAcquiredPlayerIds:[],
  squads:{ie1:{
    formationId:"4-3-3",
    lineup:["g1","d1","d2","d3","d4","m1","m2","m3","f1","f2","f3"],
    bench:["bd","bm","bf","bg"],
    activeRoleVariantByPlayerId:{},
  }},
  attemptsByNode:{},
  defeatedTeamIds:[],
  activeMatch:null,
};
const clone=value=>JSON.parse(JSON.stringify(value));
const repository={
  ensureCampaign:async()=>clone(current),
  update:async(_label,mutate)=>{current=mutate(clone(current));return clone(current);},
};
let pickerArgs=null;
const squadView={
  renderModel:()=>({formations:[formation],formation,lineup:[],bench:[]}),
  markup:()=>"<squad></squad>",
  bind:()=>{},
  replacementPickerMarkup:args=>{pickerArgs=args;return "<picker></picker>";},
  replacementPickerResultsMarkup:()=>"<results></results>",
};
const runtime={
  accessiblePlayerIds:()=>allIds,
  mainEligibility:()=>({eligible:true,reasons:[],teamPower:75,cap:75,recruitCount:0,minRecruit:0,recentRecruitCount:0,recentCount:0}),
  validateSquad:()=>({valid:true,reasons:[]}),
};
const resolver={
  resolveAtLevel20:playerId=>{
    const player=byId.get(String(playerId));
    return player?{...player,level:20}:null;
  },
  resolveMove:()=>null,
  rarity:()=>"Normale",
};
const controller=c.RoadToGloryController.create({
  app:{innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]},
  repository,
  runView:{lockedMarkup:()=>"",runMarkup:()=>"",requirementsMarkup:()=>""},
  squadView,
  matchView:{bind:()=>{}},
  ensureSeason1Db:async()=>seasonDb,
  getFreeAgentsDb:()=>freeDb,
  getAlbumProgress:()=>({}),
  entitlements:{accessStatus:()=>({unlocked:true,count:allIds.length,formationIds:["4-3-3"]}),unlockedFreeAgentIds:()=>allIds},
  config:{SEASON1:{formations:[formation],constraints:{occult:{cap:75,minRecruit:0,recentWindow:0,recentCount:0}}},buildSeasonNodes:()=>[{id:"main:occult",type:"main",teamId:"occult"}]},
  squadRuntime:runtime,
  playerResolver:resolver,
  openModal:()=>{},
  closeModal:()=>{},
  toast:()=>{},
  resetRenderedViewScroll:()=>{},
});

(async()=>{
  await controller.open({destination:"squad"});

  controller.openSquadPlayerPicker("bd");
  assert.strictEqual(pickerArgs.allowAnyRole,true);
  assert.strictEqual(pickerArgs.role,"");
  const pickerIds=pickerArgs.entries.map(entry=>entry.playerId);
  assert(pickerIds.includes("xf"),"bench picker must offer an outside FW for a DF bench slot");
  assert(pickerIds.includes("xd"),"bench picker must offer an outside DF too");
  assert(!pickerIds.includes("d1"),"bench picker must not steal a current starter");

  const benchSwap=controller.swapSquadDraft("bd","xf",{render:false});
  assert.strictEqual(benchSwap.ok,true);
  assert(controller.getDraftSquad().bench.includes("xf"),"bench DF must be replaceable with FW");

  const illegalLineupSwap=controller.swapSquadDraft("d1","xf",{render:false});
  assert.strictEqual(illegalLineupSwap.ok,false);
  assert.strictEqual(illegalLineupSwap.reason,"role-mismatch");
  assert(controller.getDraftSquad().lineup.includes("d1"),"starter role constraint must remain intact");

  console.log("rtg-bench-role-free-test: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
