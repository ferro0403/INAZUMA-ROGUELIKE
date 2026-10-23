"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
const keys=new Map();
keys.set("state",{
  campaignId:"rtg-ie-trilogy",
  activeSeasonId:"ie1",
  tokens:500,
  projects:{Aurico:1},
  gachaAcquiredCards:[{cardId:"ie2::4410"}],
  developmentByCardId:{
    "ie2::4410":{
      targetPotential:99,
      currentRarity:"Aurico",
      evolutionCount:6,
      updatedAt:"2026-10-03T00:00:00.000Z",
    },
  },
});
keys.set("state:rtg-ares-orion",{
  campaignId:"rtg-ares-orion",
  activeSeasonId:"ie2",
  tokens:500,
  projects:{Aurico:9},
  gachaAcquiredCards:[{cardId:"ie2::4410"}],
  developmentByCardId:{
    "ie2::4410":{
      targetPotential:89,
      currentRarity:"Elite",
      evolutionCount:1,
      updatedAt:"2026-10-02T00:00:00.000Z",
    },
  },
});
keys.set("shared:account",{
  tokens:500,
  gachaAcquiredCards:[{cardId:"ie2::4410"}],
});

const storage={
  async read(key="state"){return clone(keys.get(key)??null);},
  async write(value,key="state"){keys.set(key,clone(value));return clone(value);},
  async update(updater,key="state"){
    const current=clone(keys.get(key)??null);
    const next=updater(current);
    if(next&&typeof next.then==="function")throw new Error("async updater not supported");
    keys.set(key,clone(next));
    return clone(next);
  },
};
const stateApi={
  DEVELOPMENT_RARITIES:["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"],
  clone,
  validate:clone,
  createInitial:({campaignSeed,campaignId})=>({campaignSeed,campaignId,activeSeasonId:campaignId==="rtg-ares-orion"?"ie2":"ie1",tokens:0,gachaAcquiredCards:[],projects:{},developmentByCardId:{}}),
};

const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,TypeError,Error};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-repository.js","utf8"),context,{filename:"rtg-repository.js"});

(async()=>{
  const repository=context.RoadToGloryRepository.create({storage,stateApi,seedFactory:()=>"seed"});

  repository.selectCampaign("rtg-ares-orion");
  const ares=await repository.read();
  assert.strictEqual(ares.developmentByCardId["ie2::4410"].currentRarity,"Aurico","Ares-Orion must inherit the stronger Trilogy RTG development for the exact same card");
  assert.strictEqual(ares.developmentByCardId["ie2::4410"].targetPotential,99);
  assert.strictEqual(ares.projects.Aurico,9,"project inventory remains campaign-local");

  const migratedShared=keys.get("shared:account");
  assert.strictEqual(migratedShared.developmentByCardId["ie2::4410"].currentRarity,"Aurico","legacy shared account must migrate development from both campaign states");

  await repository.update("test-new-development",state=>{
    state.developmentByCardId["ie2::4500"]={
      targetPotential:90,
      currentRarity:"Mondiale",
      evolutionCount:2,
      updatedAt:"2026-10-03T01:00:00.000Z",
    };
    return state;
  });

  repository.selectCampaign("rtg-ie-trilogy");
  const trilogy=await repository.read();
  assert.strictEqual(trilogy.developmentByCardId["ie2::4410"].currentRarity,"Aurico");
  assert.strictEqual(trilogy.developmentByCardId["ie2::4500"].currentRarity,"Mondiale","new Ares-Orion RTG development must flow back to Trilogy");
  assert.strictEqual(trilogy.projects.Aurico,1,"sharing development must not merge unrelated campaign economy");

  console.log("rtg-bbf-cross-campaign-development-sync-test: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
