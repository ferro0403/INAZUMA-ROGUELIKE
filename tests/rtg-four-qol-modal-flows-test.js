"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const load=(path,c)=>vm.runInNewContext(fs.readFileSync(path,"utf8"),c,{filename:path});
// Real vending controller: simulate result -> details -> result -> vending.
for(const seasonId of ["ie1_s3","orion"]){
 let modeLog=[],screen="",options={},detailOnClose=null,listeners={};
 const control=(selector)=>({addEventListener:(event,fn)=>{listeners[selector+":"+event]=fn;}});
 const root={querySelector(selector){
  if(selector==="[data-rtg-vending-machine]"||selector==="[data-rtg-vending-album]")return null;
  if(["[data-rtg-pull-player-detail]","[data-rtg-pull-continue]","[data-rtg-pull]"].includes(selector))return control(selector);
  return null;
 },querySelectorAll:()=>[]};
 const c={console};c.globalThis=c;load("js/road-to-glory/rtg-vending-controller.js",c);
 const runtime=c.RoadToGloryVendingController.create({
  getCampaign:()=>({tokens:1200}),getSeasonDb:()=>({seasonId}),activeSeasonId:()=>seasonId,
  activeConfig:()=>({pullCost:300,recruitmentPullCost:150}),
  gacha:{previewPool:(_st,_db,_ids,mode)=>{modeLog.push(mode);return {candidates:[],rarities:[]};}},
  accessibleCards:()=>[],getModalRoot:()=>root,
  openModal:(markup,opts)=>{options=opts;screen=opts.className;listeners={};},
  runView:{vendingMarkup:()=>"<vending>",pullResultMarkup:()=>"<result>"},
  openPlayerDetails:(_id,_side,opts)=>{detailOnClose=opts.onClose;},
  id:String
 });
 runtime.openVending("recruitment");
 assert.strictEqual(modeLog.at(-1),"recruitment",seasonId+" starts on 150-token pool");
 const card={name:"Orion recruit",playerId:"orion::123"};
 runtime.showPullResult({playerId:card.playerId,rarity:"Normale"},card,"recruitment");
 assert(screen.includes("rtg-pull-modal"),"result modal shown");
 const resultHandler=listeners["[data-rtg-pull-player-detail]:click"];
 assert.strictEqual(typeof resultHandler,"function");
 resultHandler({currentTarget:{dataset:{rtgPullPlayerDetail:card.playerId}}});
 assert.strictEqual(typeof detailOnClose,"function");
 detailOnClose();
 assert(screen.includes("rtg-pull-modal"),"closing details returns to result");
 options.onClose();
 assert(screen.includes("rtg-vending-modal"),"closing result returns to vending");
 assert.strictEqual(modeLog.at(-1),"recruitment",seasonId+" must retain svincolati on return");
 runtime.showPullResult({playerId:card.playerId},card,"team");
 options.onClose();
 assert.strictEqual(modeLog.at(-1),"team","boss-mode extraction keeps boss-mode");
}
console.log("RTG QoL vending: 150-token mode persists through player details for IE3 and Orion PASS");

