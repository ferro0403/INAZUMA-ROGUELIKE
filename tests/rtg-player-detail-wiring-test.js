"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),c);

const players=[
  {playerId:"g1",name:"G1",normalizedRole:"GK",position:"GK",finalOverall:70},
  ...Array.from({length:4},(_,i)=>({playerId:"d"+(i+1),name:"D"+(i+1),normalizedRole:"DF",position:"DF",finalOverall:70})),
  ...Array.from({length:3},(_,i)=>({playerId:"m"+(i+1),name:"M"+(i+1),normalizedRole:"MF",position:"MF",finalOverall:70})),
  ...Array.from({length:7},(_,i)=>({playerId:"f"+(i+1),name:"F"+(i+1),normalizedRole:"FW",position:"FW",finalOverall:70})),
];
const freeDb={players};
const formation={id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]};
const seasonDb={formations:{eleven:[formation]},players:[],teams:[],bossOrder:[]};
let state={activeSeasonId:"ie1",gachaAcquiredPlayerIds:[],squads:{ie1:{formationId:null,lineup:[],bench:[],activeRoleVariantByPlayerId:{}}},tokens:0,activeMatch:null};
const repository={
  ensureCampaign:async()=>JSON.parse(JSON.stringify(state)),
  update:async(_label,fn)=>{state=fn(JSON.parse(JSON.stringify(state)));return JSON.parse(JSON.stringify(state));},
};
const app={innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]};
const detailCalls=[];
const controller=c.RoadToGloryController.create({
  app,repository,
  runView:{runMarkup:()=>"<run>",lockedMarkup:()=>"<locked>"},
  squadView:{renderModel:()=>({}),markup:()=>"<squad>",bind:()=>{}},
  matchView:{bind:()=>{}},
  ensureSeason1Db:async()=>seasonDb,
  getFreeAgentsDb:()=>freeDb,
  getAlbumProgress:()=>({}),
  entitlements:{accessStatus:()=>({unlocked:true}),unlockedFreeAgentIds:()=>players.map(p=>p.playerId)},
  config:{SEASON1:{},buildSeasonNodes:()=>[]},
  squadRuntime:{accessiblePlayerIds:({freeAgentIds,state})=>[...new Set([...freeAgentIds,...state.gachaAcquiredPlayerIds])]},
  playerResolver:{
    resolveAtLevel20:(playerId)=>{const p=players.find(x=>x.playerId===String(playerId));return p?{...p,overall:p.finalOverall,level:20}:null;},
    resolveMove:()=>null,
  },
  showPlayerDetailsFor:(player,options)=>detailCalls.push({player,options}),
  closeModal:()=>{},toast:()=>{},renderHome:()=>{},resetRenderedViewScroll:()=>{},
});

(async()=>{
  await controller.open();
  const restoreUnlock=()=>{};
  controller.openRtgPlayerDetails("d1","",{onClose:restoreUnlock});
  assert.strictEqual(detailCalls.length,1);
  assert.strictEqual(detailCalls[0].player.playerId,"d1");
  assert.strictEqual(detailCalls[0].player.level,20);
  assert.strictEqual(detailCalls[0].options.level,20);
  assert.strictEqual(detailCalls[0].options.readOnly,true);
  assert.strictEqual(detailCalls[0].options.equipment,null);
  assert.strictEqual(detailCalls[0].options.database,freeDb);
  assert.strictEqual(detailCalls[0].options.rtgLegacyLabel,"");
  assert.strictEqual(detailCalls[0].options.onClose,restoreUnlock);

  const legacyCalls=[];
  const legacyIdentity={
    FREE_AGENTS:"free_agents",
    parse:(ref)=>{
      const raw=String(ref?.cardId||ref||"");
      if(raw.startsWith("free_agents::"))return{cardId:raw,playerId:raw.slice(13),legacySeasonId:"free_agents",sourceKind:"free_agents"};
      if(raw.startsWith("ie1::"))return{cardId:raw,playerId:raw.slice(5),legacySeasonId:"ie1",sourceKind:"season"};
      return{cardId:raw,playerId:raw,legacySeasonId:null,sourceKind:"legacy"};
    },
    legacyLabel:(seasonId)=>seasonId==="ie1"?"S1":"",
  };
  const legacyController=c.RoadToGloryController.create({
    cardIdentity:legacyIdentity,
    playerResolver:{
      resolveAtLevel20:(ref)=>({playerId:"d1",cardId:String(ref),legacySeasonId:String(ref).startsWith("ie1::")?"ie1":"free_agents",name:"D1",normalizedRole:"DF",position:"DF",finalOverall:70,overall:70,level:20}),
      resolveVersion:(ref)=>({seasonId:String(ref).startsWith("free_agents::")?"free_agents":"ie1"}),
      resolveMove:()=>null,
    },
    showPlayerDetailsFor:(player,options)=>legacyCalls.push({player,options}),
    toast:()=>{},
  });
  legacyController.openRtgPlayerDetails("ie1::d1");
  legacyController.openRtgPlayerDetails("free_agents::d1");
  assert.strictEqual(legacyCalls[0].options.rtgLegacyLabel,"S1");
  assert.strictEqual(legacyCalls[1].options.rtgLegacyLabel,"");
  const playerViewSource=fs.readFileSync("js/player/player-view.js","utf8");
  assert.match(playerViewSource,/player-detail-rtg-legacy-badge/);
  assert.doesNotMatch(playerViewSource,/detailTopBadges/);
  const themeSource=fs.readFileSync("css/rtg-theme.css","utf8");
  assert.match(themeSource,/right:72px/);
  assert.match(themeSource,/top:16px/);
  console.log("rtg-player-detail-wiring-test: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
