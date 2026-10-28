"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,window:null,Object,Array,String,Number,Math,Set,Map,JSON,Date,Error,TypeError,
  SeasonRegistry:{normalizeSeasonId:v=>String(v),canonicalPlayerId:(_s,p)=>String(p),player:()=>null},
  ProfiledSeasonRuntime:{canonicalPlayerId:(_s,p)=>String(p)},
  DevelopmentV2:{
    threshold:r=>({Normale:70,Buono:75,Forte:80,Elite:85,Mondiale:90,Leggenda:95,Aurico:99})[r],
    nextRarity:r=>{const a=["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"],i=a.indexOf(r);return i<2?"Normale":a[i+1]||null;}
  }
};
c.globalThis=c;c.window=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-card-identity.js","js/road-to-glory/rtg-economy.js","js/road-to-glory/rtg-config.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryEconomy,C=c.RoadToGloryConfig;
assert.deepStrictEqual(JSON.parse(JSON.stringify(E.PROJECT_PRICES)),{Buono:150,Forte:300,Elite:550,Mondiale:850,Leggenda:1300,Aurico:2000});
assert.deepStrictEqual(JSON.parse(JSON.stringify(E.EVOLUTION_COSTS)),{Normale:{tokens:100,projects:0},Buono:{tokens:200,projects:1},Forte:{tokens:350,projects:1},Elite:{tokens:550,projects:1},Mondiale:{tokens:850,projects:1},Leggenda:{tokens:1200,projects:1},Aurico:{tokens:1500,projects:1}});
assert.strictEqual(E.PROJECT_PRICES.Aurico+E.EVOLUTION_COSTS.Aurico.tokens,3500,"Aurico project + evolution must total 3500");
assert.strictEqual(C.MAIN_WIN_REWARD,350);
assert.strictEqual(C.SECONDARY_WIN_REWARD,200);
assert.strictEqual(C.SEASON_TRANSITION_REWARD,1000);
assert.strictEqual(C.SEASON1.mainRewards.occult,350);assert.strictEqual(C.SEASON1.mainRewards.raimon,650);
assert.strictEqual(C.SEASON2.mainRewards.secret_service,350);assert.strictEqual(C.SEASON2.mainRewards.raimon_inazuma_eleven_2,650);assert.strictEqual(C.SEASON_COMPLETION_REWARD,2000);
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.SEASON1.secondaryRewards)),[{amount:200,weight:100}]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.SEASON2.secondaryRewards)),[{amount:200,weight:100}]);

const base={activeSeasonId:"ie1",tokens:15000,projects:{Buono:1,Forte:1,Elite:1,Mondiale:1,Leggenda:1,Aurico:1},gachaAcquiredCards:[{cardId:"ie1::mark"},{cardId:"ie1_s2::mark"}],developmentByCardId:{}};
const bought=E.purchaseProject(base,"Aurico");
assert.strictEqual(bought.ok,true);assert.strictEqual(bought.state.tokens,13000);assert.strictEqual(bought.state.projects.Aurico,2);
assert.strictEqual(base.tokens,15000,"purchase must not mutate input state");
const poor={...base,tokens:149,projects:{...base.projects,Buono:0}},poorBefore=JSON.stringify(poor);
const failedBuy=E.purchaseProject(poor,"Buono");assert.strictEqual(failedBuy.ok,false);assert.strictEqual(JSON.stringify(poor),poorBefore,"failed purchase must be atomic");

