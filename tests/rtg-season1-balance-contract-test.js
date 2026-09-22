"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const db=JSON.parse(fs.readFileSync("data/IE1_season_compact.json","utf8"));
const moves=JSON.parse(fs.readFileSync("data/IE1_moves.json","utf8"));
const cfgContext={globalThis:null,Object,Array,Set,Map,JSON,Math};cfgContext.globalThis=cfgContext;vm.createContext(cfgContext);vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),cfgContext);
const config=cfgContext.RoadToGloryConfig.SEASON1;
assert.deepStrictEqual(Array.from(config.mainTeams),(db.bossOrder||[]).map(b=>b.teamId));
for(const teamId of config.mainTeams){const team=(db.teams||[]).find(t=>t.teamId===teamId);assert(team,teamId);assert((team.playerIds||[]).length>0,teamId);}
const allowed=new Set(["Normale","Buono","Forte","Elite","Mondiale"]);const counts={};for(const p of db.players||[]){assert(allowed.has(p.category),`${p.playerId}:${p.category}`);counts[p.category]=(counts[p.category]||0)+1;}
assert.deepStrictEqual(counts,{Normale:12,Buono:45,Forte:54,Elite:35,Mondiale:11});assert.strictEqual((db.players||[]).some(p=>p.category==="Leggenda"),false);
function teamCategories(teamId){const boss=(db.bossOrder||[]).find(b=>b.teamId===teamId);return (boss?.rewardPoolPlayerIds||[]).map(id=>(db.players||[]).find(p=>String(p.playerId)===String(id))?.category).filter(Boolean);}
const firstElite=config.mainTeams.find(teamId=>teamCategories(teamId).includes("Elite"));const firstWorld=config.mainTeams.find(teamId=>teamCategories(teamId).includes("Mondiale"));assert.strictEqual(firstElite,"shuriken");assert.strictEqual(firstWorld,"royal");
const moveContext={globalThis:null,Object,Array,String,Number,Math,SeasonRegistry:{database:(seasonId)=>seasonId==="ie1"?{moveCatalog:moves}:null}};moveContext.globalThis=moveContext;vm.createContext(moveContext);vm.runInContext(fs.readFileSync("js/moves/move-runtime.js","utf8"),moveContext);
for(const boss of db.bossOrder||[]){for(const playerId of boss.startingXIPlayerIds||[]){const player=(db.players||[]).find(p=>String(p.playerId)===String(playerId));const move=moveContext.MatchMoveRuntime.moveForPlayer("ie1",player);assert(move,`${boss.teamId}:${playerId}`);}}
assert.strictEqual(Object.values(config.mainRewards).reduce((a,b)=>a+b,0),4075);assert.strictEqual(config.secondaryRewards.reduce((a,b)=>a+b.weight,0),100);
console.log("rtg-season1-balance-contract-test: PASS");
