"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const calls=[];
const compact=(player,opts={})=>{calls.push({id:player.playerId,opts});return `<button class="player-card player-card-compact squad-player-card ${opts.extraClass||""}" ${opts.dataAttr||""}><strong>${player.name}</strong>${opts.trailingMarkup||""}</button>`;};
const formationLayout={displayRows:formation=>[
  {role:"FW",displayRole:"ATT",count:3},
  {role:"MF",displayRole:"CEN",count:3},
  {role:"DF",displayRole:"DIF",count:4},
  {role:"GK",displayRole:"POR",count:1},
]};
const resolver={resolveAtLevel20:(id)=>({playerId:id,name:id,overall:80,level:20,normalizedRole:id.startsWith("g")?"GK":id.startsWith("d")?"DF":id.startsWith("m")?"MF":"FW",position:id.startsWith("g")?"GK":id.startsWith("d")?"DF":id.startsWith("m")?"MF":"FW",category:"Buono"})};
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view.js","utf8"),c);
const view=c.RoadToGlorySquadView.create({escapeHtml:s=>String(s),playerResolver:resolver,compactPlayerCardMarkup:compact,formationLayout});
const lineup=["g1","d1","d2","d3","d4","m1","m2","m3","f1","f2","f3"],bench=["g2","d5","m4","f4"];
const state={activeSeasonId:"ie1",gachaAcquiredPlayerIds:["f9"],squads:{ie1:{formationId:"4-3-3",lineup,bench,activeRoleVariantByPlayerId:{}}}};
const seasonDb={formations:{eleven:[{id:"4-3-3",name:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3},slotRoles:["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"]}]}};
const model=view.renderModel({state,freeAgentIds:[...lineup,...bench,"x1"],seasonDb,freeAgentsDb:{players:[]}});
const html=view.markup(model);
assert.match(html,/class="screen squad-screen rtg-squad-shell"/);
assert.match(html,/class="squad-field-panel"/);
assert.match(html,/class="pitch(?:\s|")/);
assert.match(html,/class="squad-module-card"/);
assert.match(html,/data-rtg-open-formation/);
assert.strictEqual(calls.some(x=>x.opts.extraClass.includes("squad-player-card")),true);
assert.strictEqual((html.match(/data-area="lineup"/g)||[]).length,11);
assert.strictEqual((html.match(/data-area="bench"/g)||[]).length,4);
assert.match(html,/SVINCOLATO|RTG/);
assert.doesNotMatch(html,/class="rtg-player-card"/);

const fakeCards=[
 {dataset:{rtgSquadPlayer:"d1",role:"DF",area:"lineup"},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this.fn=fn;}},
 {dataset:{rtgSquadPlayer:"g2",role:"GK",area:"bench"},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this.fn=fn;}},
 {dataset:{rtgSquadPlayer:"d5",role:"DF",area:"bench"},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this.fn=fn;}},
];
let swaps=[],incompatible=[];
const root={querySelector:()=>null,querySelectorAll:sel=>sel.includes("data-rtg-squad-player")?fakeCards:[]};
view.bind(root,{onSwap:(a,b)=>swaps.push([a,b]),onIncompatible:(a,b)=>incompatible.push([a,b])});
fakeCards[0].fn({currentTarget:fakeCards[0]});
fakeCards[1].fn({currentTarget:fakeCards[1]});
assert.deepStrictEqual(incompatible,[["d1","g2"]]);
assert.deepStrictEqual(swaps,[]);
fakeCards[2].fn({currentTarget:fakeCards[2]});
assert.deepStrictEqual(swaps,[["d1","d5"]]);
console.log("rtg-main-style-squad-view-test: PASS");
