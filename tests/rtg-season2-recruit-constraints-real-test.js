"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const ctx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),ctx);
ctx.RoadToGloryCardIdentity={
 FREE_AGENTS:"free_agents",cardIdForFreeAgent:id=>`free_agents::${id}`,
 parse(v){const raw=String(v?.cardId||v||""),i=raw.indexOf("::");return i>0?{cardId:raw,legacySeasonId:raw.slice(0,i),playerId:raw.slice(i+2),profileId:raw.slice(i+2)}:{cardId:raw,legacySeasonId:null,playerId:raw};}
};
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-runtime.js","utf8"),ctx);
const R=ctx.RoadToGlorySquadRuntime, profiles=db.profiles||[];
const byTeam=t=>profiles.filter(p=>String(p.teamId)===t);
const card=p=>`ie1_s2::${p.profileId}`;
const s1=id=>`ie1::${id}`;
const resolver={
 resolveVersion(cid){const pid=ctx.RoadToGloryCardIdentity.parse(cid).playerId,p=profiles.find(x=>String(x.profileId)===pid);return p?{player:p}:null;},
 resolveAtLevel20(cid){const pid=ctx.RoadToGloryCardIdentity.parse(cid).playerId,p=profiles.find(x=>String(x.profileId)===pid);return p?{...p,overall:70,normalizedRole:p.normalizedRole||p.position}: {overall:70,normalizedRole:"MF"};},
 resolveMove(){return null;}
};
const recent=["genesis","mary_times","dark_emperors","zeus"];
const recruits=recent.flatMap(t=>byTeam(t).slice(0,3)).slice(0,8).map(card);
assert.strictEqual(recruits.length,8,"fixture must provide eight S2 recruits");
const filler=Array.from({length:7},(_,i)=>s1("legacy-"+i));
const roster=[...recruits,...filler].slice(0,15);
const lineup=roster.slice(0,11),bench=roster.slice(11,15);
const state={activeSeasonId:"ie1_s2",defeatedTeamIds:["gemini_storm","epsilon","royal_academy_redux","epsilon_plus","diamond_dust","prominence","chaos",...recent],gachaAcquiredCards:recruits.map(cardId=>({cardId})),squads:{ie1_s2:{formationId:"4-3-3",lineup,bench,activeRoleVariantByCardId:{}}}};
const result=R.mainEligibility({teamId:"raimon_inazuma_eleven_2",state,seasonDb:db,playerResolver:resolver});
assert.strictEqual(result.recruitCount,8,"S1 cards must not count toward S2 minimum");
assert.strictEqual(result.minRecruit,8);
assert.strictEqual(result.recentCount,4);
assert(result.recentRecruitCount>=4,"recent requirement must count exact S2 profile teams");
const withOnlySeven={...state,gachaAcquiredCards:recruits.slice(0,7).map(cardId=>({cardId}))};
const fail=R.mainEligibility({teamId:"raimon_inazuma_eleven_2",state:withOnlySeven,seasonDb:db,playerResolver:resolver});
assert(fail.reasons.includes("min-season-recruits"));
console.log("rtg-season2-recruit-constraints-real-test: PASS");
