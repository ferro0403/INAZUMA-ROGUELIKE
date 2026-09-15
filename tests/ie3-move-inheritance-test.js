"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const read=path=>JSON.parse(fs.readFileSync(path,"utf8"));
const ie1=read("data/IE1_moves.json"),ie2=read("data/IE1_S2_moves.json"),ie3=read("data/IE1_S3_moves.json"),season=read("data/IE1_S3_season_compact.json");
const inherited=ie3.inheritedPlayers||{};
assert.strictEqual(Object.keys(ie3.players).length,296);
assert.strictEqual(Object.keys(inherited).length,288);
assert.strictEqual(Object.keys(inherited).filter(id=>ie3.players[id]).length,0);
const recruitmentIds=[...new Set(season.recruitmentPool.entries.filter(entry=>entry.sourceKind==="season3_recruitment_profile").map(entry=>String(entry.playerId)))].sort();
assert.deepStrictEqual(Object.keys(inherited).sort(),recruitmentIds,"all historical S3 recruitment players must inherit exactly one move");

const historicalById=new Map();
for(const catalog of[ie1,ie2])for(const[id,move]of Object.entries(catalog.players||{})){if(!historicalById.has(id))historicalById.set(id,[]);historicalById.get(id).push(move);}
const explicit={
  "1053":{name:"Spinning Cut",type:"defense",element:"Wind",power:50},
  "170":{name:"Full Power Shield",type:"save",element:"Fire",power:70},
  "174":{name:"Killer Slide",type:"defense",element:"Forest",power:50}
};
for(const[id,move]of Object.entries(inherited)){
  if(explicit[id]){assert.deepStrictEqual(move,explicit[id],id+" explicit no-baseline inheritance");continue;}
  const historical=historicalById.get(id)||[];
  assert(historical.length,id+" must have a S1/S2 historical move");
  assert(historical.some(candidate=>JSON.stringify(candidate)===JSON.stringify(move)),id+" inherited move must be an exact historical catalog record");
}
for(const[id,move]of Object.entries(explicit))assert.deepStrictEqual(inherited[id],move);

const c={console};c.globalThis=c;c.SeasonRegistry={database:id=>id==="ie1_s3"?{moveCatalog:ie3}:null};
vm.runInNewContext(fs.readFileSync("js/moves/move-runtime.js","utf8"),c);
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.MatchMoveRuntime.moveForPlayer("ie1_s3","1154"))),{playerId:"1154",name:"Toughness Block",type:"save",element:"Mountain",power:60});
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.MatchMoveRuntime.moveForPlayer("ie1_s3","180"))),{playerId:"180",name:"Mega Quake",type:"defense",element:"Mountain",power:70});
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.MatchMoveRuntime.moveForPlayer("ie1_s3","1053"))),{playerId:"1053",name:"Spinning Cut",type:"defense",element:"Wind",power:50});
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.MatchMoveRuntime.moveForPlayer("ie1_s3","170"))),{playerId:"170",name:"Full Power Shield",type:"save",element:"Fire",power:70});
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.MatchMoveRuntime.moveForPlayer("ie1_s3","174"))),{playerId:"174",name:"Killer Slide",type:"defense",element:"Forest",power:50});
assert.strictEqual(c.MatchMoveRuntime.moveForPlayer("ie1_s3","1").name,"God Catch","direct S3 move must win over inheritance fallback");
const sampleTeam=recruitmentIds.slice(0,11).map(playerId=>({playerId,position:"MF"}));
assert.strictEqual(c.MatchMoveRuntime.teamContribution("ie1_s3",sampleTeam).mappedPlayers,11,"historical S3 recruitment lineup must not lose move contribution");
console.log("IE3 move inheritance: 288 historical pull players resolve S1/S2 moves; 3 no-baseline fallbacks covered");
