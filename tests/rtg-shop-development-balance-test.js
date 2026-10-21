"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const ctx={console};ctx.globalThis=ctx;ctx.DevelopmentV2={
  threshold:rarity=>({Normale:70,Buono:75,Forte:80,Elite:85,Mondiale:90,Leggenda:95,Aurico:99})[rarity],
  nextRarity:rarity=>{const a=["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"];const i=a.indexOf(rarity);return i<2?"Normale":a[i+1]||null;}
};
for(const path of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-card-identity.js","js/road-to-glory/rtg-economy.js","js/road-to-glory/rtg-economy-view.js"])
  vm.runInNewContext(fs.readFileSync(path,"utf8"),ctx,{filename:path});
const C=ctx.RoadToGloryConfig,E=ctx.RoadToGloryEconomy;
const prices={Buono:150,Forte:300,Elite:550,Mondiale:850,Leggenda:1300,Aurico:2000};
const evolution={Normale:100,Buono:200,Forte:350,Elite:550,Mondiale:850,Leggenda:1200,Aurico:1500};
assert.deepStrictEqual(JSON.parse(JSON.stringify(E.PROJECT_PRICES)),prices);
for(const [rarity,tokens]of Object.entries(evolution)){
  assert.strictEqual(E.EVOLUTION_COSTS[rarity].tokens,tokens);
  assert.strictEqual(E.EVOLUTION_COSTS[rarity].projects,rarity==="Normale"?0:1);
}
const full={};
for(const [rarity,tokens]of Object.entries(evolution))full[rarity]=tokens+(prices[rarity]||0);
assert.deepStrictEqual(full,{Normale:100,Buono:350,Forte:650,Elite:1100,Mondiale:1700,Leggenda:2500,Aurico:3500});
assert.strictEqual(Object.values(full).reduce((sum,value)=>sum+value,0),9900);
for(const id of C.SEASON_IDS){
  const season=C.season(id);
  assert(season.pullCost>=180&&season.pullCost<=250,"Season capsule pricing must remain unchanged");
  if(season.recruitmentPullCost!==null)assert.strictEqual(season.pullCost,season.recruitmentPullCost*2);
}
const wallet={activeSeasonId:"ie1",tokens:30000,projects:E.emptyProjects(),gachaAcquiredCards:[{cardId:"ie1::mark"}],developmentByCardId:{}};
let state=JSON.parse(JSON.stringify(wallet));
for(const [rarity,amount]of Object.entries(prices)){
  const before=state.tokens,result=E.purchaseProject(state,rarity);
  assert(result.ok,rarity);assert.strictEqual(result.state.tokens,before-amount);
  assert.strictEqual(result.state.projects[rarity],1);
  assert.strictEqual(state.tokens,before,"purchaseProject must not mutate input");
  state=result.state;
}
for(const [rarity,amount]of Object.entries(evolution)){
  const prev=E.previewEvolution(state,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole"});
  assert.strictEqual(prev.target,rarity);assert.strictEqual(prev.cost.tokens,amount);
  assert.strictEqual(prev.cost.projects,rarity==="Normale"?0:1);
  assert(prev.ready);
  const before=state.tokens,result=E.evolve(state,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole",expectedTarget:rarity});
  assert(result.ok,rarity);assert.strictEqual(result.state.tokens,before-amount);
  assert.strictEqual(result.state.projects[rarity]||0,0);
  assert.strictEqual(state.tokens,before,"evolve must not mutate input");
  state=result.state;
}
assert.strictEqual(state.tokens,30000-9900,"Full evolution must pay every price exactly once");
assert.strictEqual(state.developmentByCardId["ie1::mark"].currentRarity,"Aurico");
assert.strictEqual(state.developmentByCardId["ie1::mark"].targetPotential,99);
const rerun=E.evolve(state,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole"});
assert.strictEqual(rerun.ok,false);assert.strictEqual(rerun.reason,"max");
const short={...wallet,tokens:149};
assert.strictEqual(E.purchaseProject(short,"Buono").ok,false);
assert.strictEqual(short.tokens,149,"Failed shop purchase must remain atomic");
const poor={...wallet,tokens:349,projects:{...wallet.projects,Forte:1},developmentByCardId:{"ie1::mark":{targetPotential:75,currentRarity:"Buono"}}};
const insufficient=E.evolve(poor,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole",expectedTarget:"Forte"});
assert.strictEqual(insufficient.ok,false);assert.strictEqual(insufficient.reason,"resources");
assert.strictEqual(poor.tokens,349,"Failed evolution must not spend tokens or projects");
const stale=E.evolve(wallet,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole",expectedTarget:"Elite"});
assert.strictEqual(stale.ok,false);assert.strictEqual(stale.reason,"stale");
const selected=E.previewEvolution(poor,{cardId:"ie1::mark",basePotential:65,baseRarity:"Debole"});
assert.strictEqual(selected.missing.tokens,1);
const economyView=ctx.RoadToGloryEconomyView.create({economy:E,escapeHtml:value=>String(value)});
const shop=economyView.shopMarkup({state:wallet});
for(const rarity of E.PROJECT_RARITIES){
  assert(shop.includes(`PROGETTO ${rarity.toUpperCase()}`));
  assert(shop.includes(`${prices[rarity]} GETTONI`));
}
const selectedMarkup=economyView.developmentMarkup({state:poor,selected:{player:{cardId:"ie1::mark",name:"Mark",overall:75,potential:75},preview:selected,after:{overall:80}}});
assert(selectedMarkup.includes("350"),"Development UI must display the updated Forte token price");
assert(selectedMarkup.includes("MANCANO 1 GETTONI"));
const index=fs.readFileSync("index.html","utf8");
assert(index.includes("rtg-economy.js?v=20261012-moderate-development-1"),"Mobile must fetch updated economy pricing");
console.log("rtg-shop-development-balance-test: PASS");
