"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const freeAgentsDb={players:[{playerId:"fa1",name:"Free One",category:"Normale",position:"FW",normalizedRole:"FW",finalOverall:73,finalStats:{attack:70,control:65,speed:65,grit:60,physical:55,stamina:60,defense:30,save:1}}]};
let moveCalls=0;
const c={globalThis:null,Object,Array,String,Number,JSON,Map,Set,
SeasonRegistry:{database:()=>null,player:()=>null},
ProfiledSeasonRuntime:{canonicalPlayerId:(_sid,pid)=>String(pid)},
InazumaProgression:{getPlayerAtLevel:(player,level,database)=>({...player,level,overall:player.finalOverall,stats:player.finalStats,databaseMarker:database===freeAgentsDb})},
MatchMoveRuntime:{moveForPlayer:()=>{moveCalls++;return{name:"Should not happen"};}}};
c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-player-resolver.js","utf8"),c);
const r=c.RoadToGloryPlayerResolver;
const v=r.resolveVersion("fa1","ie1",freeAgentsDb);assert.strictEqual(v.seasonId,"free_agents");assert.strictEqual(v.player.playerId,"fa1");
const p=r.resolveAtLevel20("fa1","ie1",null,freeAgentsDb);assert.strictEqual(p.level,20);assert.strictEqual(p.overall,73);assert.strictEqual(p.databaseMarker,true);
assert.strictEqual(r.resolveMove("fa1","ie1","FW",freeAgentsDb),null);assert.strictEqual(moveCalls,0);
assert.strictEqual(r.rarity("fa1","ie1",freeAgentsDb),"Normale");
console.log("rtg-player-resolver-free-agent-test: PASS");
