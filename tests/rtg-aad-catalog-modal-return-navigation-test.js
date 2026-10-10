"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,console};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8"),context,{filename:"rtg-squad-controller.js"});

const cards=["ie1::axel","orion::axel","orion::bruce"];
const player=cardId=>({
  cardId,playerId:cardId,name:cardId.endsWith("axel")?"Axel Blaze":"Bruce",
  overall:cardId==="orion::axel"?97:cardId==="ie1::axel"?93:85,
  normalizedRole:"FW",position:"FW",category:"Forte",teamId:"raimon",
});
let releaseSeason;
const delayedSeason=new Promise(resolve=>{releaseSeason=resolve;});
const loaded=new Map([["ie1",{teams:[{teamId:"raimon",name:"Raimon"}]}]]);
context.SeasonRegistry={
  database:id=>loaded.get(id)||null,
  activeId:()=>"orion",
  setActive:()=>{},
  team:()=>({teamName:"Raimon"}),
  loadDatabase:async id=>{await delayedSeason;loaded.set(id,{teams:[{teamId:"raimon",name:"Raimon"}]});return loaded.get(id);}
};
const callbacks=[],opened=[],details=[],models={entries:[],versions:[]};
let modal=null,underlying="SQUAD";
const element=(dataset={})=>({
  dataset,listeners:{},value:"",innerHTML:"",scrollTop:0,scrollLeft:0,
  addEventListener(name,fn){this.listeners[name]=fn;},
  fire(name,value){if(value!==undefined)this.value=value;const f=this.listeners[name];assert(f,"missing "+name+" listener");return f({target:this,currentTarget:this});}
});
const root={
  querySelector(selector){
    if(!modal)return null;
    if(selector===".rtg-player-catalog-modal")return modal.kind==="catalog"?modal:null;
    if(selector===".rtg-version-picker-modal")return modal.kind==="version"?modal:null;
    if(selector===".modal")return modal;
    if(selector==="[data-rtg-catalog-results]")return modal.kind==="catalog"?modal.results:null;
    if(modal.kind!=="catalog")return null;
    if(!modal.elements[selector])modal.elements[selector]=element();
    return modal.elements[selector];
  },
  querySelectorAll(selector){
    if(!modal)return[];
    if(selector==="[data-rtg-catalog-player]"&&modal.kind==="catalog"){
      modal.cards=models.entries.map(entry=>element({rtgCatalogPlayer:entry.cardId}));
      return modal.cards;
    }
    if(selector==="[data-rtg-version-card]"&&modal.kind==="version"){
      modal.versions=models.versions.map(entry=>element({rtgVersionCard:entry.cardId}));
      return modal.versions;
    }
    return[];
  }
};
function closeModal({invokeOnClose=true}={}){
  if(!modal)return;
  const old=modal;
  modal=null;old.isConnected=false;
  if(invokeOnClose)old.onClose?.();
}
function openModal(html,options={}){
  closeModal({invokeOnClose:false});
  const kind=options.className?.includes("rtg-player-catalog-modal")?"catalog":
    options.className?.includes("rtg-version-picker-modal")?"version":"detail";
  modal={kind,onClose:options.onClose,isConnected:true,scrollTop:0,scrollLeft:0,elements:{},results:element()};
  opened.push(kind);
}
const deps={
  id:String,config:{SEASON_IDS:["ie1","orion"]},activeSeasonId:()=>"orion",
  acquiredCardIdSet:()=>new Set(cards),
  cardIdentity:{versionGroupKey:cardId=>String(cardId).split("::")[1]},
  cardMeta:cardId=>({cardId,legacySeasonId:String(cardId).split("::")[0],playerId:String(cardId).split("::")[1]}),
  rawRole:()=> "FW",rawOverall:cardId=>player(cardId).overall,rawName:cardId=>player(cardId).name,
  rawPlayer:player,resolved:player,squadDraft:{activeRoleVariantByCardId:{}},
  getModalRoot:()=>root,openModal,closeModal,
  openRtgPlayerDetails:(cardId,_side,options={})=>{
    details.push({cardId,onClose:options.onClose});
    openModal("DETAIL",{className:"player-detail-modal",onClose:options.onClose});
  },
  squadView:{
    catalogMarkup:options=>{models.entries=options.entries;models.lastCatalog=options;return "CATALOG";},
    catalogResultsMarkup:options=>{models.entries=options.entries;return "RESULTS";},
    versionPickerMarkup:options=>{models.versions=options.entries;return "VERSION";},
    filterOptionsMarkup:(options,value)=>options.map(x=>x.value===value?"selected "+x.value:x.value).join(","),
  },
  toast:message=>callbacks.push(message)
};
const controller=context.RoadToGlorySquadController.create(deps);
const catalog=controller.openRtgCatalog();
assert.strictEqual(modal?.kind,"catalog","button must open catalog synchronously while other Seasons load");
assert.strictEqual(catalog.count,2,"both versions are grouped into one card");
const search=root.querySelector("[data-rtg-catalog-search]");
search.fire("input","Axel");
const season=root.querySelector("[data-rtg-catalog-season]");
assert.strictEqual(models.entries.length,1);
modal.scrollTop=350;modal.scrollLeft=5;
const clickCatalog=id=>{
  const button=modal?.cards?.find(btn=>btn.dataset.rtgCatalogPlayer===id);
  assert(button,"missing catalog card "+id);button.fire("click");
};
const clickVersion=id=>{
  const button=modal?.versions?.find(btn=>btn.dataset.rtgVersionCard===id);
  assert(button,"missing version "+id);button.fire("click");
};
clickCatalog("orion::axel");
assert.strictEqual(modal?.kind,"version","multi-version card must open version picker");
closeModal();
assert.strictEqual(modal?.kind,"catalog","closing version picker must return to catalog");
assert.strictEqual(root.querySelector("[data-rtg-catalog-search]").value,"","mock inputs do not auto-populate; markup receives stored query");
assert.strictEqual(models.lastCatalog.query,"Axel");
assert.strictEqual(modal.scrollTop,350);
assert.strictEqual(modal.scrollLeft,5);

clickCatalog("orion::axel");
clickVersion("ie1::axel");
assert.strictEqual(modal?.kind,"detail","choosing a version must open its detail card");
assert.strictEqual(details.at(-1).cardId,"ie1::axel");
closeModal();
assert.strictEqual(modal?.kind,"catalog","closing a chosen version detail must reopen catalog");
assert.strictEqual(models.lastCatalog.query,"Axel");
assert.strictEqual(modal.scrollTop,350);

root.querySelector("[data-rtg-catalog-search]").fire("input","");
clickCatalog("orion::bruce");
assert.strictEqual(modal?.kind,"detail","single-version card must directly open details");
closeModal();
assert.strictEqual(modal?.kind,"catalog","closing single-version detail must reopen catalog");

clickCatalog("orion::axel");
assert.strictEqual(modal?.kind,"version");
releaseSeason();
(async()=>{
  await delayedSeason;
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.strictEqual(modal?.kind,"version","delayed filter preload must not replace nested version picker");
  closeModal();
  assert.strictEqual(modal?.kind,"catalog");
  closeModal();
  assert.strictEqual(modal,null,"closing catalog itself must return to underlying squad");
  assert.strictEqual(underlying,"SQUAD");
  assert.deepStrictEqual(opened.slice(0,6),["catalog","version","catalog","version","detail","catalog"]);
  console.log("rtg-aad-catalog-modal-return-navigation-test: immediate open, chooser/back, details/back, filter preload, scroll PASS");
})().catch(err=>{console.error(err);process.exitCode=1;});