// Real squad controller and modal callbacks: X goes back to the same filtered picker.
{
 const seasons=["ie1","orion"],target="orion::target",byron1="ie1::byron",byronOR="orion::byron";
 const players={};
 for(const id of [target,byron1,byronOR]){
  const isTarget=id===target,seasonId=id.split("::")[0];
  players[id]={playerId:id,cardId:id,name:isTarget?"Target":"Byron Love",overall:isTarget?90:seasonId==="orion"?94:91,
   category:"Leggenda",normalizedRole:"MF",position:"MF",teamId:"team",teamIds:["team"],teamName:"Team",resolvedTeamId:"team"};
 }
 const db={teams:[{teamId:"team",teamName:"Team"}],players:[]};
 const c={console,SeasonRegistry:{database:()=>db,team:()=>db.teams[0],get:id=>({name:id}),activeId:()=>"orion",setActive:()=>{}}};
 c.globalThis=c;load("js/road-to-glory/rtg-squad-controller.js",c);
 let modalMode="",modalOptions={},history=[],htmlModel=null,resultCards=[],squadRenderCount=0;
 const hooks={};
 const elm=selector=>({
   dataset:selector==="[data-rtg-picker-player]"?{rtgPickerPlayer:byronOR}:selector==="[data-rtg-version-card]"?{rtgVersionCard:byron1}:{},
   addEventListener:(type,fn)=>{hooks[modalMode+":"+selector+":"+type]=fn;},
   setAttribute:(key,val)=>{hooks["attr:"+key]=val;},
   querySelector:sel=>sel==="[data-rtg-picker-sort-arrow]"?arrow:null,
 });
 const arrow={textContent:"↓"};
 const modal={scrollTop:0,scrollLeft:0,isConnected:true};
 const results={innerHTML:""};
 const root={
  querySelector(selector){
   if(selector===".modal")return modal;
   if(selector==="[data-rtg-picker-results]")return results;
   if(selector==="[data-rtg-picker-team]")return{innerHTML:""};
   if(["[data-rtg-picker-sort]","[data-rtg-picker-search]","[data-rtg-picker-season]","[data-rtg-picker-rarity]","[data-rtg-picker-sort-arrow]"].includes(selector))return elm(selector);
   return null;
  },
  querySelectorAll(selector){
   if(selector==="[data-rtg-picker-player]"&&modalMode==="picker")return[elm(selector)];
   if(selector==="[data-rtg-version-card]"&&modalMode==="version")return[elm(selector)];
   return[];
  }
 };
 const id=v=>String(v??"");
 const meta=v=>({cardId:id(v),playerId:id(v).split("::")[1],canonicalPlayerId:id(v).split("::")[1],legacySeasonId:id(v).split("::")[0],sourceKind:"season"});
 const squad={formationId:"4-3-3",lineup:[],bench:[target],activeRoleVariantByCardId:{}};
 const deps={
   id,clone:x=>JSON.parse(JSON.stringify(x)),campaign:{activeSeasonId:"orion",squads:{orion:squad}},
   squadDraft:squad,activeSeasonId:()=>"orion",activeSquad:()=>squad,
   accessibleCards:()=>[target,byron1,byronOR],config:{SEASON_IDS:seasons},
   cardIdentity:{versionGroupKey:cardId=>"season::"+meta(cardId).canonicalPlayerId},
   cardMeta:meta,rawPlayer:v=>players[id(v)],resolved:v=>players[id(v)],
   rawRole:v=>players[id(v)]?.normalizedRole||"",rawOverall:v=>players[id(v)]?.overall||0,
   rawName:v=>players[id(v)]?.name||"",sourceForDraftPlayer:()=>"RTG",
   playerResolver:{rarity:()=>"Leggenda"},freeAgentsDb:{players:[]},
   squadView:{
    replacementPickerMarkup:m=>{htmlModel=m;return "<picker>";},
    replacementPickerResultsMarkup:({entries})=>{resultCards=entries.map(e=>e.playerId);return "<results>";},
    filterOptionsMarkup:()=>"options",
    versionPickerMarkup:()=>"<versions>",
    renderModel:()=>({}),markup:()=>"<squad>",bind:()=>{}
   },
   openModal:(_markup,opts)=>{
    modalMode=opts.className.includes("version")?"version":"picker";
    modalOptions=opts;history.push(modalMode);modal.scrollTop=0;modal.scrollLeft=0;
   },
   getModalRoot:()=>root,
   closeModal:({invokeOnClose=true}={})=>{
    const handler=modalOptions.onClose;modalMode="";modalOptions={};
    if(invokeOnClose&&handler)handler();
   },
   renderHtml:()=>{squadRenderCount++;},bindHomeAndTabs:()=>{},mountDevQuickTools:()=>{},
   playerResolverForState:()=>({}),squadRuntime:{teamPower:()=>90},getUserTeamMeta:()=>({}),
 };
 const controller=c.RoadToGlorySquadController.create(deps);
 controller.openSquadPlayerPicker(target);
 assert.strictEqual(modalMode,"picker");
 assert.strictEqual(resultCards.length,1,"two Byron versions are shown as a single player");
 hooks['picker:[data-rtg-picker-search]:input']({target:{value:"Byron"}});
 hooks['picker:[data-rtg-picker-sort]:click']({currentTarget:elm("[data-rtg-picker-sort]")});
 assert.strictEqual(arrow.textContent,"↑");
 modal.scrollTop=147;modal.scrollLeft=3;
 hooks['picker:[data-rtg-picker-player]:click']();
 assert.strictEqual(modalMode,"version");
 const onClose=modalOptions.onClose;
 assert.strictEqual(typeof onClose,"function");
 // Real close is triggered by the X button.
 deps.closeModal();
 assert.strictEqual(modalMode,"picker","X must reopen the replacement list");
 assert.strictEqual(htmlModel.query,"Byron","reopen keeps search query");
 assert.strictEqual(arrow.textContent,"↑","reopen keeps ascending sorting");
 assert.strictEqual(modal.scrollTop,147,"reopen restores scroll");
 assert.strictEqual(modal.scrollLeft,3,"reopen restores horizontal scroll");
 assert.strictEqual(resultCards.length,1);
 // Choosing a version must NOT trigger its X/cancel callback.
 hooks['picker:[data-rtg-picker-player]:click']();
 assert.strictEqual(modalMode,"version");
 hooks['version:[data-rtg-version-card]:click']();
 assert.notStrictEqual(modalMode,"picker","selecting a version must not reopen the selection list");
 assert.strictEqual(deps.squadDraft.bench[0],byron1);
 assert.strictEqual(squadRenderCount,1);
 assert.deepStrictEqual(history,["picker","version","picker","version"]);
}
console.log("RTG QoL version picker: X restores query, sort, scroll; selection swaps without back navigation PASS");
