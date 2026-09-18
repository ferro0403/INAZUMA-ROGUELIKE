"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const formation={id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]};
const config={
  SEASON1:{
    formations:[formation],
    mainTeams:["occult"],
    constraints:{occult:{cap:75,minRecruit:0,recentWindow:0,recentCount:0}},
  },
  buildSeasonNodes:()=>[{id:"main:occult",type:"main",teamId:"occult",mainIndex:0}],
};

const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError,RoadToGloryConfig:config};
c.globalThis=c;
vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-runtime.js","utf8"),c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),c);

const make=(prefix,overall)=>{
  const roles=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW","GK","DF","MF","FW"];
  return roles.map((role,index)=>({
    playerId:`${prefix}${index+1}`,
    name:`${prefix}${index+1}`,
    normalizedRole:role,
    position:role,
    finalOverall:overall,
    overall,
  }));
};
const strong=make("s",85);
const weak=make("w",70);
const players=[...strong,...weak];
const freeDb={players};
const seasonDb={formations:{eleven:[formation]},players:[],teams:[],bossOrder:[]};

let current={
  schemaVersion:1,
  campaignId:"rtg-ie-trilogy",
  campaignSeed:"seed",
  activeSeasonId:"ie1",
  seasonComplete:false,
  tokens:0,
  lives:2,
  currentNodeId:"main:occult",
  furthestNodeIndex:0,
  defeatedTeamIds:[],
  firstClearMatchIds:[],
  gachaAcquiredPlayerIds:[],
  gacha:{pullCount:0},
  squads:{
    ie1:{
      formationId:"4-3-3",
      lineup:strong.slice(0,11).map(player=>player.playerId),
      bench:strong.slice(11,15).map(player=>player.playerId),
      activeRoleVariantByPlayerId:{},
    },
  },
  attemptsByNode:{},
  activeMatch:null,
};

const clone=value=>JSON.parse(JSON.stringify(value));
const repository={
  ensureCampaign:async()=>clone(current),
  update:async(_label,mutate)=>{current=mutate(clone(current));return clone(current);},
};
const resolver={
  resolveAtLevel20:(playerId)=>{
    const player=players.find(entry=>entry.playerId===String(playerId));
    return player?{...player,level:20}:null;
  },
  resolveMove:()=>null,
};
const app={innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]};
const controller=c.RoadToGloryController.create({
  app,
  repository,
  runView:{lockedMarkup:()=>"",runMarkup:()=>"",requirementsMarkup:()=>""},
  squadView:{renderModel:()=>({}),markup:()=>"<squad>",bind:()=>{}},
  matchView:{bind:()=>{}},
  ensureSeason1Db:async()=>seasonDb,
  getFreeAgentsDb:()=>freeDb,
  getAlbumProgress:()=>({}),
  entitlements:{
    accessStatus:()=>({unlocked:true,count:players.length,formationIds:["4-3-3"]}),
    unlockedFreeAgentIds:()=>players.map(player=>player.playerId),
  },
  config,
  squadRuntime:c.RoadToGlorySquadRuntime,
  playerResolver:resolver,
  openModal:()=>{},
  closeModal:()=>{},
  toast:()=>{},
  resetRenderedViewScroll:()=>{},
});

(async()=>{
  await controller.open({destination:"squad"});
  const before=c.RoadToGlorySquadRuntime.mainEligibility({
    teamId:"occult",state:current,seasonDb,freeAgentIds:players.map(player=>player.playerId),freeAgentsDb:freeDb,playerResolver:resolver,
  });
  assert.strictEqual(before.eligible,false);
  assert.strictEqual(before.teamPower,85);

  const adapted=controller.adaptSquadToCurrentRequirements();
  assert.strictEqual(adapted.ok,true);
  assert.strictEqual(adapted.eligibility.eligible,true);
  assert.strictEqual(adapted.eligibility.teamPower,75);

  const squad=controller.getDraftSquad();
  assert.strictEqual(squad.lineup.length,11);
  assert.strictEqual(squad.bench.length,4);
  assert.strictEqual(new Set([...squad.lineup,...squad.bench]).size,15);

  const probe={...current,squads:{...current.squads,ie1:clone(squad)}};
  const after=c.RoadToGlorySquadRuntime.mainEligibility({
    teamId:"occult",state:probe,seasonDb,freeAgentIds:players.map(player=>player.playerId),freeAgentsDb:freeDb,playerResolver:resolver,
  });
  assert.strictEqual(after.eligible,true);
  assert.strictEqual(after.teamPower,75);
  console.log("rtg-adapt-requirements-test: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
