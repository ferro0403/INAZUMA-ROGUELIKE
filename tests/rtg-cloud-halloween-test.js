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
// Regression: pre-existing slot 3 was saved with only 7 visible players.
records["local:halloween2026:squad"]={
  activeSquadSlot:3,
  slots:{"3":{
    formationId:"4-3-3",
    lineup:["free_agents::halloween-free-10","free_agents::halloween-free-11","free_agents::halloween-free-12",
      "free_agents::halloween-free-1","free_agents::halloween-free-2","free_agents::halloween-free-3","free_agents::halloween-free-0"],
    bench:["free_agents::halloween-free-13","free_agents::halloween-free-14",
      "free_agents::halloween-free-15","free_agents::halloween-free-4"],
    lineupOrderedBySlot:true
  }}
};
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
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coaches.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coach-powers-runtime.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coaches-view.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-encounter-runtime.js","utf8"),context);
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
      '<button data-rtg-adapt>ADATTA AI REQUISITI</button>'+
      '<button data-rtg-tab="run">RUN</button><button data-rtg-tab="squad">SQUADRA</button></main>';
  },
  bind(root,actions){
    root.querySelectorAll("[data-rtg-player-detail]").forEach(el=>el.addEventListener("click",()=>actions.onOpenDetails(el.dataset.rtgPlayerDetail)));
    root.querySelectorAll("[data-rtg-change-player]").forEach(el=>el.addEventListener("click",()=>actions.onOpenPlayer(el.dataset.rtgChangePlayer)));
    root.querySelectorAll("[data-rtg-adapt]").forEach(el=>el.addEventListener("click",actions.onAdaptRequirements));
  }
};
let nativeDetailOpened=false,albumDetail=null;
let nativeAlbumTeamsRendered=false,nativeAlbumRendered=false,nativeAlbumCatalog=[];
const nativeRunView={
  albumTeamsMarkup({teams}){
    nativeAlbumTeamsRendered=true;
    assert.equal(teams.length,1,"Halloween starts with one event team, not a direct roster");
    assert.equal(teams[0].teamName,"Occult Halloween");
    assert.equal(teams[0].total,18);
    return '<main class="album-teams-screen"><button data-rtg-album-collection-back>COLLEZIONI</button>'+
      teams.map(t=>'<button data-rtg-album-team="'+t.teamId+'">'+t.teamName+'</button>').join("")+'</main>';
  },
  albumRosterMarkup({entries,allEntries}){
    nativeAlbumRendered=true;nativeAlbumCatalog=allEntries;
    const unlocked=new Set(entries.map(p=>p.cardId));
    return '<main class="album-roster-screen"><button data-rtg-album-back>SQUADRE</button><div data-rtg-album-roster>'+
      allEntries.map(p=>'<div data-rtg-album-player-entry="'+p.cardId+'" data-album-unlocked="'+(unlocked.has(p.cardId)?"true":"false")+'">'+p.name+'</div>').join("")+
      '</div></main>';
  }
};
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
  const example=context.RoadToGloryEncounterRuntime.probability({
    actor:{overall:85,attack:85,control:85,grit:85,element:"Mountain"},
    opponent:E.eventPlayer("38"),actorKind:"shot",opponentKind:"save"
  });
  assert.ok(example.probability>5&&example.probability<95,
    "Comparable OVR 85 vs GK OVR 83 must not be stuck at 95% due to 1-10 opponent stats");
  assert.equal(E.eventPlayer("45").frontFullbodyUrl?.includes("_fullbody.webp"),true,
    "Existing canonical players must open their true fullbody art");
  assert.equal(assets.players.size,18);
  assert.equal(assets.setup.startingXI.length,11);
  assert.equal(Object.keys(assets.moves.players).length,18);
  for(const p of assets.players.values())assert.equal(assets.moves.players[String(p.playerId)].moves.length,4);
  assert.equal(E.opponentOverall(),86);
  assert.equal(E.opponentOverall()+1,87);
  assert.equal(E.PRICE,200,"Only the capsule cost changes; Halloween match rewards are unchanged");
  assert.equal(assets.players.size - [...assets.players.keys()].filter(pid=>E.eventPlayer(pid).halloweenVampire).length,2);
  assert.equal(E.eventPlayer("custom_0001").halloweenVampire,false);
  assert.equal(E.eventPlayer("custom_0002").halloweenVampire,false);
  assert.equal(E.EVENT_END_MS,Date.UTC(2026,10,4,22,59,59));
  assert.equal(E.weightedPick(["custom_0002","custom_0001"],0),"custom_0002");
  assert.throws(()=>E.eventState({pumpkins:-1,ownedIds:[],completedIds:[],pullCount:0,luckyWins:0}),/halloween-invalid-account/);
  const controller=E.create({app,storage,toast:()=>{},squadView,runView:nativeRunView,
    showPlayerDetailsFor:(p,options)=>{nativeDetailOpened=true;albumDetail={player:p,options};}});
  await controller.open();
  assert.match(app.innerHTML,/rtg-journey-summary/,"Homepage must reuse RTG run summary");
  assert.doesNotMatch(app.innerHTML,/rtg-map rtg-halloween-map/,"Cemetery is the whole RTG homepage background, not an extra content box");
  assert.match(app.innerHTML,/data-halloween-countdown/);
  assert.match(app.innerHTML,/data-halloween-open-vending/,"Gacha is opened from Run home");
  assert.match(app.innerHTML,/1 capsula · 200 zucche/,"The Halloween home shows the new 200-pumpkin price");
  assert.doesNotMatch(app.innerHTML,/data-halloween-tab="album"/);
  assert.doesNotMatch(app.innerHTML,/data-halloween-tab="vending"/);
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  assert.match(app.innerHTML,/rtg-squad-shell/,"Squad must use original RTG renderer");
  assert.match(app.innerHTML,/rtg-squad-pitch-main/);
  assert.match(app.innerHTML,/SQUADRA 1/);
  assert.equal((app.innerHTML.match(/data-rtg-player-detail=/g)||[]).length,11,
    "Existing 7-player slot must be completed to 11 without dropping selected players");
  // The adaptation button must avoid increasing an already compliant team.
  const before=clone(controller.getState().shared);
  await control("data-rtg-adapt").fire();
  assert.equal(JSON.stringify(controller.getState().shared),JSON.stringify(before),"Adapting a compliant team must be a no-op");
  // Simulate a high-OVR team and lower-OVR available substitutions, on a
  // real 11+4 saved roster; adaptation must meet the limit using the same roles.
  const active=controller.getState().match;
  assert.equal(active,null);
  const savedSlot=records["local:halloween2026:squad"].slots["3"]||
    {lineup:(app.innerHTML.match(/data-rtg-player-detail="([^"]+)"/g)||[]).map(x=>x.split('"')[1])};
  // The previous incomplete slot is already repaired in RAM; trigger a
  // temporary elevated test roster through the free-agent database.
  const actualLineup=(app.innerHTML.match(/data-rtg-player-detail="([^"]+)"/g)||[]).map(x=>x.split('"')[1]);
  assert.equal(actualLineup.length,11);
  assert.ok(records["local:halloween2026:squad"].slots["3"].lineup.every(id=>actualLineup.includes(id)),
    "Repair of an incomplete saved formation must retain every still-owned original starter");
  const selected=new Set(actualLineup);
  freeAgents.players.forEach(p=>{p.overall=selected.has("free_agents::"+p.playerId)?96:70;});
  await control("data-rtg-adapt").fire();
  const repaired=records["local:halloween2026:squad"];
  assert.equal(repaired.lineup.length,11,"Adapting must keep eleven starters");
  assert.equal(repaired.bench.length,4,"Adapting must keep four substitutes");
  assert.equal(new Set([...repaired.lineup,...repaired.bench]).size,15,"No duplicated cards after adapt");
  const average=repaired.lineup.reduce((sum,id)=>sum+freeAgents.players.find(p=>id==="free_agents::"+p.playerId).overall,0)/11;
  assert.ok(Math.round(average*10)/10<=87,"Adapt must respect Halloween OVR cap of 87");
  // If currently far below 87 OVR, the same Adapt button must actively
  // strengthen the eleven until as close to 87 as the card pool permits.
  const previouslySelected=new Set(repaired.lineup);
  freeAgents.players.forEach(p=>{p.overall=previouslySelected.has("free_agents::"+p.playerId)?75:97;});
  await control("data-rtg-adapt").fire();
  const boosted=records["local:halloween2026:squad"];
  const boostedOverall=boosted.lineup.reduce((sum,id)=>sum+freeAgents.players.find(p=>id==="free_agents::"+p.playerId).overall,0)/11;
  assert.ok(boostedOverall>75&&boostedOverall<=87,
    "Adapt must upgrade a weak 75-OVR team toward 87, not return without changes");
  assert.equal(new Set([...boosted.lineup,...boosted.bench]).size,15);
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
  assert.match(app.innerHTML,/1 CAPSULA/,"The capsule machine remains visible");
  assert.match(app.innerHTML,/<strong>200<\/strong>/,"The vending machine itself shows 200");
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,400,"The first capsule costs exactly 200 pumpkins");
  assert.equal(records["shared:account"].halloween.ownedIds.length,1);
  assert.equal(records["shared:account"].gachaAcquiredCards.length,1);
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,200,"The second capsule also costs exactly 200 pumpkins");
  assert.equal(records["shared:account"].halloween.ownedIds.length,2);
  assert.equal(new Set(records["shared:account"].halloween.ownedIds).size,2);
  assert.equal(records["shared:account"].tokens,83,"Regular RTG tokens must not change");
  await controller.open();
  context.RoadToGloryMatchEngine.prepareNext=state=>!state.__testPrepared?{...clone(state),status:"active",__testPrepared:true}:({...clone(state),status:"completed",result:{winner:"opponent"}});
  await control("data-halloween-start").fire();
  await control("data-halloween-next").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,500,"Defeat still awards 300, on top of the 200 left");
  assert.equal(records["shared:account"].halloween.completedIds.length,2);
  await controller.open("album");
  assert.equal(nativeAlbumTeamsRendered,true,"Event album starts with native RTG teams");
  assert.equal(nativeAlbumRendered,false,"The album must NOT skip the teams page");
  await control("data-rtg-album-team").fire();
  assert.equal(nativeAlbumRendered,true,"Opening Occult Halloween uses native RTG roster");
  assert.equal(nativeAlbumCatalog.length,18,"Locked players remain in the collection");
  const ownedIds=new Set(records["shared:account"].halloween.ownedIds);
  const lockedPlayer=nativeAlbumCatalog.find(p=>!ownedIds.has(p.playerId));
  assert.ok(lockedPlayer,"Collection must contain a locked player for inspection");
  const rosterControl=control("data-rtg-album-roster");
  assert.equal(typeof rosterControl?.callbacks?.click,"function","Roster cards must use event-specific delegated click handling");
  rosterControl.callbacks.click({
    target:{closest:selector=>selector==="[data-rtg-album-player-entry]"
      ?{dataset:{rtgAlbumPlayerEntry:lockedPlayer.cardId,albumUnlocked:"false"}}:null},
    preventDefault(){}
  });
  assert.equal(nativeDetailOpened,true,"Locked player details must open");
  assert.equal(albumDetail?.player?.cardId,lockedPlayer.cardId,"Use the exact locked Halloween card");
  assert.equal(albumDetail?.options?.mode,"album","Locked details use native album mode");
  assert.equal(albumDetail?.options?.albumUnlocked,false,"Inspecting must not unlock the card");
  await control("data-rtg-album-back").fire();
  assert.match(app.innerHTML,/album-teams-screen/,"Roster back returns to event teams");
  assert.equal(records["shared:account"].halloween.ownedIds.length,2,"Inspection must not change owned cards");
  const snapshot=context.RoadToGloryCloudSnapshot.project({
    trilogy:null,aresOrion:null,shared:records["shared:account"],album:{version:1,cardIds:[]}
  });
  assert.equal(context.RoadToGloryCloudSnapshot.validate(snapshot).shared.halloween.pumpkins,500);
  const legacy=context.RoadToGloryCloudSnapshot.project({
    trilogy:null,aresOrion:null,
    shared:{tokens:83,gachaAcquiredCards:[],developmentByCardId:{},coachOwnedIds:[]}
  });
  assert.ok(!Object.prototype.hasOwnProperty.call(context.RoadToGloryCloudSnapshot.validate(legacy).shared,"halloween"));
  // Real controller regression: a duel resolved at exactly 45' must be
  // shown BEFORE the native halftime editor. Acknowledging it must NOT
  // call prepareNext again (the boundary is already committed).
  const duelApp=createApp();
  const duelOverlay={innerHTML:""};
  let onDuelChoice=null,continueDuel=null,duelTimer=null,extraEngineSteps=0;
  const originalDuelQuery=duelApp.querySelector.bind(duelApp);
  duelApp.querySelector=selector=>{
    if(selector==="[data-rtg-match-overlay]")return duelOverlay;
    if(selector==="[data-rtg-duel-continue]"&&duelOverlay.innerHTML.includes("data-rtg-duel-continue"))
      return {addEventListener:(_type,callback)=>{continueDuel=callback;}};
    return originalDuelQuery(selector);
  };
  const duelView={
    preMatchMarkup:()=>'<main class="screen">PREMATCH</main>',
    matchMarkup:()=>'<main class="screen"><div data-rtg-match-overlay></div></main>',
    encounterMarkup:()=>'<div>CHOICE 45</div>',
    finalComparisonMarkup:()=>'<div>COMPARISON 45</div>',
    resolvedEncounterMarkup:()=>'<button data-rtg-duel-continue>RESULT 45</button>',
    halftimeMarkup:()=>'<div>INTERVALLO DOPO RISULTATO</div>',
    bind:(_root,actions)=>{onDuelChoice=actions.onEncounterChoice;}
  };
  const oldPrepare=context.RoadToGloryMatchEngine.prepareNext;
  const oldResolve=context.RoadToGloryMatchEngine.resolvePendingEncounter;
  const oldSetTimeout=context.setTimeout,oldClearTimeout=context.clearTimeout;
  context.RoadToGloryMatchEngine.prepareNext=()=>{extraEngineSteps++;throw Error("Boundary must not advance the match engine again");};
  context.RoadToGloryMatchEngine.resolvePendingEncounter=(state,_choice)=>({
    ...clone(state),status:"halftime",period:"halftime",pendingEncounter:null,
    log:[{encounterId:"enc-45",actorWon:true,probability:64,goalSide:null}]
  });
  context.setTimeout=callback=>{duelTimer=callback;return 1;};
  context.clearTimeout=()=>{duelTimer=null;};
  records["local:halloween2026:match"]={
    matchId:"boundary-45",status:"active",period:"first",score:{user:0,opponent:0},
    presentation:{preMatchSeen:true},userSquad:{lineup:[],bench:[]},opponentSquad:{name:"Occult Halloween",lineup:[]},
    pendingEncounter:{encounterId:"enc-45",userSide:"user",actorSide:"user",userKind:"defense",aiKind:"dribble",
      userPlayerId:"free_agents::halloween-free-1",aiPlayerId:"45",userBaseActionLabel:"Contrasto",aiChoice:"base",userMoveOptions:[]}
  };
  const duelController=E.create({app:duelApp,storage,matchView:duelView,squadView,runView:nativeRunView,toast:()=>{}});
  await duelController.open();
  assert.match(duelOverlay.innerHTML,/CHOICE 45/,"The 45-minute encounter must be selectable");
  await onDuelChoice("base",false);
  await onDuelChoice("base",true);
  assert.match(duelOverlay.innerHTML,/COMPARISON 45/,"45-minute duel comparison appears before halftime");
  assert.doesNotMatch(duelOverlay.innerHTML,/INTERVALLO/,"Halftime must not cover the duel");
  const reveal45=duelTimer;assert.equal(typeof reveal45,"function");
  reveal45();
  assert.match(duelOverlay.innerHTML,/RESULT 45/,"The 45-minute duel must show the winner");
  assert.equal(typeof continueDuel,"function");
  await continueDuel();
  assert.match(duelOverlay.innerHTML,/INTERVALLO DOPO RISULTATO/,"Halftime appears only after the player continues");
  assert.equal(extraEngineSteps,0,"Boundary continuation must not re-simulate the match");
  duelController.dispose();
  context.RoadToGloryMatchEngine.prepareNext=oldPrepare;
  context.RoadToGloryMatchEngine.resolvePendingEncounter=oldResolve;
  context.setTimeout=oldSetTimeout;
  context.clearTimeout=oldClearTimeout;
  delete records["local:halloween2026:match"];
  // A rare Halloween card must be selectable in EVERY squad slot, including
  // when it is already assigned to a different starter position. Previously
  // openPicker excluded the entire 15-card roster and Nathan vanished from
  // the replacement list in slot 1 while remaining visible in slot 2.
  const nathanId="halloween2026::custom_0001";
  const ownedRecord=context.RoadToGloryCardIdentity.record({playerId:"custom_0001",legacySeasonId:"halloween2026"});
  const owner=records["shared:account"];
  if(!owner.gachaAcquiredCards.some(card=>card.cardId===nathanId))owner.gachaAcquiredCards.push(ownedRecord);
  if(!owner.halloween.ownedIds.includes("custom_0001"))owner.halloween.ownedIds.push("custom_0001");
  const previousSlot=records["local:halloween2026:squad"];
  const template=clone(previousSlot.slots?.[previousSlot.activeSquadSlot]||previousSlot);
  const slot1=clone(template),slot2=clone(template);
  // Place Nathan on a different starter spot from the player we are swapping.
  slot1.lineup[1]=nathanId;
  slot1.lineupOrderedBySlot=false; // Legacy event saves predate the RTG tactical-slot contract.
  records["local:halloween2026:squad"]={activeSquadSlot:1,slots:{"1":slot1,"2":slot2}};
  const pickerModal=createApp();
  const pickerResults={innerHTML:"",buttons:[],querySelectorAll(selector){
    if(selector!=="[data-rtg-picker-player]")return [];
    const ids=[...this.innerHTML.matchAll(/data-rtg-picker-player="([^"]+)"/g)].map(match=>match[1]);
    this.buttons=ids.map(id=>({dataset:{rtgPickerPlayer:id},callbacks:{},
      addEventListener(name,handler){this.callbacks[name]=handler;},
      fire(){return this.callbacks.click?.();}
    }));
    return this.buttons;
  }};
  pickerModal.querySelector=selector=>selector==="[data-rtg-picker-results]"?pickerResults:null;
  let pickerQuick=[],quickButtons=[];
  pickerModal.querySelectorAll=selector=>{
    if(selector!==".rtg-picker-quick-bench [data-rtg-picker-player]")return [];
    quickButtons=pickerQuick.map(entry=>({dataset:{rtgPickerPlayer:entry.cardId},callbacks:{},
      addEventListener(name,handler){this.callbacks[name]=handler;},
      fire(){return this.callbacks.click?.();}
    }));
    return quickButtons;
  };
  let pickerEntries=[],pickerActions=null;
  const nativeBind=squadView.bind;
  squadView.bind=(root,actions)=>{pickerActions=actions;nativeBind(root,actions);};
  squadView.replacementPickerResultsMarkup=options=>
    options.entries.map(entry=>'<button data-rtg-picker-player="'+entry.cardId+'">SCEGLI</button>').join("");
  squadView.replacementPickerMarkup=options=>{
    pickerEntries=options.entries;pickerQuick=options.quickEntries||[];
    return '<section class="rtg-squad-picker"><div data-rtg-picker-results>'+
      squadView.replacementPickerResultsMarkup({entries:options.entries})+'</div></section>';
  };
  const pickerController=E.create({app,storage,squadView,runView:nativeRunView,toast:()=>{},
    getModalRoot:()=>pickerModal,openModal:markup=>{
      pickerModal.innerHTML=markup;
      const prefix="<div data-rtg-picker-results>";
      const start=markup.indexOf(prefix);
      const end=markup.indexOf("</div>",start);
      pickerResults.innerHTML=start>=0&&end>start?markup.slice(start+prefix.length,end):"";
    }});
  function assertVisibleRtgSquad(squad){
    const formation={id:"4-3-3",name:"4-3-3",
      slotRoles:["FW","FW","FW","MF","MF","MF","DF","DF","DF","DF","GK"],
      requirements:{FW:3,MF:3,DF:4,GK:1}};
    context.RoadToGloryConfig={season:()=>({formations:[formation]})};
    if(!context.RoadToGlorySquadView)
      vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-squad-view-base.js","utf8"),context);
    const native=context.RoadToGlorySquadView.create({escapeHtml:String});
    const model=native.renderModel({
      state:{activeSeasonId:"ie1",squads:{ie1:squad},gachaAcquiredCards:records["shared:account"].gachaAcquiredCards},
      freeAgentIds:freeAgents.players.map(p=>p.playerId),freeAgentsDb:freeAgents,
      playerResolver:{resolveAtLevel20:cardId=>cardId.startsWith("halloween2026::")
        ?E.eventPlayer(cardId.split("::")[1])
        :context.RoadToGloryPlayerResolver.resolveOwnedAtLevel20(cardId,"ie1",null,freeAgents)}
    });
    const html=native.markup(model,{teamPower:80});
    assert.equal(model.lineupRows.reduce((sum,row)=>sum+row.entries.length,0),11,
      "Every valid squad must render 11 starters even when a player is assigned off-role");
    assert.equal((html.match(/data-rtg-lineup-player=/g)||[]).length,11);
    assert.equal((html.match(/data-rtg-bench-player=/g)||[]).length,4);
    assert.equal(squad.lineupOrderedBySlot,true);
    assert.equal(new Set([...squad.lineup,...squad.bench]).size,15);
  }
  async function pickRealCard(cardId){
    const button=pickerResults.buttons.find(button=>button.dataset.rtgPickerPlayer===cardId);
    assert.ok(button,"Expected selectable card in actual bound replacement results: "+cardId);
    await button.fire();
  }
  await pickerController.open();
  // Halloween.open() accepts "album" as a special destination; the normal
  // user reaches Squadra through RUN → SQUADRA, not open("squad").
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  assert.match(app.innerHTML,/rtg-squad-shell/);
  await control("data-rtg-change-player").fire();
  assert.ok(pickerEntries.some(entry=>entry.cardId===nathanId),
    "Slot 1 must allow swapping Nathan from another starting position");
  records["local:halloween2026:squad"].activeSquadSlot=2;
  await pickerController.open();
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  pickerEntries=[];
  await control("data-rtg-change-player").fire();
  assert.ok(pickerEntries.some(entry=>entry.cardId===nathanId),
    "Slot 2 must list Nathan when he is unassigned");
  assert.strictEqual(records["shared:account"].gachaAcquiredCards.filter(card=>card.cardId===nathanId).length,1,
    "Catalog browsing must not duplicate event ownership or spend pumpkins");
  // Act on the actual picker button, not just the list: off-role swaps used to
  // render <11 because the old Halloween XI was grouped by natural roles.
  records["local:halloween2026:squad"].activeSquadSlot=1;
  const beforeLegacy=clone(records["local:halloween2026:squad"].slots["1"]);
  await pickerController.open();
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  assert.equal(records["local:halloween2026:squad"].slots["1"].lineupOrderedBySlot,false,
    "Opening an old saved squad is read-only: no hidden storage migration");
  await control("data-rtg-change-player").fire();
  await pickRealCard(nathanId);
  const swapped=records["local:halloween2026:squad"].slots["1"];
  assertVisibleRtgSquad(swapped);
  assert.deepEqual(new Set([...swapped.lineup,...swapped.bench]),
    new Set([...beforeLegacy.lineup,...beforeLegacy.bench]),
    "Swapping two already-convoked starters changes positions, not the roster");
  assert.deepEqual(records["local:halloween2026:squad"].slots["2"],slot2,
    "Editing Slot 1 must never remove players from Slot 2");
  // Swap in an UNASSIGNED player of a different role: the outgoing player is
  // removed from this squad, the incoming one takes the exact same tactical slot.
  const outgoing=swapped.lineup[0];
  assert.ok(pickerActions?.onOpenPlayer);
  pickerActions.onOpenPlayer(outgoing);
  // The native picker shows 12 at a time. Pick an actually visible,
  // unassigned card of another role instead of bypassing pagination.
  const rosterBefore=new Set([...swapped.lineup,...swapped.bench]);
  const outgoingRole=freeAgents.players.find(p=>outgoing==="free_agents::"+p.playerId)?.position||"FW";
  const unassigned=pickerEntries.find(e=>!rosterBefore.has(e.cardId)&&e.role!==outgoingRole)
    ||pickerEntries.find(e=>!rosterBefore.has(e.cardId));
  assert.ok(unassigned,"There must be at least one selectable unassigned card on the visible picker page");
  await pickRealCard(unassigned.cardId);
  const incomingSquad=records["local:halloween2026:squad"].slots["1"];
  assertVisibleRtgSquad(incomingSquad);
  assert.equal(incomingSquad.lineup.includes(unassigned.cardId),true);
  assert.equal([...incomingSquad.lineup,...incomingSquad.bench].includes(outgoing),false);
  assert.deepEqual(records["local:halloween2026:squad"].slots["2"],slot2);
  // Bench quick swap uses the SAME native picker UI. It must never duplicate a
  // card or leave a hole in the XI after an off-role bench-to-field exchange.
  const fieldBeforeQuick=incomingSquad.lineup[0],benchBeforeQuick=incomingSquad.bench[0];
  pickerActions.onOpenPlayer(fieldBeforeQuick);
  const quickButton=quickButtons.find(btn=>btn.dataset.rtgPickerPlayer===benchBeforeQuick);
  assert.ok(quickButton,"Native quick bench selector must expose the saved substitute");
  await quickButton.fire();
  const quickSwap=records["local:halloween2026:squad"].slots["1"];
  assertVisibleRtgSquad(quickSwap);
  assert.equal(quickSwap.lineup.includes(benchBeforeQuick),true);
  assert.equal(quickSwap.bench.includes(fieldBeforeQuick),true);
  assert.equal(quickSwap.bench.includes(benchBeforeQuick),false);
  assert.deepEqual(records["local:halloween2026:squad"].slots["2"],slot2);
  // Failed persistence must not remove/duplicate anyone, even if the UI
  // already registered a replacement click. The recovery guard remains owner
  // of the transaction: no side effects until updateMany commits.
  const beforeFailedWrite=clone(records["local:halloween2026:squad"]);
  const realUpdateMany=storage.updateMany;
  const oldConsoleError=context.console.error;
  storage.updateMany=async()=>{throw new Error("test-halloween-disk-write-failure");};
  context.console={...console,error:()=>{}}; // expected rejected write
  try{
    const failedFrom=quickSwap.lineup[0];
    pickerActions.onOpenPlayer(failedFrom);
    const failedCandidate=pickerEntries.find(e=>e.cardId!==failedFrom);
    assert.ok(failedCandidate);
    await pickRealCard(failedCandidate.cardId);
    assert.deepEqual(records["local:halloween2026:squad"],beforeFailedWrite,
      "Failed squad commit must leave every saved slot and player unchanged");
  }finally{
    storage.updateMany=realUpdateMany;
    context.console=console;
  }
  // Switching back to the other saved squad keeps all fifteen players.
  await pickerActions.onSelectSquadSlot(2);
  assertVisibleRtgSquad(records["local:halloween2026:squad"].slots["2"]);
  assertVisibleRtgSquad(records["local:halloween2026:squad"].slots["1"]);
  pickerController.dispose();
  squadView.bind=nativeBind;
  // Event coach is a separate rare prize (same weight as the two specials).
  // The last unowned prize must award into the EXISTING account coachOwnedIds,
  // never into player ownedIds or gachaAcquiredCards.
  const coachId="halloween-coach-54";
  assert.equal(E.weightedPick(["custom_0002",coachId],.49),"custom_0002");
  const account=records["shared:account"];
  account.halloween.ownedIds=Array.from(assets.players.keys());
  account.halloween.pumpkins=200;
  const originalPlayerCount=account.gachaAcquiredCards.length;
  assert.equal(account.coachOwnedIds.includes(coachId),false);
  const coachController=E.create({app,storage,toast:()=>{},squadView,runView:nativeRunView});
  await coachController.open();
  await control("data-halloween-open-vending").fire();
  await control("data-halloween-pull").fire();
  assert.equal(records["shared:account"].halloween.pumpkins,0,"Coach draw debits exactly 200 pumpkins");
  assert.equal(records["shared:account"].coachOwnedIds.filter(id=>id===coachId).length,1,"Coach is owned exactly once");
  assert.equal(records["shared:account"].halloween.ownedIds.length,18,"No imaginary nineteenth player");
  assert.equal(records["shared:account"].gachaAcquiredCards.length,originalPlayerCount,
    "Coach is not stored as a player card");
  assert.equal(context.RoadToGloryCoaches.status({...records["shared:account"],campaignId:"rtg-ares-orion"},coachId),"owned");
  assert.equal(context.RoadToGloryCoaches.status({...records["shared:account"],campaignId:"rtg-ie-trilogy"},coachId),"owned");
  await coachController.open();
  assert.match(app.innerHTML,/DISTRIBUTORE STREGATO/);
  coachController.dispose();
  // Characterization of the REAL coach power runtime, selection saved with
  // the event squad (not the global account), and the native coach status.
  const coachRules=context.RoadToGloryCoachPowerRuntime;
  const oldSaved=clone(records["local:halloween2026:squad"]);
  const powerSlot=clone(oldSaved.slots["1"]);
  // Prior regression cases intentionally swapped Nathan out. Reinsert the
  // already-owned event card as one starter for this independent coach test.
  if(!powerSlot.lineup.includes(nathanId)){
    const benchIndex=powerSlot.bench.indexOf(nathanId);
    if(benchIndex>=0)powerSlot.bench[benchIndex]=powerSlot.lineup[1];
    powerSlot.lineup[1]=nathanId;
  }
  assert.equal(new Set([...powerSlot.lineup,...powerSlot.bench]).size,15);
  assert.ok(powerSlot.lineup.includes(nathanId),"The event coach needs a REAL owned Halloween starter");
  powerSlot.coachId=coachId;
  powerSlot.coachPowerSelection={coachId,cardIds:[nathanId],moveIndices:[],element:"",targets:[]};
  assert.equal(coachRules.overallDiscountFor(powerSlot,records["shared:account"])?.amount,15,
    "Maschera Maledetta must discount 15 points ONLY for the selected Halloween starter");
  records["local:halloween2026:squad"]={...oldSaved,activeSquadSlot:1,
    slots:{...oldSaved.slots,"1":powerSlot}};
  const unmodifiedSlot2=clone(records["local:halloween2026:squad"].slots["2"]);
  let coachSquadMarkup=null,powerActions=null;
  const baseMarkup=squadView.markup,baseBind=squadView.bind;
  squadView.markup=(model,opts)=>{
    coachSquadMarkup={model,opts};
    return baseMarkup(model,opts);
  };
  squadView.bind=(root,actions)=>{
    powerActions=actions;
    return baseBind(root,actions);
  };
  const powerMessages=[];
  const powerController=E.create({app,storage,squadView,runView:nativeRunView,
    toast:message=>powerMessages.push(message),getModalRoot:()=>pickerModal,
    openModal:markup=>{pickerModal.innerHTML=markup;
      const prefix="<div data-rtg-picker-results>";
      const start=markup.indexOf(prefix),end=markup.indexOf("</div>",start);
      pickerResults.innerHTML=start>=0&&end>start?markup.slice(start+prefix.length,end):"";
    }});
  await powerController.open();
  await control("data-halloween-tab",d=>d.halloweenTab==="squad").fire();
  assert.match(coachSquadMarkup.opts.coachSlotMarkup,/selezione salvata/,
    "Equipped Halloween coach should visibly confirm its saved active power");
  assert.match(coachSquadMarkup.opts.requirementsMarkup,/Maschera Maledetta attiva/,
    "The requirements panel must explain the ACTIVE 15-point coach discount");
  const preSwapTarget=coachRules.overallDiscountFor(records["local:halloween2026:squad"].slots["1"],
    records["shared:account"]);
  assert.equal(preSwapTarget?.cardId,nathanId);
  assert.equal(preSwapTarget?.amount,15);
  // Replace the coached starter with an unassigned card of another role.
  // The XI must remain 11; the invalidated target is explicitly cleared.
  assert.ok(powerActions?.onOpenPlayer);
  powerActions.onOpenPlayer(nathanId);
  const unassignedForPower=pickerEntries.find(entry=>
    ![...powerSlot.lineup,...powerSlot.bench].includes(entry.cardId));
  assert.ok(unassignedForPower,"A normal available card must be selectable in the picker");
  await pickRealCard(unassignedForPower.cardId);
  const afterPowerSwap=records["local:halloween2026:squad"].slots["1"];
  assertVisibleRtgSquad(afterPowerSwap);
  assert.ok(afterPowerSwap.lineup.includes(unassignedForPower.cardId));
  assert.ok(!afterPowerSwap.lineup.includes(nathanId));
  assert.equal(afterPowerSwap.coachPowerSelection,null,
    "Moving the selected target off the field must not retain a silently stale power");
  assert.equal(coachRules.overallDiscountFor(afterPowerSwap,records["shared:account"]),null);
  assert.ok(powerMessages.some(message=>message.includes("Maschera Maledetta")),
    "Coach cancellation must be communicated to the player after the atomic squad save");
  assert.deepEqual(records["local:halloween2026:squad"].slots["2"],unmodifiedSlot2);
  // Race regression: two rapid squad-slot taps must not concurrently write a
  // stale snapshot and erase a valid lineup. Only the first commit is allowed.
  const atomicUpdate=storage.updateMany;
  let releaseSquadWrite=null,blockedWrites=0;
  storage.updateMany=async(keys,handler)=>{
    if(keys.includes("local:halloween2026:squad")){
      blockedWrites++;
      await new Promise(resolve=>{releaseSquadWrite=resolve;});
    }
    return atomicUpdate.call(storage,keys,handler);
  };
  try{
    const firstSwitch=powerActions.onSelectSquadSlot(2);
    assert.equal(typeof releaseSquadWrite,"function","First slot change must reach the commit boundary");
    await powerActions.onSelectSquadSlot(3);
    assert.equal(blockedWrites,1,"A second tap cannot start a competing squad save");
    releaseSquadWrite();
    await firstSwitch;
    const savedAfterRace=records["local:halloween2026:squad"];
    assert.equal(savedAfterRace.activeSquadSlot,2);
    assertVisibleRtgSquad(savedAfterRace.slots["1"]);
    assertVisibleRtgSquad(savedAfterRace.slots["2"]);
  }finally{storage.updateMany=atomicUpdate;}
  powerController.dispose();
  squadView.markup=baseMarkup;squadView.bind=baseBind;
  // Native end-to-end regression for the exact report: put a goalkeeper in
  // midfield using the REAL RTG player-picker and pitch, not a stub markup.
  const liveSlot=records["local:halloween2026:squad"].slots["1"];
  const goalkeeperId="free_agents::halloween-free-0";
  const keeperLine=liveSlot.lineup.indexOf(goalkeeperId);
  const keeperBench=liveSlot.bench.indexOf(goalkeeperId);
  if(keeperLine>=0){
    [liveSlot.lineup[10],liveSlot.lineup[keeperLine]]=
      [liveSlot.lineup[keeperLine],liveSlot.lineup[10]];
  }else if(keeperBench>=0){
    [liveSlot.lineup[10],liveSlot.bench[keeperBench]]=
      [liveSlot.bench[keeperBench],liveSlot.lineup[10]];
  }else{
    liveSlot.lineup[10]=goalkeeperId;
  }
  liveSlot.lineupOrderedBySlot=true;
  assert.equal(new Set([...liveSlot.lineup,...liveSlot.bench]).size,15);
  records["local:halloween2026:squad"].activeSquadSlot=1;
  const nativeView=context.RoadToGlorySquadView.create({escapeHtml:String});
  const nativeApp=createApp();
  let pickerButtons=[],filterSearch=null;
  const pickerRoot={
    innerHTML:"",classList:{remove(){}},
    querySelector(selector){
      if(selector==="[data-rtg-picker-results]"){
        return {set innerHTML(markup){pickerRoot.innerHTML=markup;},
          querySelectorAll(name){return name==="[data-rtg-picker-player]"?pickerButtons:[];}};
      }
      if(selector==="[data-rtg-picker-search]")
        return {addEventListener(event,callback){if(event==="input")filterSearch=callback;}};
      return null;
    },
    querySelectorAll(){return [];}
  };
  const buttonsFor=entries=>entries.map(entry=>({
    dataset:{rtgPickerPlayer:entry.cardId},listeners:{},
    addEventListener(name,callback){this.listeners[name]=callback;},
    fire(){return this.listeners.click?.();}
  }));
  const instrumentedNative={...nativeView,
    replacementPickerMarkup(options){
      pickerButtons=buttonsFor(options.entries||[]);
      return nativeView.replacementPickerMarkup(options);
    },
    replacementPickerResultsMarkup(options){
      pickerButtons=buttonsFor(options.entries||[]);
      return nativeView.replacementPickerResultsMarkup(options);
    }
  };
  const visualController=E.create({app:nativeApp,storage,squadView:instrumentedNative,
    runView:nativeRunView,toast:()=>{},getModalRoot:()=>pickerRoot,
    openModal:html=>{pickerRoot.innerHTML=html;},closeModal:()=>{}});
  const pitchIds=()=>[...nativeApp.innerHTML.matchAll(/data-rtg-lineup-player="([^"]+)"/g)].map(m=>m[1]);
  await visualController.open();
  await nativeApp.querySelectorAll("[data-halloween-tab]").find(b=>b.dataset.halloweenTab==="squad").fire();
  const mfId=liveSlot.lineup[3];
  await nativeApp.querySelectorAll("[data-rtg-change-player]")
    .find(button=>button.dataset.rtgChangePlayer===mfId).fire();
  assert.equal(typeof filterSearch,"function");
  filterSearch({target:{value:"Free 0"}});
  const keeperButton=pickerButtons.find(button=>button.dataset.rtgPickerPlayer===goalkeeperId);
  assert.ok(keeperButton,"A goalkeeper must be selectable as a midfielder");
  await keeperButton.fire();
  const afterGkSwap=records["local:halloween2026:squad"].slots["1"];
  assert.equal(afterGkSwap.lineup[3],goalkeeperId);
  assert.equal(afterGkSwap.lineup[10],mfId);
  assert.equal(pitchIds().length,11);
  assert.equal(new Set(pitchIds()).size,11);
  assert.deepEqual(new Set(pitchIds()),new Set(afterGkSwap.lineup),
    "All eleven saved IDs must appear in actual Halloween pitch markup");
  visualController.dispose();
  await visualController.open();
  await nativeApp.querySelectorAll("[data-halloween-tab]").find(b=>b.dataset.halloweenTab==="squad").fire();
  assert.deepEqual(new Set(pitchIds()),new Set(afterGkSwap.lineup),
    "Reload must not hide a goalkeeper assigned to midfield");
  visualController.dispose();
  // The Halloween pumpkin cheat must exist ONLY when RTG explicitly grants
  // devMode. It must commit to the existing shared:account, not a parallel key.
  const normalApp=createApp();
  const normalController=E.create({app:normalApp,storage,squadView,runView:nativeRunView,toast:()=>{}});
  await normalController.open();
  assert.doesNotMatch(normalApp.innerHTML,/data-halloween-dev-pumpkins/,
    "Normal Halloween event must never expose the developer pumpkin button");
  normalController.dispose();
  const devApp=createApp(),devToasts=[];
  const devController=E.create({app:devApp,storage,squadView,runView:nativeRunView,
    devMode:true,toast:(message)=>devToasts.push(message)});
  await devController.open();
  assert.match(devApp.innerHTML,/data-halloween-dev-pumpkins/,"DEV Halloween has pumpkin shortcut");
  const prior=clone(records["shared:account"]);
  await devApp.controls["data-halloween-dev-pumpkins"][0].fire();
  const granted=records["shared:account"];
  assert.equal(granted.halloween.pumpkins,99999,"DEV grants enough pumpkins for all event pulls");
  assert.equal(granted.tokens,prior.tokens,"DEV pumpkins must never alter RTG tokens");
  assert.deepEqual(granted.gachaAcquiredCards,prior.gachaAcquiredCards,
    "DEV pumpkins must not grant any players or skip the gacha");
  assert.deepEqual(granted.halloween.ownedIds,prior.halloween.ownedIds);
  assert.equal(granted.halloween.pullCount,prior.halloween.pullCount,
    "DEV grant must not count as a capsule pull");
  assert.deepEqual(granted.halloween.completedIds,prior.halloween.completedIds,
    "DEV grant must not fabricate completed matches");
  assert.ok(devToasts.some(message=>message.includes("99.999")),
    "Successful DEV grant must be acknowledged AFTER commit");
  assert.match(devApp.innerHTML,/99\.999|99999/,"DEV screen rerenders with refreshed balance");
  await devApp.controls["data-halloween-dev-pumpkins"][0].fire();
  assert.equal(records["shared:account"].halloween.pumpkins,99999,
    "Repeated DEV grants must not overflow or duplicate currency");
  devController.dispose();
  console.log("RTG Halloween: 18 players / 72 moves, RTG run/squad/album/fullbody layout, 11v11 pitch, OVR+1, 16 vampire filters, countdown, idempotent 600/300 prizes, unique 200-pumpkin pulls, cloud compatibility PASS");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
