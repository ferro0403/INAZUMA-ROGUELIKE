const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root,"js/events/vento_fuoco_dev/miximax-rules.js"),"utf8"),sandbox);
const recipes=JSON.parse(fs.readFileSync(path.join(root,"data/events/dev/vento_fuoco_dev.json"),"utf8")).fusions.recipes;
const players=JSON.parse(fs.readFileSync(path.join(root,"data/events/vento_fuoco/miximax-players.json"),"utf8")).players;
const fire=JSON.parse(fs.readFileSync(path.join(root,"data/events/vento_fuoco/miximax-fire-moves.json"),"utf8")).players;
const wind=JSON.parse(fs.readFileSync(path.join(root,"data/events/vento_fuoco/miximax-wind-moves.json"),"utf8")).players;
assert.equal(players.length,2);for(const p of players){assert.equal(p.overall,96);assert.equal(p.roleSwitchEnabled,true);
 assert.equal(fire[p.playerId].moves.length,4);assert.equal(wind[p.playerId].moves.length,4);
 assert.ok(p.portraitUrl.startsWith("data:image/webp;base64,"));
 assert.equal(p.frontFullbodyUrl,"assets/events/vento-fuoco/"+p.name.toLowerCase()+"-fullbody.webp");
 assert.equal(p.fullbodyUrl,p.frontFullbodyUrl,"fullbody and portrait are separate assets");
 const binary=fs.readFileSync(path.join(root,p.frontFullbodyUrl));
 assert.equal(binary.toString("ascii",0,4),"RIFF");
 assert.equal(binary.toString("ascii",8,12),"WEBP");
 assert.ok(binary.length>50000,"fullbody render is high-resolution, not a thumbnail");
}
assert.equal(players.find(p=>p.name==="Chaos").variants.wind.position,"FW");
assert.equal(players.find(p=>p.name==="Shaiden").variants.wind.position,"DF");
for(const recipe of recipes){
 const original={events:{vento_fuoco_dev:{ownedIds:[...recipe.inputs],pullCount:0,luckyWins:0,completedIds:[],fireBadges:0,windBadges:0}},
  gachaAcquiredCards:recipe.inputs.map(i=>({cardId:"vento_fuoco_dev::"+i}))};
 const lineup=["vento_fuoco_dev::"+recipe.inputs[0],...Array.from({length:10},(_,i)=>"free_agents::"+i)];
 const bench=["vento_fuoco_dev::"+recipe.inputs[1],...Array.from({length:3},(_,i)=>"free_agents::"+(10+i))];
 const squad={lineup,bench,formationId:"4-3-3",lineupOrderedBySlot:true,activeRoleVariantByCardId:{},coachPowerSelection:{cardIds:["vento_fuoco_dev::"+recipe.inputs[0]]}};
 const allow=[...lineup,...bench,"free_agents::13","free_agents::14"];
 const call=account=>sandbox.VentoFuocoMiximax.apply({account,ledger:acc=>acc.events.vento_fuoco_dev,recipe,prefix:"vento_fuoco_dev::",
  squadRecord:{...squad,activeSquadSlot:2,slots:{"1":squad,"2":squad,"3":squad}},fallbackSquad:squad,allowedCardIds:allow,
  recordCard:id=>({cardId:"vento_fuoco_dev::"+id}),roleFor:()=> "FW",rolesForSlot:()=>Array(11).fill("FW")});
 const account=structuredClone(original),result=call(account);
 assert.ok(account.events.vento_fuoco_dev.ownedIds.includes(recipe.resultId));
 assert.ok(!account.events.vento_fuoco_dev.ownedIds.some(id=>recipe.inputs.includes(id)));
 assert.equal(account.gachaAcquiredCards.length,1);
 assert.equal(account.gachaAcquiredCards[0].cardId,result.resultId);
 for(const slot of Object.values(result.squad.slots)){const ids=[...slot.lineup,...slot.bench];
   assert.equal(ids.length,15);assert.equal(new Set(ids).size,15);assert.ok(ids.includes(result.resultId));
   assert.ok(!ids.some(id=>recipe.inputs.some(p=>id==="vento_fuoco_dev::"+p)));assert.equal(slot.coachPowerSelection,null);}
 assert.throws(()=>call(account),/miximax-parents-missing|miximax-already-owned/);
 const absent=structuredClone(original);absent.events.vento_fuoco_dev.ownedIds.pop();
 assert.throws(()=>call(absent),/miximax-parents-missing/);
 assert.deepEqual(absent.events.vento_fuoco_dev.ownedIds,[recipe.inputs[0]]);
 const shortage=structuredClone(original);
 assert.throws(()=>sandbox.VentoFuocoMiximax.apply({account:shortage,ledger:a=>a.events.vento_fuoco_dev,recipe,
  prefix:"vento_fuoco_dev::",squadRecord:squad,allowedCardIds:allow.filter(id=>!id.startsWith("free_agents::")),
  recordCard:id=>({cardId:"vento_fuoco_dev::"+id}),roleFor:()=> "FW"}),/miximax-squad-insufficient/);
 assert.deepEqual(shortage,original);
}
console.log("Miximax: dati, varianti, mosse, consumi e tre slot atomici OK");