let state=JSON.parse(JSON.stringify(base));
for(const target of["Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]){
  const preview=E.previewEvolution(state,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole"});
  assert.strictEqual(preview.target,target);
  const out=E.evolve(state,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole",expectedTarget:target});
  assert.strictEqual(out.ok,true,target);
  state=out.state;
}
assert.strictEqual(state.developmentByCardId["ie1::mark"].targetPotential,99);
assert.strictEqual(state.developmentByCardId["ie1::mark"].currentRarity,"Aurico");
assert.strictEqual(state.developmentByCardId["ie1_s2::mark"],undefined,"season cards must evolve independently");
assert.strictEqual(E.previewEvolution(state,{cardId:"free_agents::mark",basePotential:65,baseRarity:"Debole"}).ok,false,"free agents are not RTG development targets");
// Regression: Halloween cards have no compact progressionCode, but their
// already committed RTG evolutions must update OVR/stats via the canonical
// progression helper. No second purchase or mutation on read.
vm.runInContext(fs.readFileSync("js/roguelike_progression.js","utf8"),c,{filename:"roguelike_progression.js"});
const eventRaw=JSON.parse(fs.readFileSync("data/rtg-halloween-occult-players.json","utf8"))[0].players;
const sourceEvent=pid=>{
  const raw=eventRaw.find(p=>String(p.playerId)===String(pid));
  const keys=["attack","control","speed","grit","physical","stamina","defense","save"];
  const stats=Object.fromEntries(keys.map(key=>[key,Number(raw[key]||0)*10]));
  return {...raw,...stats,stats,baseStats:stats,cardId:"halloween2026::"+pid,legacySeasonId:"halloween2026",
    finalOverall:Number(raw.overall),category:raw.category,finalRarity:raw.category,
    level:20,normalizedRole:raw.position};
};
c.RoadToGloryHalloween={EVENT_ID:"halloween2026",eventPlayer:sourceEvent};
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-player-resolver.js","utf8"),c,{filename:"rtg-player-resolver.js"});
const resolver=c.RoadToGloryPlayerResolver;
let account={tokens:4500,projects:{Elite:1,Aurico:1},
  gachaAcquiredCards:[{cardId:"halloween2026::38"},{cardId:"halloween2026::custom_0001"}],
  developmentByCardId:{}};
const johnId="halloween2026::38",swiftId="halloween2026::custom_0001";
const johnBefore=resolver.resolveOwnedAtLevel20(johnId,"ie1",null,null,account.developmentByCardId);
const swiftBefore=resolver.resolveOwnedAtLevel20(swiftId,"ie1",null,null,account.developmentByCardId);
assert.strictEqual(johnBefore.overall,83);
assert.strictEqual(swiftBefore.overall,96);
const johnEvolution=E.evolve(account,{cardId:johnId,basePotential:83,baseRarity:"Forte",expectedTarget:"Elite"});
assert.strictEqual(johnEvolution.ok,true);
account=johnEvolution.state;
const johnAfter=resolver.resolveOwnedAtLevel20(johnId,"ie1",null,null,account.developmentByCardId);
assert.strictEqual(johnAfter.overall,85,"Nathan Jones Forte→Elite must show the paid +2 OVR");
assert.strictEqual(johnAfter.finalOverall,85);
assert.strictEqual(johnAfter.category,"Elite");
assert.strictEqual(johnAfter.stats.save>=johnBefore.stats.save,true);
assert.strictEqual(resolver.resolveOwnedAtLevel20(johnId,"orion",null,null,account.developmentByCardId).overall,85,
  "RTG development from shared account is visible across campaigns");
const swiftEvolution=E.evolve(account,{cardId:swiftId,basePotential:96,baseRarity:"Leggenda",expectedTarget:"Aurico"});
assert.strictEqual(swiftEvolution.ok,true);
account=swiftEvolution.state;
const swiftAfter=resolver.resolveOwnedAtLevel20(swiftId,"ie1",null,null,account.developmentByCardId);
assert.strictEqual(swiftAfter.overall,99,"Nathan Swift Leggenda→Aurico must show +3 OVR");
assert.strictEqual(swiftAfter.category,"Aurico");
const accountBeforeRead=JSON.stringify(account);
resolver.resolveOwnedAtLevel20(johnId,"ie1",null,null,account.developmentByCardId);
resolver.resolveOwnedAtLevel20(swiftId,"ie1",null,null,account.developmentByCardId);
assert.strictEqual(JSON.stringify(account),accountBeforeRead,"Resolution is pure: never charge evolution resources twice");
assert.strictEqual(sourceEvent("38").overall,83,"Opposing event players and original source remain unmodified");
assert.strictEqual(sourceEvent("custom_0001").overall,96,"Match opposition uses unmodified event assets");
console.log("rtg-economy-test: PASS");
