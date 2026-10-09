"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const databases={
  ie1:{seasonId:"ie1",players:[{playerId:"mark",name:"Mark S1",category:"Normale",position:"GK",finalOverall:70,progressionCode:"x"}],teams:[]},
  ie1_s2:{seasonId:"ie1_s2",players:[{playerId:"mark",name:"Mark S2",category:"Buono",position:"GK",finalOverall:75,progressionCode:"x"}],teams:[]},
};
const c={globalThis:null,window:null,Object,Array,String,Number,Math,Set,Map,JSON,Error,TypeError,
  SeasonRegistry:{
    normalizeSeasonId:v=>String(v),
    canonicalPlayerId:(_s,p)=>String(p).split("@")[0],
    player:(pid,sid)=>(databases[sid]?.players||[]).find(p=>String(p.playerId)===String(pid))||null,
    database:sid=>databases[sid]||null,
  },
  ProfiledSeasonRuntime:{canonicalPlayerId:(_s,p)=>String(p).split("@")[0]},
  InazumaProgression:{getPlayerAtLevel:(player,level,_db,options={})=>{
    const base=Number(player.finalOverall)||0,boost=Number(options.currentOverallBoost)||0,potentialBoost=Number(options.potentialBoost)||0;
    return {...player,level,overall:Math.min(99,base+boost),potential:Math.min(99,base+potentialBoost)};
  }},
  MatchMoveRuntime:{moveForPlayer:()=>null}
};
c.globalThis=c;c.window=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-card-identity.js","js/road-to-glory/rtg-player-resolver.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const R=c.RoadToGloryPlayerResolver;
const upgrades={"ie1::mark":{targetPotential:80,currentRarity:"Forte"}};
const ownedS1=R.resolveOwnedAtLevel20("ie1::mark","ie1_s2",null,null,upgrades);
const bossS1=R.resolveStandardAtLevel20("ie1::mark","ie1_s2");
const untouchedS2=R.resolveOwnedAtLevel20("ie1_s2::mark","ie1_s2",null,null,upgrades);
assert.strictEqual(ownedS1.overall,80,"owned S1 card must receive its RTG evolution");
assert.strictEqual(ownedS1.potential,80);
assert.strictEqual(bossS1.overall,70,"standard opponent resolution must ignore owned RTG evolution");
assert.strictEqual(bossS1.potential,70);
assert.strictEqual(untouchedS2.overall,75,"same canonical player in another Season must remain independent");
const twoVersions={...upgrades,"ie1_s2::mark":{targetPotential:90,currentRarity:"Mondiale"}};
assert.strictEqual(R.resolveOwnedAtLevel20("ie1::mark","ie1_s2",null,null,twoVersions).overall,80);
assert.strictEqual(R.resolveOwnedAtLevel20("ie1_s2::mark","ie1_s2",null,null,twoVersions).overall,90);
assert.strictEqual(R.resolveStandardAtLevel20("ie1_s2::mark","ie1_s2").overall,75,"boss S2 version must stay standard too");
console.log("rtg-player-evolution-isolation-test: PASS");