/* Miximax screen consumes only the genuine native Squadra playerCard HTML. */
const manifest=JSON.parse(fs.readFileSync(path.join(root,"data/events/dev/vento_fuoco_dev.json"),"utf8"));
let hooks=null, nativeCalls=0, opened="";
const ui={GameEvents:{get:()=>manifest,extend:(id,extra)=>{
 assert.equal(id,"vento_fuoco_dev");hooks=extra;
}}};ui.globalThis=ui;
vm.runInNewContext(fs.readFileSync(path.join(root,"js/events/vento_fuoco_dev/home.js"),"utf8"),ui);
const fireClass=hooks.classes({playerId:"9900002",roleVariantId:"fire",element:"Fire"});
const windClass=hooks.classes({playerId:"9900002",roleVariantId:"wind",element:"Wind"});
assert.match(fireClass,/rtg-element-miximax--fire/);
assert.match(windClass,/rtg-element-miximax--wind/);
assert.doesNotMatch(fireClass,/miximax--wind/);
assert.doesNotMatch(windClass,/miximax--fire/);
const card=(pid,name)=>({playerId:String(pid),cardId:"vento_fuoco_dev::"+pid,name,position:"FW",overall:96});
const show=hooks.screens.miximax.render({
 fusionRecipes:()=>[
  {id:"shaiden",inputs:[{player:card(4539,"Aiden"),owned:true},{player:card(4538,"Shawn"),owned:true}],
   result:card(9900002,"Shaiden"),owned:false,available:true},
  {id:"chaos",inputs:[{player:card(1122,"Gazelle"),owned:false},{player:card(1105,"Torch"),owned:false}],
   result:card(9900001,"Chaos"),owned:false,available:false}
 ],
 fusionCard:p=>{nativeCalls++;return '<div class="rtg-squad-card-slot rtg-squad-card-slot--readonly">'+
  '<button type="button" class="player-card rtg-squad-player-card" data-rtg-squad-player="'+p.cardId+'">'+p.name+'</button></div>';}
});
assert.equal(nativeCalls,6,"both recipes display six real Squadra cards");
assert.equal((show.match(/class="player-card rtg-squad-player-card"/g)||[]).length,6);
assert.match(show,/class="vf-miximax-pair development-squad-card-scope rtg-squad-shell"/);
assert.match(show,/data-rtg-squad-player="vento_fuoco_dev::9900001"/);
assert.doesNotMatch(show,/vf-miximax-face|vf-miximax-result[^"]*">\s*<img/);
assert.match(show,/btn btn-yellow vf-miximax-fuse/);
assert.match(show,/data-vf-fuse-run="shaiden"/);
let cardClick=null;
hooks.screens.miximax.bind({querySelectorAll:selector=>
 selector===".vf-miximax-pair [data-rtg-squad-player]"?[{
 dataset:{rtgSquadPlayer:"vento_fuoco_dev::9900001"},
 addEventListener:(name,fn)=>{assert.equal(name,"click");cardClick=fn;}
 }]:[]},{openFusionPlayer:id=>{opened=id;}});
assert.ok(cardClick,"native card click is bound");
cardClick({stopPropagation(){}});
assert.equal(opened,"vento_fuoco_dev::9900001");
const runtime=fs.readFileSync(path.join(root,"js/road-to-glory/rtg-halloween-event.js"),"utf8");
assert.match(runtime,/fusionCard:p=>\{/);
assert.match(runtime,/deps\.squadView\.playerCard\(/);
assert.match(runtime,/readOnly:true,extraClass:"vf-miximax-native-squad-card"/);
const css=fs.readFileSync(path.join(root,"css/vento-fuoco-visual.css"),"utf8");
assert.match(css,/chaos-fullbody\.webp/);
assert.match(css,/shaiden-fullbody\.webp/);
assert.match(css,/height:69%!important/, "Nathan Halloween fullbody proportions");
assert.doesNotMatch(css,/\.vf-miximax-face\{/);
assert.match(css,/\.rtg-element-miximax--fire/);
assert.match(css,/\.rtg-element-miximax--wind/);
assert.match(css,/miximax-fire-right-hd\.webp/);
assert.match(css,/miximax-ice-right-hd\.webp/);
assert.match(css,/data-detail-rtg-role-switch/);
assert.match(css,/background:#df2e42!important/);
assert.match(css,/background:#1978d8!important/);
for(const image of ["miximax-fire-right-hd.webp","miximax-ice-right-hd.webp"]){
  const file=path.join(root,"assets/events/vento-fuoco",image);
  const webp=fs.readFileSync(file);
  assert.equal(webp.toString("ascii",0,4),"RIFF");
  assert.equal(webp.toString("ascii",8,12),"WEBP");
  assert.ok(webp.length>200000,"HD background should not be a low-resolution thumbnail");
}
assert.doesNotMatch(runtime,/originTeamId:"miximax"/);
assert.match(runtime,/const fusionRoster=/);
console.log("Miximax: due HD variant-dependent, VF rosso-blu e nessun terzo album OK");
