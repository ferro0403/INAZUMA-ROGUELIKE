"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const ctx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};
ctx.globalThis=ctx;
const db={ie1:{teams:[{teamId:"raimon",name:"Raimon"}]},orion:{teams:[{teamId:"lunar",name:"Lunar"}]}};
ctx.SeasonRegistry={database:id=>db[id],team:(id,sid)=>db[sid]?.teams.find(team=>team.teamId===id)||null,activeId:()=>"ie1",get:id=>({name:id})};
vm.createContext(ctx);
for(const name of ["rtg-squad-view-base.js","rtg-squad-controller.js"])
  vm.runInContext(fs.readFileSync("js/road-to-glory/"+name,"utf8"),ctx);
const roles={"ie1::alex":"FW","orion::alex":"MF","ie1::bob":"DF","orion::mark":"GK","ie1::mia":"MF","ie1::target":"GK"};
const all=Object.keys(roles);
const meta=x=>({cardId:x,legacySeasonId:x.split("::")[0],playerId:x.split("::")[1],canonicalPlayerId:x.split("::")[1],sourceKind:"season"});
const player=x=>({cardId:x,playerId:meta(x).playerId,name:meta(x).playerId,normalizedRole:roles[x],position:roles[x],teamId:x.startsWith("orion")?"lunar":"raimon",overall:80,category:"Normale"});
const view=ctx.RoadToGlorySquadView.create({escapeHtml:String,compactPlayerCardMarkup:()=>'<button><img src="p.webp"></button>'});
for(const area of ["catalog","picker"]){
 const html=area==="catalog"?view.catalogMarkup({roleFilter:"MF"}):view.replacementPickerMarkup({roleFilter:"MF"});
 for(const role of ["all","FW","MF","DF","GK"])assert(html.includes('data-rtg-'+area+'-role="'+role+'"'),area+": missing "+role);
 assert(html.includes('data-rtg-'+area+'-role="MF" aria-pressed="true"'),"selected role is not restored");
}
assert.match(view.catalogResultsMarkup({entries:[{cardId:all[0],playerId:all[0],source:"RTG",player:player(all[0])}],total:1}),/loading="lazy" decoding="async"/);

const button=(dataset={})=>({
 dataset,events:{},classList:{toggle:()=>{}},
 addEventListener(type,fn){this.events[type]=fn;},
 setAttribute(){},querySelector(){return null;},
 fire(type,value){if(value!==undefined)this.value=value;assert(this.events[type],"unbound "+type);this.events[type]({target:this,currentTarget:this});}
});
const controlMap=new Map(),getControl=key=>{
 if(!controlMap.has(key))controlMap.set(key,button());
 return controlMap.get(key);
};
const roleControls={
 catalog:Object.fromEntries(["all","FW","MF","DF","GK"].map(x=>[x,button({rtgCatalogRole:x})])),
 picker:Object.fromEntries(["all","FW","MF","DF","GK"].map(x=>[x,button({rtgPickerRole:x})]))
};
const modal={
 querySelector(q){return q===".modal"||q===".rtg-player-catalog-modal"?this:getControl(q);},
 querySelectorAll(q){return q==="[data-rtg-catalog-role]"?Object.values(roleControls.catalog):q==="[data-rtg-picker-role]"?Object.values(roleControls.picker):[];}
};
const state={activeSeasonId:"ie1",squads:{ie1:{formationId:"4-3-3",lineup:[],bench:["ie1::target"],activeRoleVariantByCardId:{}}}};
let catalog=[],picker=[];
const controller=ctx.RoadToGlorySquadController.create({
 id:String,clone:v=>JSON.parse(JSON.stringify(v)),campaign:state,squadDraft:state.squads.ie1,
 activeSeasonId:()=>"ie1",activeSquad:()=>state.squads.ie1,
 accessibleCards:()=>all,acquiredCardIdSet:()=>new Set(all.filter(x=>x!=="ie1::target")),
 config:{SEASON_IDS:["ie1","orion"]},
 cardIdentity:{versionGroupKey:id=>"character::"+meta(id).canonicalPlayerId},
 cardMeta:meta,rawPlayer:player,resolved:player,
 rawRole:id=>roles[id],rawOverall:()=>80,rawName:id=>player(id).name,
 sourceForDraftPlayer:()=>"RTG",playerResolver:{rarity:()=>"Normale"},
 freeAgentsDb:{players:[]},getModalRoot:()=>modal,openModal:()=>{},
 squadView:{
   catalogMarkup:v=>{catalog=v.entries.map(x=>x.cardId);return "CATALOG";},
   catalogResultsMarkup:v=>{catalog=v.entries.map(x=>x.cardId);return "CATALOG_RESULTS";},
   replacementPickerMarkup:()=> "PICKER",
   replacementPickerResultsMarkup:v=>{picker=v.entries.map(x=>x.cardId);return "PICKER_RESULTS";},
   filterOptionsMarkup:()=>"",
 }
});
controller.openRtgCatalog();
assert.strictEqual(catalog.length,4,"one entry per character");
roleControls.catalog.FW.fire("click");
assert.deepStrictEqual(catalog,["ie1::alex"],"FW must match the FW version of Alex");
roleControls.catalog.MF.fire("click");
assert.deepStrictEqual(catalog.sort(),["orion::alex","ie1::mia"].sort(),"MF must match another version");
getControl("[data-rtg-catalog-season]").fire("change","orion");
assert.deepStrictEqual(catalog,["orion::alex"],"catalog combines role and season");
roleControls.catalog.GK.fire("click");
assert.deepStrictEqual(catalog,["orion::mark"],"GK season filter");
controller.openRtgCatalog({roleFilter:"DF"});
assert.deepStrictEqual(catalog,["ie1::bob"],"catalog restores role selection");

controller.openSquadPlayerPicker("ie1::target");
roleControls.picker.GK.fire("click");
assert.deepStrictEqual(picker,["orion::mark"],"picker GK");
roleControls.picker.FW.fire("click");
assert.deepStrictEqual(picker,["ie1::alex"],"picker FW independent of tactical slot");
roleControls.picker.MF.fire("click");
assert.deepStrictEqual(picker.sort(),["orion::alex","ie1::mia"].sort(),"picker MF group versions");
getControl("[data-rtg-picker-season]").fire("change","ie1");
assert.deepStrictEqual(picker,["ie1::mia"],"picker combines season and role");
controller.openSquadPlayerPicker("ie1::target",{roleFilter:"DF"});
assert.deepStrictEqual(picker,["ie1::bob"],"picker restores role selection");
console.log("rtg-role-filters-runtime-test: PASS");