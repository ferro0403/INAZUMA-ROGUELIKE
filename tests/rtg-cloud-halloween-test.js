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
      if(q.includes(","))return q.split(",").flatMap(part=>this.querySelectorAll(part.trim()));
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
  SeasonRegistry:{activeId:()=>"ie1",loadDatabase:async()=>({}),setActive(){},normalizeSeasonId:id=>["ie1","ie1_s2","ie1_s3","ie2","orion"].includes(id)?id:"ie1"},
  RoadToGloryPersistence:{assertWritable(){}},
  PersistenceRecoveryGuard:{assertWritable(){}},
  RoadToGloryStorage:{create:()=>storage},
  RoadToGloryPlayerResolver:{
    resolveOwnedAtLevel20(cardId,_season,_role,db){
      const p=db.players.find(x=>cardId==="free_agents::"+x.playerId);
      return p?{...p,cardId,finalOverall:p.overall,normalizedRole:p.position}:null;
    }
  },
  RtgFourMovesRuntime:{ready:Promise.resolve(true)},
  RoadToGloryMatchEngine:{
    createMatch(options){return {...clone(options),status:"active",score:{user:0,opponent:0},result:null};},
    prepareNext(state){return !state.__testPrepared?{...clone(state),status:"active",__testPrepared:true}:{...clone(state),status:"completed",result:{winner:"user"}};},
    abandon(state){return {...clone(state),status:"abandoned",result:{winner:"opponent"}};}
  },
  RoadToGloryRng:{int:()=>0}
};
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-card-identity.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-cloud-snapshot.js","utf8"),context);
const squadView={
  renderModel({state}){return {squad:state.squads.ie1,lineup:state.squads.ie1.lineup};},
  markup(model){
    return '<main class="screen squad-screen rtg-squad-shell"><header class="rtg-squad-topbar"><button data-rtg-home>BACK</button></header>'+
      '<div class="squad-field-panel"><section class="pitch rtg-squad-pitch-main">CANONICAL FORMATION</section></div>'+
      '<div class="rtg-squad-slots">SQUADRA 1 · SQUADRA 2 · SQUADRA 3</div>'+
      model.lineup.map(id=>'<button data-rtg-player-detail="'+id+'">CARD</button>').join('')+
      '<button data-rtg-change-player="'+model.lineup[0]+'">CAMBIA</button>'+
      '<button data-rtg-tab="run">RUN</button><button data-rtg-tab="squad">SQUADRA</button></main>';
  },
  bind(root,actions){
    root.querySelectorAll("[data-rtg-player-detail]").forEach(el=>el.addEventListener("click",()=>actions.onOpenDetails(el.dataset.rtgPlayerDetail)));
    root.querySelectorAll("[data-rtg-change-player]").forEach(el=>el.addEventListener("click",()=>actions.onOpenPlayer(el.dataset.rtgChangePlayer)));
  }
};
let nativeDetailOpened=false;
let nativeAlbumRendered=false;
const nativeRunView={albumRosterMarkup(){nativeAlbumRendered=true;return '<main class="album-roster-screen"><button data-rtg-album-back>BACK</button></main>';}};
const E=context.RoadToGloryHalloween;
function control(attr,predicate=()=>true) {
  return (app.controls[attr]||[]).find(x=>predicate(x.dataset));
}
async function main() {
  const identity=context.RoadToGloryCardIdentity.record({playerId:"45",legacySeasonId:"halloween2026"});
  assert.equal(identity.cardId,"halloween2026::45","SeasonRegistry must not alias event cards into Season 1");
  const assets=await E.prepare();
  assert.equal(E.eventPlayer("45").attack,80,"Combat uses 0-100 RTG stats, not raw 1-10 values");
  assert.equal(E.eventPlayer("45").stats.attack,80);
  assert.equal(E.eventPlayer("45").frontFullbodyUrl?.includes("_fullbody.webp"),true,
    "Existing canonical players must open their true fullbody art");
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
  const controller=E.create({app,storage,toast:()=>{},squadView,runView:nativeRunView,
    showPlayerDetailsFor:()=>{nativeDetailOpened=true;}});
  await controller.open();
  assert.match(app.innerHTML,/rtg-journey-summary/,"Homepage must reuse RTG run summary");
  assert.match(app.innerHTML,/rtg-map rtg-halloween-map/,"Cemetery is on RTG route map");
  assert.match(app.innerHTML,/data-halloween-countdown/);
  assert.match(app.innerHTML,/data-halloween-open-vending/,"Gacha is opened from Run home");
  assert.doesNotMatch(app.innerHTML,/data-halloween-tab="album"/);
  assert.doesNotMatch(app.innerHTML,/data-halloween-tab="vending"/);
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  assert.match(app.innerHTML,/rtg-squad-shell/,"Squad must use original RTG renderer");
  assert.match(app.innerHTML,/rtg-squad-pitch-main/);
  assert.match(app.innerHTML,/SQUADRA 1/);
  await control("data-rtg-player-detail").fire();
  assert.equal(nativeDetailOpened,true,"Player details must open original fullbody sheet");
  await control("data-rtg-tab",d=>d.rtgTab==="run").fire();
  assert.ok(control("data-halloween-start"));
  await control("data-halloween-start").fire();
  assert.equal(records["local:halloween2026:match"].status,"active");
  assert.match(app.innerHTML,/rtg-live-pitch/,"Event match must use RTG 11v11 pitch");
  await control("data-halloween-next").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,600);
  assert.equal(records["shared:account"].halloween.completedIds.length,1);
  await controller.open();
  assert.equal(records["shared:account"].halloween.pumpkins,600,"Reload must not duplicate reward");
  await control("data-halloween-close-result").fire();
  await control("data-halloween-open-vending").fire();
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,400);
  assert.equal(records["shared:account"].halloween.ownedIds.length,1);
  assert.equal(records["shared:account"].gachaAcquiredCards.length,1);
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,200);
  assert.equal(records["shared:account"].halloween.ownedIds.length,2);
  assert.equal(new Set(records["shared:account"].halloween.ownedIds).size,2);
  assert.equal(records["shared:account"].tokens,83,"Regular RTG tokens must not change");
  await controller.open();
  context.RoadToGloryMatchEngine.prepareNext=state=>!state.__testPrepared?{...clone(state),status:"active",__testPrepared:true}:({...clone(state),status:"completed",result:{winner:"opponent"}});
  await control("data-halloween-start").fire();
  await control("data-halloween-next").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,500,"Defeat must award 300");
  assert.equal(records["shared:account"].halloween.completedIds.length,2);
  await controller.open("album");
  assert.equal(nativeAlbumRendered,true,"Album uses native RTG roster component");
  const snapshot=context.RoadToGloryCloudSnapshot.project({
    trilogy:null,aresOrion:null,shared:records["shared:account"],album:{version:1,cardIds:[]}
  });
  assert.equal(context.RoadToGloryCloudSnapshot.validate(snapshot).shared.halloween.pumpkins,500);
  const legacy=context.RoadToGloryCloudSnapshot.project({
    trilogy:null,aresOrion:null,
    shared:{tokens:83,gachaAcquiredCards:[],developmentByCardId:{},coachOwnedIds:[]}
  });
  assert.ok(!Object.prototype.hasOwnProperty.call(context.RoadToGloryCloudSnapshot.validate(legacy).shared,"halloween"));
  console.log("RTG Halloween: 18 players / 72 moves, RTG run/squad/album/fullbody layout, 11v11 pitch, OVR+1, 16 vampire filters, countdown, idempotent 600/300 prizes, unique 200-pumpkin pulls, cloud compatibility PASS");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
