"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const ctx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),ctx);
ctx.RoadToGloryCardIdentity={
 normalizeSeasonId:s=>String(s),cardIdForSeason:(p,s)=>`${s}::${p}`,cardIdForFreeAgent:p=>`free_agents::${p}`,
 parse(v){const raw=String(v?.cardId||v||""),i=raw.indexOf("::");return i>0?{cardId:raw,playerId:raw.slice(i+2),profileId:raw.slice(i+2),legacySeasonId:raw.slice(0,i)}:{cardId:raw,playerId:raw,legacySeasonId:null};}
};
ctx.RoadToGloryRng={weightedPick:a=>a[0],float:()=>0};
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-gacha.js","utf8"),ctx);
const G=ctx.RoadToGloryGacha;
const base={activeSeasonId:"ie1_s2",defeatedTeamIds:[],gachaAcquiredCards:[],tokens:9999,campaignSeed:"test",gacha:{pullCount:0}};
assert.strictEqual(G.unlockedCandidates(base,db).length,0,"S2 must start with an empty distributor pool");
const secret={...base,defeatedTeamIds:["secret_service"]};
const p1=G.unlockedCandidates(secret,db);
assert(p1.length>0,"Secret Service victory must unlock its profiles");
assert(p1.every(x=>String(x.teamId)==="secret_service"));
assert(p1.every(x=>String(x.cardId).startsWith("ie1_s2::")));
const gemini={...base,defeatedTeamIds:["secret_service","gemini_storm"]};
const p2=G.unlockedCandidates(gemini,db);
assert(p2.length>p1.length,"Gemini victory must expand the pool");
const teams=new Set(p2.map(x=>String(x.teamId)));
assert(teams.has("secret_service")&&teams.has("gemini_storm"));
assert(!teams.has("epsilon"),"undefeated teams must remain locked");
console.log("rtg-season2-distributor-unlock-flow-test: PASS");
