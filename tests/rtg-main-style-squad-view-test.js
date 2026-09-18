"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const calls=[];
const compact=(player,opts={})=>{calls.push({id:player.playerId,opts});return `<button class="player-card player-card-compact squad-player-card ${opts.extraClass||""}" ${opts.dataAttr||""}><strong>${player.name}</strong>${opts.trailingMarkup||""}</button>`;};
const formationLayout={displayRows:()=>[
  {role:"FW",displayRole:"ATT",count:3},{role:"MF",displayRole:"CEN",count:3},{role:"DF",displayRole:"DIF",count:4},{role:"GK",displayRole:"POR",count:1},
]};
const resolver={resolveAtLevel20:(id)=>({playerId:id,name:id,overall:80,level:20,normalizedRole:id.startsWith("g")?"GK":id.startsWith("d")?"DF":id.startsWith("m")?"MF":"FW",position:id.startsWith("g")?"GK":id.startsWith("d")?"DF":id.startsWith("m")?"MF":"FW",category:"Buono"})};
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view.js","utf8"),c);
const view=c.RoadToGlorySquadView.create({escapeHtml:s=>String(s),playerResolver:resolver,compactPlayerCardMarkup:compact,formationLayout});
const lineup=["g1","d1","d2","d3","d4","m1","m2","m3","f1","f2","f3"],bench=["g2","d5","m4","f4"];
const state={activeSeasonId:"ie1",gachaAcquiredPlayerIds:["f9"],squads:{ie1:{formationId:"4-3-3",lineup,bench,activeRoleVariantByPlayerId:{}}}};
const seasonDb={formations:{eleven:[{id:"4-3-3",name:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}}]}};
const model=view.renderModel({state,freeAgentIds:[...lineup,...bench,...Array.from({length:1200},(_,i)=>"fpool"+i)],seasonDb,freeAgentsDb:{players:[]}});
const html=view.markup(model);
assert.match(html,/class="screen squad-screen rtg-squad-shell"/);
assert.match(html,/class="squad-field-panel"/);
assert.match(html,/class="pitch(?:\s|")/);
assert.doesNotMatch(html,/class="squad-module-card"/);
assert.match(html,/data-rtg-open-formation/);
assert.doesNotMatch(html,/Rosa RTG|Campo tattico|Gestione squadra/);
assert.strictEqual(calls.length,15);
assert.strictEqual((html.match(/data-area="lineup"/g)||[]).length,11);
assert.strictEqual((html.match(/data-area="bench"/g)||[]).length,4);
assert.match(html,/data-rtg-player-detail="d1"/);
assert.match(html,/data-rtg-change-player="d1"/);
assert.doesNotMatch(html,/Nessuna lista da 1500|Tocca un giocatore per aprire/i);
assert.doesNotMatch(html,/rtg-collection-card-grid/);
const freeBenchPicker=view.replacementPickerMarkup({
  target:{playerId:"d5",player:{name:"Difensore panchina"}},
  allowAnyRole:true,
  entries:[],
  total:0,
});
assert.match(freeBenchPicker,/qualsiasi ruolo/);
assert.match(freeBenchPicker,/TUTTI I RUOLI/);
assert.doesNotMatch(freeBenchPicker,/SOLO DF/);

const detailCard={dataset:{rtgPlayerDetail:"d1"},addEventListener(_type,fn){this.fn=fn;}};
const changeButton={dataset:{rtgChangePlayer:"d1"},addEventListener(_type,fn){this.fn=fn;}};
const root={querySelector:()=>null,querySelectorAll:sel=>sel.includes("data-rtg-player-detail")?[detailCard]:sel.includes("data-rtg-change-player")?[changeButton]:[]};
const opened=[],details=[];
view.bind(root,{onOpenPlayer:id=>opened.push(id),onOpenDetails:id=>details.push(id)});
detailCard.fn();
changeButton.fn({preventDefault(){},stopPropagation(){}});
assert.deepStrictEqual(details,["d1"]);
assert.deepStrictEqual(opened,["d1"]);
const css=fs.readFileSync("css/road-to-glory.css","utf8");
assert.match(css,/--rtg-picker-card-size:\s*74px/);
assert.match(css,/--rtg-picker-card-mobile:\s*64px/);
const themeCss=fs.readFileSync("css/rtg-theme.css","utf8");
assert(
  /\.rtg-squad-shell\s+\.squad-bench-list\s*>\s*\.rtg-squad-card-slot\s*\{[^}]*grid-template-rows\s*:\s*minmax\(0,1fr\)\s+32px\s*!important/s.test(themeCss),
  "RTG bench buttons must share one baseline under equal-height card slots"
);
assert(
  /\.rtg-squad-shell\s+\.squad-bench-list\s*>\s*\.rtg-squad-card-slot\s*>\s*\.rtg-squad-change-trigger\s*\{[^}]*align-self\s*:\s*end\s*!important/s.test(themeCss),
  "RTG bench Cambia buttons must stay pinned below their cards"
);
console.log("rtg-main-style-squad-view-test: PASS");