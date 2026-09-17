"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const formation={id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}};
const cfg={SEASON1:{
 formations:[formation],
 mainTeams:["occult","wild"],
 constraints:{
  occult:{cap:80,minRecruit:0,recentWindow:0,recentCount:0},
  wild:{cap:80,minRecruit:2,recentWindow:1,recentCount:1}
 }
}};
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,RoadToGloryConfig:cfg};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-runtime.js","utf8"),c);
const mk=(id,role)=>({playerId:id,name:id,normalizedRole:role,position:role,overall:70});
const lineup=[mk("g","GK"),mk("d1","DF"),mk("d2","DF"),mk("d3","DF"),mk("d4","DF"),mk("m1","MF"),mk("m2","MF"),mk("m3","MF"),mk("f1","FW"),mk("f2","FW"),mk("f3","FW")];
const bench=[mk("r1","MF"),mk("r2","FW"),mk("b3","DF"),mk("b4","GK")];
const byId=new Map([...lineup,...bench].map(p=>[p.playerId,p]));
const resolver={resolveAtLevel20:id=>byId.get(String(id))||null,resolveMove:()=>null};
const state={activeSeasonId:"ie1",defeatedTeamIds:["occult"],gachaAcquiredPlayerIds:["r1","r2"],squads:{ie1:{formationId:"4-3-3",lineup:lineup.map(p=>p.playerId),bench:bench.map(p=>p.playerId),activeRoleVariantByPlayerId:{}}}};
const seasonDb={formations:{eleven:[formation]},players:[{playerId:"r1",teamId:"occult"},{playerId:"r2",teamId:"occult"}]};
const ids=[...lineup,...bench].map(p=>p.playerId);
const result=c.RoadToGlorySquadRuntime.mainEligibility({teamId:"wild",state,seasonDb,freeAgentIds:ids,freeAgentsDb:{players:[]},playerResolver:resolver});
assert.strictEqual(result.eligible,true);
assert.strictEqual(result.recruitCount,2);
assert.strictEqual(result.recentRecruitCount,2);
assert.strictEqual(result.requirementRosterSize,15);
assert.strictEqual(result.teamPower,70);
const noBench={...state,gachaAcquiredPlayerIds:[],squads:{ie1:{...state.squads.ie1}}};
const fail=c.RoadToGlorySquadRuntime.mainEligibility({teamId:"wild",state:noBench,seasonDb,freeAgentIds:ids,freeAgentsDb:{players:[]},playerResolver:resolver});
assert.strictEqual(fail.eligible,false);
assert(fail.reasons.includes("min-s1-recruits"));
console.log("rtg-bench-requirements-test: PASS");