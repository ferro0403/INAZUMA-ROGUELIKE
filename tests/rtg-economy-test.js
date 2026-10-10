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
assert.deepStrictEqual(JSON.parse(JSON.stringify(E.PROJECT_PRICES)),{Buono:150,Forte:300,Elite:500,Mondiale:800,Leggenda:1200,Aurico:1800});
assert.deepStrictEqual(JSON.parse(JSON.stringify(E.EVOLUTION_COSTS)),{Normale:{tokens:100,projects:0},Buono:{tokens:200,projects:1},Forte:{tokens:350,projects:1},Elite:{tokens:550,projects:1},Mondiale:{tokens:800,projects:1},Leggenda:{tokens:1100,projects:1},Aurico:{tokens:1200,projects:1}});
assert.strictEqual(E.PROJECT_PRICES.Aurico+E.EVOLUTION_COSTS.Aurico.tokens,3000,"Aurico project + evolution must total 3000");
assert.strictEqual(C.MAIN_WIN_REWARD,350);
assert.strictEqual(C.SECONDARY_WIN_REWARD,200);
assert.strictEqual(C.SEASON_TRANSITION_REWARD,1000);
assert(Object.values(C.SEASON1.mainRewards).every(value=>value===350));
assert(Object.values(C.SEASON2.mainRewards).every(value=>value===350));
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.SEASON1.secondaryRewards)),[{amount:200,weight:100}]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.SEASON2.secondaryRewards)),[{amount:200,weight:100}]);

const base={activeSeasonId:"ie1",tokens:5000,projects:{Buono:1,Forte:1,Elite:1,Mondiale:1,Leggenda:1,Aurico:1},gachaAcquiredCards:[{cardId:"ie1::mark"},{cardId:"ie1_s2::mark"}],developmentByCardId:{}};
const bought=E.purchaseProject(base,"Aurico");
assert.strictEqual(bought.ok,true);assert.strictEqual(bought.state.tokens,3200);assert.strictEqual(bought.state.projects.Aurico,2);
assert.strictEqual(base.tokens,5000,"purchase must not mutate input state");
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
console.log("rtg-economy-test: PASS");
