"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

const freeAgentsDb={players:[{
  playerId:"fa1",
  name:"Free One",
  category:"Normale",
  position:"FW",
  normalizedRole:"FW",
  finalOverall:70,
  finalStats:{attack:70,control:65,speed:65,grit:60,physical:55,stamina:60,defense:30,save:1},
}]};
const developmentState={players:{
  fa1:{legacyNormale:null,steps:[{
    stepId:"evo-mondiale",
    rarity:"Mondiale",
    toPotential:90,
    profile:{category:"Mondiale"},
  }]},
}};

const context={
  globalThis:null,Object,Array,String,Number,JSON,Map,Set,Math,
  SeasonRegistry:{normalizeSeasonId:value=>String(value),database:()=>null,player:()=>null},
  ProfiledSeasonRuntime:{canonicalPlayerId:(_sid,pid)=>String(pid)},
  DevelopmentAccountV3:{read:()=>developmentState},
  DevelopmentRuntime:{
    resolveAccountPlayer(base,level,_database,{state}){
      const active=state.players[String(base.playerId)]?.steps?.at(-1);
      return active?{
        ...base,
        level,
        overall:90,
        finalOverall:90,
        potential:90,
        category:active.rarity,
        stats:{...base.finalStats},
      }:null;
    },
  },
  InazumaProgression:{getPlayerAtLevel:(player,level)=>({...player,level,overall:player.finalOverall,stats:player.finalStats})},
  MatchMoveRuntime:{moveForPlayer:()=>null},
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-card-identity.js","utf8"),context,{filename:"rtg-card-identity.js"});
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-player-resolver.js","utf8"),context,{filename:"rtg-player-resolver.js"});

const C=context.RoadToGloryCardIdentity;
const R=context.RoadToGloryPlayerResolver;
const cardId=C.cardIdForFreeAgent("fa1");

const standard=R.resolveStandardAtLevel20(cardId,"ie1",null,freeAgentsDb);
assert.strictEqual(standard.category,"Mondiale","RTG standard free-agent baseline must include permanent Run Development Center rarity");
assert.strictEqual(standard.overall,90,"RTG standard free-agent baseline must include permanent developed overall");
assert.strictEqual(standard.developmentApplied,true);
assert.strictEqual(standard.cardId,cardId);

const resolved=R.resolveAtLevel20(cardId,"ie1",null,freeAgentsDb);
assert.strictEqual(resolved.category,"Mondiale");
assert.strictEqual(resolved.overall,90);

const owned=R.resolveOwnedAtLevel20(cardId,"ie1",null,freeAgentsDb,{});
assert.strictEqual(owned.category,"Mondiale","normal RTG squad resolution must not fall back to the immutable Normale free-agent base");
assert.strictEqual(owned.overall,90);

const staleLocal=R.resolveOwnedAtLevel20(cardId,"ie1",null,freeAgentsDb,{
  [cardId]:{targetPotential:99,currentRarity:"Aurico"},
});
assert.strictEqual(staleLocal.category,"Mondiale","stale RTG-local free-agent development must not overwrite permanent Development Center state");
assert.strictEqual(staleLocal.overall,90);

assert.strictEqual(R.rarity(cardId,"ie1",freeAgentsDb),"Mondiale","RTG rarity filters must see the permanent evolved rarity");

console.log("rtg-bbe-permanent-free-agent-development-test: PASS");
