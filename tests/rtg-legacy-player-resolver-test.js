"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const s2Profile={profileId:"mark@raimon_s2",playerId:"mark",teamId:"raimon_s2",name:"Mark S2 Raimon",category:"Mondiale",position:"GK",overall:96,finalOverall:96};
const databases={
  ie1:{seasonId:"ie1",players:[{playerId:"mark",name:"Mark S1",category:"Elite",position:"GK",overall:94,finalOverall:94}]},
  ie1_s2:{seasonId:"ie1_s2",requiresProfileAwareRuntime:true,players:[{playerId:"mark",name:"Mark S2",category:"Mondiale",position:"GK",overall:95,finalOverall:95}],profiles:[s2Profile]}
};
const c={
  globalThis:null,Object,Array,String,Number,JSON,Map,Set,
  SeasonRegistry:{
    normalizeSeasonId:v=>String(v),
    database:id=>databases[id]||null,
    player:(pid,sid)=>(databases[sid]?.players||[]).find(p=>String(p.playerId)===String(pid))||null
  },
  ProfiledSeasonRuntime:{
    canonicalPlayerId:(sid,pid)=>sid==="ie1_s2"&&String(pid)===s2Profile.profileId?s2Profile.playerId:String(pid),
    resolveProfile:(sid,pid)=>sid==="ie1_s2"&&String(pid)===s2Profile.profileId?s2Profile:null,
    resolveEffectivePlayerAtLevel:(entry,ctx)=>{
      const profile=(ctx.database.profiles||[]).find(x=>x.profileId===entry.activeProfileId);
      const p=profile||ctx.database.players.find(x=>x.playerId===entry.playerId);
      return{...p,playerId:entry.playerId,profileId:profile?.profileId,level:20};
    }
  },
  DevelopmentAccountV3:{read:()=>({players:{}})},DevelopmentRuntime:{},
  InazumaProgression:{getPlayerAtLevel:(player,level)=>({...player,level})},
  MatchMoveRuntime:{moveForPlayer:(seasonId)=>({name:seasonId,power:80,type:"save"})}
};
c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-card-identity.js","js/road-to-glory/rtg-player-resolver.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const r=c.RoadToGloryPlayerResolver;
const s1=r.resolveAtLevel20("ie1::mark","ie1_s2",null,{players:[]});
const s2=r.resolveAtLevel20("ie1_s2::mark","ie1_s2",null,{players:[]});
assert.strictEqual(s1.name,"Mark S1");assert.strictEqual(s1.overall,94);assert.strictEqual(s1.cardId,"ie1::mark");assert.strictEqual(s1.legacySeasonId,"ie1");
assert.strictEqual(s2.name,"Mark S2");assert.strictEqual(s2.overall,95);assert.strictEqual(s2.cardId,"ie1_s2::mark");assert.strictEqual(s2.legacySeasonId,"ie1_s2");
assert.strictEqual(r.resolveMove("ie1::mark","ie1_s2","GK",{players:[]}).name,"ie1");assert.strictEqual(r.resolveMove("ie1_s2::mark","ie1_s2","GK",{players:[]}).name,"ie1_s2");

const exactCard="ie1_s2::mark@raimon_s2";
const exactVersion=r.resolveExactCard(exactCard,{players:[]});
assert.strictEqual(exactVersion.cardId,exactCard,"resolver must never collapse an exact S2 profile card to the canonical card");
assert.strictEqual(exactVersion.playerId,s2Profile.profileId,"profile-aware playerId must preserve the exact profile identity");
assert.strictEqual(exactVersion.profileId,s2Profile.profileId);
assert.strictEqual(exactVersion.canonicalPlayerId,"mark","canonical identity must remain separately available");
const exactPlayer=r.resolveAtLevel20(exactCard,"ie1_s2",null,{players:[]});
assert.strictEqual(exactPlayer.cardId,exactCard);
assert.strictEqual(exactPlayer.playerId,"mark","effective player keeps canonical gameplay identity");
assert.strictEqual(exactPlayer.profileId,s2Profile.profileId);
assert.strictEqual(exactPlayer.overall,96,"exact profile statistics must be used");
console.log("rtg-legacy-player-resolver-test: PASS");
