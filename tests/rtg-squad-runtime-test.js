"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const mainTeams=["occult","wild","brainwashing","otaku","shuriken","farm","kirkwood","royal","zeus","raimon"];
const constraints={occult:{cap:75,minRecruit:0,recentCount:0,recentWindow:0},wild:{cap:77,minRecruit:1,recentCount:0,recentWindow:0},brainwashing:{cap:79,minRecruit:2,recentCount:0,recentWindow:0},otaku:{cap:77,minRecruit:2,recentCount:1,recentWindow:2},shuriken:{cap:80,minRecruit:3,recentCount:1,recentWindow:2},farm:{cap:81,minRecruit:3,recentCount:1,recentWindow:2},kirkwood:{cap:83,minRecruit:4,recentCount:2,recentWindow:3},royal:{cap:86,minRecruit:4,recentCount:2,recentWindow:3},zeus:{cap:87,minRecruit:5,recentCount:2,recentWindow:3},raimon:{cap:87,minRecruit:6,recentCount:3,recentWindow:3}};
const roles={gk:"GK",d1:"DF",d2:"DF",d3:"DF",d4:"DF",m1:"MF",m2:"MF",m3:"MF",f1:"FW",f2:"FW",f3:"FW",b1:"GK",b2:"DF",b3:"MF",b4:"FW"};
const players=Object.entries(roles).map(([playerId,position])=>({playerId,position,normalizedRole:position,finalOverall:70,category:"Buono",teamId:"occult",teamIds:["occult"]}));
const seasonDb={formations:{eleven:[{id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}}]},players};
let movePower=null;const resolvedCalls=[];
const resolver={resolveAtLevel20:(id,season,variant,freeDb)=>{resolvedCalls.push({id,season,variant,freeDb});const p=players.find(x=>x.playerId===id);return p?{...p,overall:75,level:20}:null;},resolveMove:(id,season,role,freeDb)=>movePower==null?null:{name:"Move",power:movePower,type:role==="GK"?"save":"dribble"}};
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,RoadToGloryConfig:{SEASON1:{mainTeams,constraints}}};c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-runtime.js","utf8"),c);const S=c.RoadToGlorySquadRuntime;
const lineup=["gk","d1","d2","d3","d4","m1","m2","m3","f1","f2","f3"],bench=["b1","b2","b3","b4"],all=[...lineup,...bench];
let state={activeSeasonId:"ie1",gachaAcquiredPlayerIds:["f1"],defeatedTeamIds:["occult"],squads:{ie1:{formationId:"4-3-3",lineup,bench,activeRoleVariantByPlayerId:{}}}};
assert.deepStrictEqual(Array.from(S.accessiblePlayerIds({freeAgentIds:["gk","d1"],state})).sort(),["d1","f1","gk"]);
let valid=S.validateSquad({state,seasonDb,freeAgentIds:all,freeAgentsDb:{marker:true},playerResolver:resolver});assert.strictEqual(valid.valid,true);assert.strictEqual(valid.lineupPlayers.length,11);assert.strictEqual(resolvedCalls.every(x=>x.season==="ie1"),true);
const bad=JSON.parse(JSON.stringify(state));bad.squads.ie1.bench[0]="gk";assert.strictEqual(S.validateSquad({state:bad,seasonDb,freeAgentIds:all,playerResolver:resolver}).valid,false);
movePower=50;assert.strictEqual(S.teamPower({lineup,activeSeasonId:"ie1",playerResolver:resolver}),75.0);movePower=80;assert.strictEqual(S.teamPower({lineup,activeSeasonId:"ie1",playerResolver:resolver}),76.0);movePower=110;assert.strictEqual(S.teamPower({lineup,activeSeasonId:"ie1",playerResolver:resolver}),77.0);movePower=null;assert.strictEqual(S.teamPower({lineup,activeSeasonId:"ie1",playerResolver:resolver}),75.0);
const expected={wild:[1,0,0],brainwashing:[2,0,0],otaku:[2,1,2],shuriken:[3,1,2],farm:[3,1,2],kirkwood:[4,2,3],royal:[4,2,3],zeus:[5,2,3],raimon:[6,3,3]};
for(const [target,[minRecruit,recentCount,recentWindow]] of Object.entries(expected)){
  const targetIndex=mainTeams.indexOf(target);const defeated=mainTeams.slice(0,targetIndex);const recent=defeated.slice(-recentWindow);const recruits=lineup.slice(0,minRecruit);for(const p of players){p.teamId="occult";p.teamIds=["occult"];}for(let i=0;i<recentCount;i++){const p=players.find(x=>x.playerId===recruits[i]);const team=recent[i%recent.length];p.teamId=team;p.teamIds=[team];}
  const st={activeSeasonId:"ie1",gachaAcquiredPlayerIds:recruits,defeatedTeamIds:defeated,squads:{ie1:{formationId:"4-3-3",lineup,bench,activeRoleVariantByPlayerId:{}}}};
  const e=S.mainEligibility({teamId:target,state:st,seasonDb,freeAgentIds:all,playerResolver:resolver});assert.strictEqual(e.recruitCount>=minRecruit,true,target);assert.strictEqual(e.recentRecruitCount>=recentCount,true,target);assert.strictEqual(e.eligible,true,target);
  if(minRecruit>0){const fail={...st,gachaAcquiredPlayerIds:recruits.slice(0,minRecruit-1)};assert.strictEqual(S.mainEligibility({teamId:target,state:fail,seasonDb,freeAgentIds:all,playerResolver:resolver}).eligible,false,`${target}-min`);}
}
console.log("rtg-squad-runtime-test: PASS");
