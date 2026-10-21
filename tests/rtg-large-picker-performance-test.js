"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};
c.globalThis=c;
c.SeasonRegistry={database:()=>({teams:[]}),team:()=>null,activeId:()=>"ie1"};
vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8"),c);
const target="ie1::target",ids=Array.from({length:960},(_,i)=>"ie1::p"+String(i).padStart(4,"0"));
const calls={summary:0,overall:0,name:0,role:0,resolved:0};
const ele=(dataset={})=>({dataset,handlers:{},classList:{toggle(){}},
  addEventListener(k,fn){this.handlers[k]=fn;},setAttribute(){},querySelector(){return null;},
  fire(k,v){if(v!==undefined)this.value=v;assert(this.handlers[k],"missing "+k);this.handlers[k]({target:this,currentTarget:this});}});
const nodes=new Map(),node=q=>{if(!nodes.has(q))nodes.set(q,ele());return nodes.get(q);};
const roleButtons={all:ele({rtgPickerRole:"all"}),GK:ele({rtgPickerRole:"GK"})};
const root={querySelector:q=>q===".modal"?root:node(q),
 querySelectorAll:q=>q==="[data-rtg-picker-role]"?Object.values(roleButtons):[]};
const roster={formationId:"4-3-3",lineup:[],bench:[target],activeRoleVariantByCardId:{}};
let total=-1,visible=[];
const ctrl=c.RoadToGlorySquadController.create({
 id:String,clone:x=>JSON.parse(JSON.stringify(x)),
 campaign:{activeSeasonId:"ie1",squads:{ie1:roster}},squadDraft:roster,
 activeSeasonId:()=>"ie1",activeSquad:()=>roster,accessibleCards:()=>[target,...ids],
 config:{SEASON_IDS:["ie1"]},freeAgentsDb:{players:[]},
 cardMeta:id=>({cardId:id,legacySeasonId:"ie1",canonicalPlayerId:id}),
 cardIdentity:{versionGroupKey:id=>id},
 rawSummary:id=>{calls.summary++;const k=Number(id.slice(-4));return{overall:40+k%55,name:id,role:k%4===0?"GK":"MF"};},
 rawOverall:id=>{calls.overall++;return 1;},rawName:id=>{calls.name++;return id;},rawRole:id=>{calls.role++;return "MF";},
 rawPlayer:()=>({category:"Normale"}),resolved:id=>{calls.resolved++;return{cardId:id,name:id,overall:70};},
 sourceForDraftPlayer:()=>"RTG",playerResolver:{rarity:()=>"Normale"},
 squadView:{replacementPickerMarkup:()=>"<picker/>",replacementPickerResultsMarkup:x=>{
  total=x.total;visible=x.entries.map(e=>e.playerId);return"<results/>";},filterOptionsMarkup:()=>""},
 getModalRoot:()=>root,openModal:()=>{},
});
ctrl.openSquadPlayerPicker(target);
assert.strictEqual(total,960);
assert.strictEqual(visible.length,12,"first page must contain 12 cards");
assert(calls.summary<=960,"one summary per candidate, not one per sort comparison");
assert.strictEqual(calls.overall,0,"summary must replace repeated overall resolution");
assert.strictEqual(calls.name,0,"summary must replace repeated name resolution");
assert.strictEqual(calls.role,0,"summary must replace repeated role resolution");
assert.strictEqual(calls.resolved,13,"only target and 12 displayed portraits should be fully resolved");
node("[data-rtg-picker-load-more]").fire("click");
assert.strictEqual(visible.length,24,"pagination must reveal another 12");
assert.strictEqual(calls.summary,960,"cached summaries must survive pagination");
roleButtons.GK.fire("click");
assert.strictEqual(total,240,"role filter must find all 240 GK from 960");
assert.strictEqual(visible.length,12);
node("[data-rtg-picker-search]").fire("input","p0000");
assert.strictEqual(total,1,"name and role filters must compose");
assert.deepStrictEqual(visible,["ie1::p0000"]);
console.log("rtg-large-picker-performance-test: PASS");
