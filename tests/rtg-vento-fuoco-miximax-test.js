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
 assert.ok(p.portraitUrl.startsWith("data:image/webp;base64,"));assert.equal(p.frontFullbodyUrl,undefined);}
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
