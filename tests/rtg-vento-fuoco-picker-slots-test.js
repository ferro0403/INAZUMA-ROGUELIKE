"use strict";
// Vento-Fuoco DEV: owned event players must survive squad-slot changes and
// remain selectable from the native Cambio picker, also when on the bench.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8");
const a=src.indexOf("    function openPicker(cardId) {");
const b=src.indexOf("    function openFormation() {",a);
assert.ok(a>0&&b>a,"production Vento-Fuoco picker must exist");
const body=src.slice(a,b);
const TARGET="free_agents::target";
const eventIds=Array.from({length:18},(_,i)=>"vento_fuoco_dev::vf"+String(i).padStart(2,"0"));
const halloweenId="halloween2026::special_01";
const owned=[TARGET,...eventIds,halloweenId,"ie1::normal"];
const players=Object.fromEntries(owned.map((id,index)=>[id,{
  cardId:id,playerId:id.split("::")[1],name:"Player "+String(index),
  overall:95-index/2,normalizedRole:"MF",position:"MF",category:"Mondiale",
  teamId:id.startsWith("vento_fuoco_dev::")?"fire-team":"neutral",
  teamName:id.startsWith("vento_fuoco_dev::")?"Fire team":"Altri"
}]));
const calls=[];
const nodes=new Map();
function node(selector){
  if(!nodes.has(selector))nodes.set(selector,{
    innerHTML:"",dataset:{},events:{},classList:{toggle(){}},setAttribute(){},
    addEventListener(kind,listener){this.events[kind]=listener;},
    querySelectorAll(){return[];},
    fire(kind){assert.ok(this.events[kind],"Missing event "+kind+" on "+selector);return this.events[kind]({target:this,currentTarget:this});}
  });
  return nodes.get(selector);
}
const root={querySelector:node,querySelectorAll:()=>[]};
let openCount=0,html="";
const view={
  replacementPickerMarkup:args=>{
    calls.push({kind:"initial",...args});
    return '<section class="rtg-squad-picker"><div data-rtg-picker-results></div></section>';
  },
  replacementPickerResultsMarkup:args=>{
    calls.push({kind:"results",...args});
    return '<div class="rtg-picker-grid"></div>';
  },
  filterOptionsMarkup:()=>"<option>Tutte</option>",
};
const scope={
  Object,Array,Map,Set,Number,String,Math,JSON,Promise,Error,console,
  EVENT_ID:"vento_fuoco_dev",TEAM_VENDING:true,match:null,
  busy:false,squadEditPending:false,actionPending:false,
  localSquad:null,userCards:()=>owned,
  resolveCard:id=>players[id]||null,
  pickerTeamLabels:p=>[p.teamName],
  sourceLabel:id=>id==="vento_fuoco_dev"?"Vento-Fuoco":id,
  asId:value=>String(value??""),
  deps:{squadView:view,openModal:markup=>{openCount++;html=markup;}},
  modalRoot:()=>root,perform:async op=>op(),editSquad:async()=>{},
  notify(){},fail:code=>new Error(code)
};
scope.globalThis=scope;
vm.createContext(scope);
vm.runInContext(body+"\nthis.openPicker=openPicker;",scope);
const slots=[
  {lineup:[TARGET,"ie1::normal"],bench:[eventIds[0],eventIds[1]]},
  {lineup:[TARGET,eventIds[0]],bench:[eventIds[2],eventIds[3]]},
  {lineup:[TARGET,halloweenId],bench:[eventIds[0],eventIds[4]]}
];
for(const [slotIndex,slot] of slots.entries()){
  scope.localSquad=slot;
  scope.openPicker(TARGET);
  const first=calls.filter(x=>x.kind==="initial").at(-1);
  assert.equal(first.total,owned.length-1,"slot "+(slotIndex+1)+" full pool includes bench and all owned cards");
  for(const id of eventIds){
    assert.ok(first.entries.some(entry=>entry.cardId===id)||first.total>first.entries.length,
      "normal picker may paginate but must retain every event card in pool");
  }
  const quick=new Set(first.quickEntries.map(e=>e.cardId));
  const notCurrent=calls.filter(x=>x.kind==="initial").length;
  assert.ok(quick.has(slot.bench[0]),"slot "+(slotIndex+1)+" quick bench present");
  assert.match(html,/data-vf-picker-event-only/,"event-only shortcut present");
  node("[data-vf-picker-event-only]").fire("click");
  const filtered=calls.filter(x=>x.kind==="results").at(-1);
  assert.equal(filtered.total,eventIds.length,
    "slot "+(slotIndex+1)+" event-only result has ALL owned event players, no truncation");
  assert.deepEqual(filtered.entries.map(x=>x.cardId).sort(),[...eventIds].sort(),
    "all owned Fire/Ice cards available in every saved squad slot");
  assert.equal(filtered.visibleCount,12,"event-only bypasses first 12 without changing normal pagination");
  node("[data-vf-picker-event-only]").fire("click");
  assert.equal(calls.filter(x=>x.kind==="results").at(-1).total,owned.length-1,
    "returning to normal list restores the full owned pool");
}
assert.equal(openCount,slots.length,"one native Cambio modal per slot; no extra modals");
console.log("rtg-vento-fuoco-picker-slots-test: PASS (bench/main parity, 18 event players across 3 slots, event-only unpaginated, normal list restored)");
