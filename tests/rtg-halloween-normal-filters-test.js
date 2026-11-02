"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const css=fs.readFileSync("css/rtg-halloween-event.css","utf8");
const cardFilter=css.match(/\.halloween-squad-mode \[data-rtg-squad-player\^="halloween2026::"\][\s\S]*?\.player-portrait\{/);
assert.ok(cardFilter,"Existing Halloween card portrait filter present");
assert.match(cardFilter[0],/data-rtg-squad-player="halloween2026::custom_0001"/);
assert.match(cardFilter[0],/data-rtg-squad-player="halloween2026::custom_0002"/);
assert.match(cardFilter[0],/data-rtg-squad-player="halloween2026::custom_0003"/);
assert.match(cardFilter[0],/data-rtg-album-player-entry="halloween2026::custom_0003"/);
assert.match(css,/\.player-detail-visual\.halloween-vampiro \.player-fullbody/,"Fullbody filter remains independent");
const bonus=fs.readFileSync("js/road-to-glory/rtg-halloween-completion-reward.js","utf8");
assert.match(bonus,/halloweenVampire:false/,"Shawn's fullbody must remain normal");

const ID="halloween2026",OCCULT=ID+"::occult-2";
const cards=["ie1::normal",ID+"::38",ID+"::custom_0003"];
const target="free_agents::target";
const parse=cardId=>{
 const [season,playerId]=cardId.split("::");
 return {cardId,legacySeasonId:season,playerId,canonicalPlayerId:playerId};
};
const players=Object.fromEntries([target,...cards].map((cardId,index)=>[cardId,{
 cardId,playerId:parse(cardId).playerId,
 name:cardId,overall:80+index,normalizedRole:"FW",position:"FW",category:"Leggenda",
 teamId:cardId.startsWith(ID+"::")?"occult-2":"other",teamName:cardId.startsWith(ID+"::")?"Occult Halloween":"Other"
}]));
let loaded=[];
const registry={
 activeId:()=>"ie1",setActive(){},
 database:seasonId=>{
   if(seasonId===ID)throw Error("Halloween is not a regular RTG season database");
   return {teams:[{teamId:"other",teamName:"Other"}]};
 },
 loadDatabase:async seasonId=>{loaded.push(seasonId);throw Error("Unexpected season loading: "+seasonId);},
 team:()=>null
};
const ctx={Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError,console,SeasonRegistry:registry};
ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8"),ctx);
const buttons=new Map();
function node(selector){
 if(!buttons.has(selector))buttons.set(selector,{
   innerHTML:"",dataset:{},events:{},classList:{toggle(){}},setAttribute(){},
   addEventListener(name,fn){this.events[name]=fn;},
   fire(name,value){assert.ok(this.events[name],selector+" has no "+name+" handler");this.events[name]({target:{value},currentTarget:this});},
   querySelector(){return null;}
 });
 return buttons.get(selector);
}
const root={querySelector:node,querySelectorAll:()=>[]};
const picked=[];
const catalogs=[];
const squad={formationId:"4-3-3",lineup:[],bench:[target],activeRoleVariantByCardId:{},lineupOrderedBySlot:true};
const campaign={activeSeasonId:"ie1",squads:{ie1:squad},gachaAcquiredCards:cards.map(cardId=>({cardId}))};
const controller=ctx.RoadToGlorySquadController.create({
 id:String,clone:x=>JSON.parse(JSON.stringify(x)),campaign,squadDraft:squad,
 activeSeasonId:()=>"ie1",activeSquad:()=>squad,config:{SEASON_IDS:["ie1","ie1_s2","ie1_s3","ie2","orion"]},
 accessibleCards:()=>[target,...cards],acquiredCardIdSet:()=>new Set(cards),
 cardMeta:parse,cardIdentity:{versionGroupKey:id=>id},
 resolved:id=>players[id],rawPlayer:id=>players[id],
 rawSummary:id=>({overall:players[id].overall,name:id,role:"FW"}),
 rawOverall:id=>players[id].overall,rawName:id=>id,rawRole:()=>"FW",
 sourceForDraftPlayer:id=>cards.includes(id)?"RTG":"Svincolato",
 freeAgentsDb:{players:[]},playerResolver:{rarity:()=>"Leggenda"},
 squadView:{
   replacementPickerMarkup:args=>{picked.push({type:"initial",...args});return"<picker/>";},
   replacementPickerResultsMarkup:args=>{picked.push({type:"results",...args});return"<results/>";},
   catalogMarkup:args=>{catalogs.push({type:"initial",...args});return"<catalog/>";},
   catalogResultsMarkup:args=>{catalogs.push({type:"results",...args});return"<catalog-results/>";},
   filterOptionsMarkup:options=>options.map(o=>o.value).join("|")
 },
 getModalRoot:()=>root,openModal:()=>{},closeModal:()=>{},toast:()=>{},
 activeConfig:()=>({}),seasonDb:{}
});
const checkOptions=(args,where)=>{
 assert.ok(args.seasonOptions.some(o=>o.value===ID&&o.label==="Halloween"),where+" lacks Halloween season");
 assert.ok(args.teamOptions.some(o=>o.value===OCCULT&&o.label==="Occult Halloween"),where+" lacks Occult Halloween team");
};
controller.openSquadPlayerPicker(target);
checkOptions(picked.find(x=>x.type==="initial"),"Squad replacement");
assert.equal(picked.at(-1).total,3);
node("[data-rtg-picker-season]").fire("change",ID);
assert.equal(picked.at(-1).total,2,"Picker Halloween source has only acquired Halloween cards");
assert.deepEqual(Array.from(picked.at(-1).entries,e=>e.cardId).sort(),cards.filter(x=>x.startsWith(ID+"::")).sort());
assert.match(node("[data-rtg-picker-team]").innerHTML,/halloween2026::occult-2/);
node("[data-rtg-picker-team]").fire("change",OCCULT);
assert.equal(picked.at(-1).total,2,"Picker combines Halloween season + Occult team");
node("[data-rtg-picker-season]").fire("change","ie1");
assert.equal(picked.at(-1).total,1,"Existing Season 1 filtering must remain intact");
controller.openRtgCatalog();
checkOptions(catalogs.find(x=>x.type==="initial"),"RTG player catalog");
node("[data-rtg-catalog-season]").fire("change",ID);
assert.equal(catalogs.at(-1).total,2,"RTG catalog Halloween filter");
assert.match(node("[data-rtg-catalog-team]").innerHTML,/halloween2026::occult-2/);
node("[data-rtg-catalog-team]").fire("change",OCCULT);
assert.equal(catalogs.at(-1).total,2,"RTG catalog Occult team filter");
node("[data-rtg-catalog-season]").fire("change","ie1");
assert.equal(catalogs.at(-1).total,1,"Catalog original season filter preserved");
assert.deepEqual(loaded,[],"No phantom SeasonRegistry loading for Halloween");
console.log("Halloween portrait exception and normal RTG picker/catalog Season+team filters: PASS");
