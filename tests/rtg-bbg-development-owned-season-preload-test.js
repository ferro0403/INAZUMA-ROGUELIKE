"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");

const seasonIds=["ie1","ie1_s2","ie1_s3","ie2","orion"];
const databases=Object.fromEntries(seasonIds.map((seasonId,index)=>[
  seasonId,
  {seasonId,players:[{playerId:String(index+1),name:`P-${seasonId}`,category:"Elite",overall:85+index,finalOverall:85+index}]},
]));
const loaded=new Map([["ie1",databases.ie1]]);
let active="ie1";
const loadCalls=[];

const context={
  globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,console,
  SeasonRegistry:{
    get:(seasonId)=>seasonIds.includes(String(seasonId))?{id:String(seasonId)}:{id:"ie1"},
    activeId:()=>active,
    setActive:(seasonId)=>{active=String(seasonId);},
    database:(seasonId)=>loaded.get(String(seasonId))||null,
    async loadDatabase(seasonId){
      const sid=String(seasonId);
      loadCalls.push(sid);
      const db=databases[sid];
      if(!db)throw new Error(`missing ${sid}`);
      loaded.set(sid,db);
      active=sid;
      return db;
    },
  },
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-development-controller.js","utf8"),context,{filename:"rtg-development-controller.js"});

const cards=seasonIds.map((seasonId,index)=>`${seasonId}::${index+1}`);
const state={gachaAcquiredCards:cards.map(cardId=>({cardId})),developmentByCardId:{}};
let renderedPlayers=[];

function resolved(cardId){
  const [seasonId,playerId]=String(cardId).split("::");
  const db=loaded.get(seasonId);
  const player=db?.players?.find(entry=>String(entry.playerId)===playerId);
  return player?{...player,cardId:String(cardId)}:null;
}

const app={
  querySelector(){return null;},
  querySelectorAll(){return[];},
};
const controller=context.RoadToGloryDevelopmentController.create({
  app,
  id:value=>String(value??""),
  getCampaign:()=>state,
  setCampaign:()=>{},
  getSquadDraft:()=>({activeRoleVariantByCardId:{}}),
  activeSquad:()=>({activeRoleVariantByCardId:{}}),
  economy:{
    ownedCardIds:()=>new Set(cards),
    isEligibleOwnedCard:()=>true,
  },
  economyView:{
    developmentMarkup:({players})=>{renderedPlayers=players;return"<development></development>";},
    playerGrid:()=>"",
  },
  resolved,
  resolvedStandard:resolved,
  resolvedWithDevelopment:resolved,
  renderRun:()=>{},
  renderHtml:()=>{},
  mountDevQuickTools:()=>{},
  openPlayerDetails:()=>{},
  renderHome:()=>{},
  toast:()=>{},
  repository:{update:async()=>state},
});

(async()=>{
  assert.strictEqual(loaded.size,1,"fixture must begin with only IE1 loaded");
  await controller.renderDevelopment("players");

  assert.deepStrictEqual(loadCalls,["ie1_s2","ie1_s3","ie2","orion"],"Development Center must load every missing owned-card source season itself");
  assert.strictEqual(active,"ie1","Development Center preload must restore the previously active SeasonRegistry season");
  assert.deepStrictEqual(
    renderedPlayers.map(player=>player.cardId).sort(),
    cards.slice().sort(),
    "all owned RTG cards, including Ares/Orion, must be visible on the first Development Center open"
  );

  const callsAfterFirstOpen=loadCalls.length;
  await controller.renderDevelopment("players");
  assert.strictEqual(loadCalls.length,callsAfterFirstOpen,"already loaded Development databases must not be fetched again");

  console.log("rtg-bbg-development-owned-season-preload-test: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
