"use strict";
// Regressione sul picker nativo Vento-Fuoco: ogni carta posseduta, anche
// gia' schierata, in panchina o nello slot scelto, rimane tra i candidati.
// Le prime 12 sono visibili subito; MOSTRA ALTRI carica le restanti.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8");
const a=src.indexOf("    function openPicker(cardId) {");
const b=src.indexOf("    function openFormation() {",a);
assert.ok(a>0&&b>a,"production native picker exists");
const body=src.slice(a,b);
const FREE="free_agents::target",HALLOWEEN="halloween2026::special_01";
const eventIds=Array.from({length:18},(_,i)=>"vento_fuoco_dev::vf"+String(i).padStart(2,"0"));
const owned=[FREE,...eventIds,HALLOWEEN,"ie1::normal"];
const players=Object.fromEntries(owned.map((id,index)=>[id,{
  cardId:id,playerId:id.split("::")[1],name:"Player "+index,
  overall:95-index/2,normalizedRole:"MF",position:"MF",category:"Mondiale",
  teamId:id.startsWith("vento_fuoco_dev::")?"fire-team":"other",
  teamName:id.startsWith("vento_fuoco_dev::")?"Fire team":"Altri"
}]));
const calls=[],nodes=new Map();
function node(selector){
  if(!nodes.has(selector))nodes.set(selector,{
    innerHTML:"",dataset:{},events:{},classList:{toggle(){}},setAttribute(){},
    addEventListener(kind,callback){this.events[kind]=callback;},
    querySelectorAll(){return[];},
    fire(kind,value){if(value!==undefined)this.value=value;
      assert.ok(this.events[kind],"missing "+kind+" handler for "+selector);
      return this.events[kind]({target:this,currentTarget:this});}
  });
  return nodes.get(selector);
}
const root={querySelector:node,querySelectorAll:()=>[]};
let opens=0,markup="";
const view={
  replacementPickerMarkup:args=>{
    calls.push({kind:"initial",...args});
    return '<section class="rtg-squad-picker"><div data-rtg-picker-results></div></section>';
  },
  replacementPickerResultsMarkup:args=>{
    calls.push({kind:"results",...args});
    return '<div class="rtg-picker-grid"></div>';
  },
  filterOptionsMarkup:()=>"<option>Tutte</option>"
};
const scope={
  Object,Array,Map,Set,Number,String,Math,JSON,Promise,Error,console,
  EVENT_ID:"vento_fuoco_dev",TEAM_VENDING:true,match:null,
  manifest:{labels:{source:"Evento Vento e Fuoco"}},
  busy:false,squadEditPending:false,actionPending:false,localSquad:null,
  userCards:()=>owned,resolveCard:id=>players[id]||null,
  pickerTeamLabels:p=>[p.teamName],
  sourceLabel:id=>id==="vento_fuoco_dev"?"Vento-Fuoco":id,
  asId:value=>String(value??""),
  deps:{squadView:view,openModal:content=>{opens++;markup=content;}},
  modalRoot:()=>root,perform:async op=>op(),editSquad:async()=>{},
  notify(){},fail:code=>new Error(code)
};
scope.globalThis=scope;
vm.createContext(scope);
vm.runInContext(body+"\nthis.openPicker=openPicker;",scope);
assert.doesNotMatch(body,/eventOnly|data-vf-picker-event-only|vf-picker-event-filter/,
  "no unsolicited Vento-Fuoco filter/button in the production picker");
assert.match(body,/const all=userCards\(\)\.map\(id=>\{/,
  "the current card must not be excluded from all owned cards");
// Atomic substitution logic, including swaps with occupied positions, stays intact.
assert.match(src,/if\(curr\[area\]\.includes\(arg\.to\)\)/);
assert.match(src,/if\(!allowed\.has\(arg\.to\)\|\|arg\.to===arg\.from\)return;/);
const cases=[
  {target:eventIds[0],lineup:[eventIds[0],eventIds[1],FREE],bench:[eventIds[2],HALLOWEEN]},
  {target:eventIds[2],lineup:[eventIds[2],eventIds[3],FREE],bench:[eventIds[0],eventIds[5]]},
  {target:HALLOWEEN,lineup:[HALLOWEEN,eventIds[4],FREE],bench:[eventIds[0],eventIds[8]]}
];
for(const [slotIndex,item] of cases.entries()){
  scope.localSquad={lineup:item.lineup,bench:item.bench};
  scope.openPicker(item.target);
  const first=calls.filter(c=>c.kind==="initial").at(-1);
  assert.equal(first.total,owned.length,"slot "+(slotIndex+1)+" includes every owned card");
  assert.equal(first.entries.length,12,"native progressive picker starts with 12 cards");
  assert.ok(first.quickEntries.some(e=>e.cardId===item.bench[0]),"quick bench still exists");
  assert.doesNotMatch(markup,/data-vf-picker-event-only|GIOCATORI VENTO/,
    "no unsolicited event-only button");
  node("[data-rtg-picker-load-more]").fire("click");
  const entire=calls.filter(c=>c.kind==="results").at(-1);
  assert.equal(entire.total,owned.length);
  assert.deepEqual(Array.from(entire.entries,e=>e.cardId).sort(),[...owned].sort(),
    "slot "+(slotIndex+1)+" lists current card, occupied XI, bench and Halloween");
  assert.ok(entire.entries.some(e=>e.cardId===item.target),"same card is selectable");
  for(const id of [...item.lineup,...item.bench])
    assert.ok(entire.entries.some(e=>e.cardId===id),"occupied card is selectable: "+id);
  node("[data-rtg-picker-season]").fire("change","vento_fuoco_dev");
  const firstEvent=calls.filter(c=>c.kind==="results").at(-1);
  assert.equal(firstEvent.total,eventIds.length,"all owned event cards remain available");
  node("[data-rtg-picker-load-more]").fire("click");
  const allEvent=calls.filter(c=>c.kind==="results").at(-1);
  assert.deepEqual(Array.from(allEvent.entries,e=>e.cardId).sort(),[...eventIds].sort(),
    "slot "+(slotIndex+1)+" all event cards available through native Mostra altri");
  node("[data-rtg-picker-season]").fire("change","halloween2026");
  const halloween=calls.filter(c=>c.kind==="results").at(-1);
  assert.equal(halloween.total,1,"Halloween cards remain available in every slot");
  assert.equal(halloween.entries[0].cardId,HALLOWEEN);
}
assert.equal(opens,cases.length,"one native player picker per slot");
console.log("rtg-vento-fuoco-picker-slots-test: PASS (all owned cards including occupied XI/current/bench across 3 slots, native filters/pagination, no custom button)");
