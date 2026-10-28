"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const load = file => JSON.parse(fs.readFileSync(file,"utf8"));
const data = [
  load("data/rtg-halloween-occult-players.json"),
  load("data/rtg-halloween-occult-lineup.json"),
  load("data/rtg-halloween-occult-moves.json"),
];
const freeAgents = {players:Array.from({length:16},(_,i)=>({
  playerId:"halloween-free-"+i,name:"Free "+i,position:i===0?"GK":i<=4?"DF":i<=9?"MF":"FW",
  overall:70,category:"Forte",stats:{attack:70,control:70,speed:70,defense:70,save:70}
}))};
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const records = {"shared:account":{tokens:83,gachaAcquiredCards:[],developmentByCardId:{},coachOwnedIds:[]}};
const storage = {
  async readMany(keys) { return Object.fromEntries(keys.map(k=>[k,clone(records[k])])); },
  async read(k) { return clone(records[k]); },
  async updateMany(keys,callback) {
    const before = await this.readMany(keys);
    const mutation = callback(before);
    if (mutation?.then) throw Error("A gameplay transaction must not await");
    for (const [k,v] of Object.entries(mutation.writes||{})) records[k]=clone(v);
    for (const k of mutation.deletes||[]) delete records[k];
    return mutation.value;
  }
};
function createApp() {
  return {
    innerHTML:"", controls:{},
    querySelector(q) { return this.querySelectorAll(q)[0]||null; },
    querySelectorAll(q) {
      const attribute=q.match(/^\[([\w-]+)\]$/)?.[1];
      if (!attribute) return [];
      const re=new RegExp(attribute+'(?:="([^"]*)")?',"g");
      const matches=[];let found;
      while ((found=re.exec(this.innerHTML))) {
        const element={
          dataset:{},disabled:false,callbacks:{},closest:()=>null,textContent:"",
          addEventListener(event,callback) {this.callbacks[event]=callback;},
          async fire(event="click",value) {
            return this.callbacks[event]?.({
              target:{value},currentTarget:this,stopPropagation(){},preventDefault(){}
            });
          }
        };
        element.dataset[attribute.replace(/^data-/,"").replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=found[1]||"";
        matches.push(element);
      }
      this.controls[attribute]=matches;
      return matches;
    }
  };
}
const app=createApp();
let nextId=0;
const context={
  console,Date,
  crypto:{randomUUID:()=>String(++nextId),getRandomValues:a=>(a[0]=1,a)},
  setInterval:()=>null,clearInterval:()=>{},
  fetch:async url=>({
    ok:true,
    json:async()=>url.includes("occult-players")?data[0]:
      url.includes("occult-lineup")?data[1]:
      url.includes("occult-moves")?data[2]:freeAgents
  }),
  SeasonRegistry:{activeId:()=>"ie1",loadDatabase:async()=>({}),setActive(){}},
  RoadToGloryPersistence:{assertWritable(){}},
  PersistenceRecoveryGuard:{assertWritable(){}},
  RoadToGloryStorage:{create:()=>storage},
  RoadToGloryCardIdentity:{
    cardIdForFreeAgent:id=>"free_agents::"+id,
    record:({playerId,legacySeasonId})=>({cardId:legacySeasonId+"::"+playerId,playerId,legacySeasonId})
  },
  RoadToGloryPlayerResolver:{
    resolveOwnedAtLevel20(cardId,_season,_role,db){
      const p=db.players.find(x=>cardId==="free_agents::"+x.playerId);
      return p?{...p,cardId,finalOverall:p.overall,normalizedRole:p.position}:null;
    }
  },
  RtgFourMovesRuntime:{ready:Promise.resolve(true)},
  RoadToGloryMatchEngine:{
    createMatch(options){return {...clone(options),status:"active",score:{user:0,opponent:0},result:null};},
    prepareNext(state){return {...clone(state),status:"completed",result:{winner:"user"}};},
    abandon(state){return {...clone(state),status:"abandoned",result:{winner:"opponent"}};}
  },
  RoadToGloryRng:{int:()=>0}
};
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-cloud-snapshot.js","utf8"),context);
const E=context.RoadToGloryHalloween;
function control(attr,predicate=()=>true) {
  return (app.controls[attr]||[]).find(x=>predicate(x.dataset));
}
async function main() {
  const assets=await E.prepare();
  assert.equal(assets.players.size,18);
  assert.equal(assets.setup.startingXI.length,11);
  assert.equal(Object.keys(assets.moves.players).length,18);
  for(const p of assets.players.values())assert.equal(assets.moves.players[String(p.playerId)].moves.length,4);
  assert.equal(E.opponentOverall(),86);
  assert.equal(E.opponentOverall()+1,87);
  assert.equal(assets.players.size - [...assets.players.keys()].filter(pid=>E.eventPlayer(pid).halloweenVampire).length,2);
  assert.equal(E.eventPlayer("custom_0001").halloweenVampire,false);
  assert.equal(E.eventPlayer("custom_0002").halloweenVampire,false);
  assert.equal(E.EVENT_END_MS,Date.UTC(2026,10,4,22,59,59));
  assert.equal(E.weightedPick(["custom_0002","custom_0001"],0),"custom_0002");
  assert.throws(()=>E.eventState({pumpkins:-1,ownedIds:[],completedIds:[],pullCount:0,luckyWins:0}),/halloween-invalid-account/);
  const controller=E.create({app,storage,toast:()=>{}});
  await controller.open();
  assert.match(app.innerHTML,/OCCULT HALLOWEEN/);
  assert.match(app.innerHTML,/data-halloween-countdown/);
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  for(let index=0;index<15;index++){
    const chosen=new Set([...(records["local:halloween2026:squad"]?.lineup||[]),...(records["local:halloween2026:squad"]?.bench||[])]);
    const item=control("data-halloween-pick",d=>!chosen.has(d.halloweenPick));
    assert.ok(item,"Missing available squad player at "+index);
    await item.fire();
  }
  assert.equal(records["local:halloween2026:squad"].lineup.length,11);
  assert.equal(records["local:halloween2026:squad"].bench.length,4);
  await control("data-halloween-tab",d=>d.halloweenTab==="match").fire();
  assert.ok(control("data-halloween-start"));
  await control("data-halloween-start").fire();
  assert.equal(records["local:halloween2026:match"].status,"active");
  assert.match(app.innerHTML,/rtg-live-pitch/,"Event must use original RTG 11v11 pitch");
  await control("data-halloween-next").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,600,"10%-lucky victory grants 600 total");
  assert.equal(records["shared:account"].halloween.completedIds.length,1);
  await controller.open();
  assert.equal(records["shared:account"].halloween.pumpkins,600,"Reload must not duplicate a reward");
  await control("data-halloween-close-result").fire();
  await control("data-halloween-tab",d=>d.halloweenTab==="vending").fire();
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,400);
  assert.equal(records["shared:account"].halloween.ownedIds.length,1);
  assert.equal(records["shared:account"].gachaAcquiredCards.length,1);
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,200);
  assert.equal(records["shared:account"].halloween.ownedIds.length,2);
  assert.equal(new Set(records["shared:account"].halloween.ownedIds).size,2,"No duplicate players");
  assert.equal(records["shared:account"].tokens,83,"Regular RTG tokens must not be changed");
  await control("data-halloween-tab",d=>d.halloweenTab==="match").fire();
  context.RoadToGloryMatchEngine.prepareNext = state => ({
    ...clone(state),status:"completed",result:{winner:"opponent"}
  });
  await control("data-halloween-start").fire();
  await control("data-halloween-next").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,500,"Defeat must award 300, never 600");
  assert.equal(records["shared:account"].halloween.completedIds.length,2);

  const snapshot=context.RoadToGloryCloudSnapshot.project({
    trilogy:null,aresOrion:null,shared:records["shared:account"],album:{version:1,cardIds:[]}
  });
  assert.equal(context.RoadToGloryCloudSnapshot.validate(snapshot).shared.halloween.pumpkins,500);
  const legacy=context.RoadToGloryCloudSnapshot.project({
    trilogy:null,aresOrion:null,
    shared:{tokens:83,gachaAcquiredCards:[],developmentByCardId:{},coachOwnedIds:[]}
  });
  assert.ok(!Object.prototype.hasOwnProperty.call(context.RoadToGloryCloudSnapshot.validate(legacy).shared,"halloween"));
  console.log("RTG Halloween: 18 players / 72 moves, OVR+1, 11v11 pitch, 16 vampire filters, countdown, squad, idempotent 600/300 prizes, no duplicate pulls, 200 cost, old-cloud compatibility PASS");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
