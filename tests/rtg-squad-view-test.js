"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
let calls=0;
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view.js","utf8"),c);
const resolver={resolveAtLevel20:(id)=>{calls++;return{playerId:id,name:id,overall:80,level:20,normalizedRole:id.startsWith("g")?"GK":id.startsWith("d")?"DF":id.startsWith("m")?"MF":"FW",category:"Buono",portraitUrl:""};}};
const view=c.RoadToGlorySquadView.create({escapeHtml:s=>String(s),playerResolver:resolver});
const lineup=["g1","d1","d2","d3","d4","m1","m2","m3","f1","f2","f3"],bench=["g2","d5","m4","f4"];
const free=[...lineup,...bench,"x1",...Array.from({length:1000},(_,i)=>"f"+(100+i))];
const state={activeSeasonId:"ie1",gachaAcquiredPlayerIds:["f9"],squads:{ie1:{formationId:"4-3-3",lineup,bench,activeRoleVariantByPlayerId:{m1:"MF"}}}};
const model=view.renderModel({state,freeAgentIds:free,seasonDb:{formations:{eleven:[{id:"4-3-3",formation:"4-3-3"}]}},freeAgentsDb:{players:[]}});
assert.strictEqual(model.lineup.length,11);assert.strictEqual(model.bench.length,4);
assert.strictEqual(calls,15);
assert.strictEqual(model.collection,undefined);
assert(model.availableCount>1000);
const html=view.markup(model);
assert.match(html,/>Run</);assert.match(html,/>Squadra</);assert.match(html,/data-rtg-formation-current/);
assert.strictEqual((html.match(/data-rtg-lineup-player=/g)||[]).length,11);
assert.strictEqual((html.match(/data-rtg-bench-player=/g)||[]).length,4);
assert.strictEqual((html.match(/data-rtg-squad-player=/g)||[]).length,15);
assert.doesNotMatch(html,/rtg-collection-card-grid|data-rtg-role-filter/);
assert.doesNotMatch(html,/Card: dettagli giocatore|Cambia: scegli un sostituto/);
const picker=view.replacementPickerMarkup({target:{playerId:"g1",player:{name:"GK One"}},role:"GK",entries:[],total:0,query:"",sourceFilter:"all",rarityFilter:"Elite",rarityOptions:["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]});
assert.match(picker,/data-rtg-picker-rarity/);
assert.match(picker,/>Rarità</);
assert.match(picker,/<option value="Elite" selected>Elite<\/option>/);
assert.match(picker,/<option value="Mondiale"/);
assert.match(picker,/<option value="Leggenda"/);
assert.match(picker,/<option value="Aurico"/);
const pickerWithCard=view.replacementPickerMarkup({
  target:{playerId:"g1",player:{name:"GK One"}},
  role:"GK",
  entries:[{playerId:"g9",source:"Svincolato",player:{playerId:"g9",name:"GK Nine",overall:84,normalizedRole:"GK",category:"Elite",portraitUrl:""}}],
  total:1,
  query:"",
  sourceFilter:"all",
  rarityFilter:"Elite",
  rarityOptions:["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]
});
assert.match(pickerWithCard,/squad-player-card/);
assert.match(pickerWithCard,/rtg-picker-squad-card/);
assert.doesNotMatch(pickerWithCard,/rtg-squad-player-card/);
assert.doesNotMatch(pickerWithCard,/rtg-picker-player-card/);
console.log("rtg-squad-view-test: PASS");