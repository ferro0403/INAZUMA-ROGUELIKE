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
const albumUnlockedIds=new Set(freeAgents.players.map(player=>player.playerId));
const context={
  console,Date,
  AlbumProgress:{read:()=>({schemaVersion:2,
    sharedUnlockedPlayerIds:Object.fromEntries([...albumUnlockedIds].map(id=>[id,{firstSource:"run"}]))})},
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
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-entitlements.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coaches.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coach-powers-runtime.js","utf8"),context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coach-powers-squad-ui.js","utf8"),context);
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
  assert.doesNotMatch(coachSquadMarkup.opts.requirementsMarkup,/Maschera Maledetta attiva/,
    "The requirements panel must explain the ACTIVE 15-point coach discount");
  const preSwapTarget=coachRules.overallDiscountFor(records["local:halloween2026:squad"].slots["1"],
    records["shared:account"]);
  assert.equal(preSwapTarget?.cardId,nathanId);
  assert.equal(preSwapTarget?.amount,15);
  // Commit the coach choice while the modal is open. On close, the native
  // squad OVR and requirements must refresh without changing screens.
  const originalCoachUi=context.RoadToGloryCoachSquadPowerUi;
  let coachUiArgs=null;
  context.RoadToGloryCoachSquadPowerUi={open:args=>{coachUiArgs=args;}};
  assert.ok(powerActions?.onConfigureCoachPower);
  powerActions.onConfigureCoachPower();
  assert.ok(coachUiArgs?.saveSquad&&coachUiArgs?.closeModal);
  const effectiveBefore=coachSquadMarkup.opts.teamPower;
  const originalPower=clone(powerSlot.coachPowerSelection);
  await coachUiArgs.saveSquad({...records["local:halloween2026:squad"].slots["1"],coachPowerSelection:null});
  coachUiArgs.closeModal();
  const withoutPower=coachSquadMarkup.opts.teamPower;
  assert.ok(withoutPower>effectiveBefore,"Removing Hekyll's power must update OVR immediately");
  assert.doesNotMatch(coachSquadMarkup.opts.requirementsMarkup,/Maschera Maledetta attiva/,
    "No stale power status after close and commit");
  assert.doesNotMatch(coachSquadMarkup.opts.coachSlotMarkup,/selezione salvata/,
    "Coach status must update without leaving Squadra");
  powerActions.onConfigureCoachPower();
  await coachUiArgs.saveSquad({...records["local:halloween2026:squad"].slots["1"],coachPowerSelection:originalPower});
  coachUiArgs.closeModal();
  assert.equal(coachSquadMarkup.opts.teamPower,effectiveBefore,
    "Configuring Hekyll must immediately restore the discounted squad OVR");
  assert.doesNotMatch(coachSquadMarkup.opts.requirementsMarkup,/Maschera Maledetta attiva/,
    "Committed selection must show in the same Squadra screen");
  assert.match(coachSquadMarkup.opts.coachSlotMarkup,/selezione salvata/);
  context.RoadToGloryCoachSquadPowerUi=originalCoachUi;
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
  await nativeApp.controls["data-halloween-tab"].find(b=>b.dataset.halloweenTab==="squad").fire();
  const beforeVisible=pitchIds();
  assert.equal(beforeVisible.length,11,"The native event pitch must initially show all 11 starters");
  assert.deepEqual(new Set(beforeVisible),
    new Set(records["local:halloween2026:squad"].slots["1"].lineup),
    "The native pitch must show the same 11 IDs as canonical storage before the GK swap");
  const mfId=beforeVisible[3];
  const mfChange=nativeApp.controls["data-rtg-change-player"]
    .find(button=>button.dataset.rtgChangePlayer===mfId);
  assert.ok(mfChange,"The real native third midfield-lineup change button must exist");
  await mfChange.fire();
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
  await nativeApp.controls["data-halloween-tab"].find(b=>b.dataset.halloweenTab==="squad").fire();
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

  // Normalize the old cap-solver test's artificially boosted free-agent
  // OVR before these isolated match snapshots, so the event cap is realistic.
  freeAgents.players.forEach(p=>{p.overall=70;});
  // Event kickoff parity: real configured staff powers must reach the
  // immutable match snapshot. Earlier coverage verified saved selection/OVR
  // but never checked Hillman's +100 PT or Yi's two elemental conversions.
  const eventIds=["halloween2026::custom_0001","halloween2026::custom_0002"];
  const id2Record=context.RoadToGloryCardIdentity.record({
    playerId:"custom_0002",legacySeasonId:"halloween2026"
  });
  const accountForCoaches=records["shared:account"];
  if(!accountForCoaches.gachaAcquiredCards.some(x=>x.cardId===eventIds[1]))
    accountForCoaches.gachaAcquiredCards.push(id2Record);
  if(!accountForCoaches.halloween.ownedIds.includes("custom_0002"))
    accountForCoaches.halloween.ownedIds.push("custom_0002");
  for(const coachId of ["208","4401","1974","1940"])
    if(!accountForCoaches.coachOwnedIds.includes(coachId))
      accountForCoaches.coachOwnedIds.push(coachId);
  const currentTeam=clone(records["local:halloween2026:squad"].slots["1"]);
  const roster=Array.from(new Set([...eventIds,...currentTeam.lineup,...currentTeam.bench]));
  const field=[...eventIds,...roster.filter(key=>!eventIds.includes(key)).slice(0,9)];
  const reserves=roster.filter(key=>!field.includes(key)).slice(0,4);
  assert.equal(field.length,11);
  assert.equal(reserves.length,4);
  const baseTeam={...currentTeam,lineup:field,bench:reserves,lineupOrderedBySlot:true};
  // Use the real match engine and real PT initializer rather than fabricating
  // +100 PT in a fake createMatch() result. Only the encounter progression is
  // parked, so this test inspects the actual kickoff snapshot atomically.
  context.RoadToGloryRng.float=()=>.5;
  vm.runInNewContext(fs.readFileSync("js/roguelike_progression.js","utf8"),context);
  vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-coach-powers-prematch.js","utf8"),context);
  context.RtgFourMovesRuntime={ready:Promise.resolve(true),isReady:()=>true,error:()=>null,
    ptBreakdown:()=>({base:150,bonus:0,total:150}),movesFor:()=>[]};
  vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-match-pt-runtime.js","utf8"),context);
  vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-match-engine.js","utf8"),context);
  const genuineEngine=context.RoadToGloryMatchEngine;
  context.RoadToGloryMatchEngine={...genuineEngine,prepareNext:state=>state};
  for(const coachId of ["208","4401","1974"]){
    const targets=eventIds.map(cardId=>E.eventPlayer(cardId.split("::")[1]));
    const elements=targets.map((target,index)=>{
      const current=String(target.element||"").toLowerCase();
      return (index===0?["fire","wind","forest","mountain"]:["mountain","fire","wind","forest"])
        .find(element=>element!==current);
    });
    const selection=coachId==="208"||coachId==="1974"
      ?{coachId,cardIds:eventIds.slice(),moveIndices:[],element:"",targets:[]}
      :{coachId,cardIds:eventIds.slice(),moveIndices:[],element:"",
        targets:eventIds.map((cardId,index)=>({cardId,element:elements[index],moveIndices:[]}))};
    const team={...baseTeam,coachId,coachPowerSelection:selection};
    const existing=records["local:halloween2026:squad"];
    records["local:halloween2026:squad"]={
      ...existing,activeSquadSlot:1,
      slots:{...existing.slots,"1":team}
    };
    delete records["local:halloween2026:match"];
    const errors=[],coachApp=createApp();
    const trial=E.create({app:coachApp,storage,squadView,runView:nativeRunView,
      toast:(message,kind)=>errors.push({message,kind})});
    await trial.open();
    const coachSaved=records["local:halloween2026:squad"].slots["1"];
    assert.deepEqual(coachSaved.coachPowerSelection,selection,
      "Opening Halloween must not discard a configured staff power");
    await coachApp.controls["data-halloween-start"][0].fire();
    const snapshot=records["local:halloween2026:match"];
    assert.ok(snapshot,"Kickoff must create a real Halloween match for "+coachId+
      ": "+errors.map(x=>x.message).join(", "));
    assert.equal(snapshot.ptModeVersion,1,
      "Real Halloween kickoff must activate the native PT engine");
    assert.equal(snapshot.coachPowerEffect?.coachId,coachId,
      "Saved "+coachId+" coach power must be snapshotted before kickoff");
    if(coachId==="208"){
      for(const id of eventIds){
        assert.equal(snapshot.ptCurrentByPlayerId["user:"+id],250);
        assert.equal(snapshot.ptMaxByPlayerId["user:"+id],250);
      }
      assert.equal(snapshot.ptCurrentByPlayerId["user:"+baseTeam.lineup[2]],150,
        "Hillman never boosts an unselected starter");
    }else if(coachId==="1974"){
      for(const id of eventIds){
        const player=snapshot.userSquad.lineup.find(p=>p.cardId===id);
        const original=E.eventPlayer(id.split("::")[1]);
        assert.equal(player.finalRarity,"Aurico",
          "Arrows must upgrade the actual Halloween player in the match snapshot");
        assert.equal(player.overall,99);
        assert.ok(Object.keys(original.stats).some(k=>player.stats[k]>original.stats[k]),
          "Arrows must increase real player statistics, not just rarity text");
        assert.equal(original.category,"Leggenda",
          "Temporary rarity must never mutate the Halloween owned card");
      }
      assert.equal(snapshot.coachPowerEffect.targets.length,2);
    }else{
      for(let i=0;i<eventIds.length;i++){
        const player=snapshot.userSquad.lineup.find(p=>p.cardId===eventIds[i]);
        assert.equal(player.element,elements[i],
          "Yi updates each selected player's actual match element");
        assert.equal(
          context.RoadToGloryCoachPowerRuntime.moveElement(
            snapshot,"user",eventIds[i],0,"original"),elements[i],
          "Yi changes all available moves to the selected element");
        assert.equal(player.halloweenMoves.length,4);
        for(let moveIndex=0;moveIndex<4;moveIndex++){
          assert.equal(player.halloweenMoves[moveIndex].element,elements[i],
            "Yi's transformation must appear on the native Halloween card/detail");
          assert.equal(player.halloweenMoves[moveIndex].power,
            targets[i].halloweenMoves[moveIndex].power,
            "Yi must retain each original move's power");
        }
        assert.equal(context.RoadToGloryCoachPowerRuntime.moveCost(
          snapshot,"user",eventIds[i],0,50),50,
          "Yi must not change move costs");
      }
      assert.equal(E.eventPlayer("custom_0001").element,targets[0].element,
        "The event player's original card remains unchanged");
    }
    if(coachId==="208"){
      // Halloween opponent moves are not present in RTG's packed 5-Season
      // catalog. Zoolan must still see and block all FOUR event moves.
      const victim=snapshot.opponentSquad.lineup[0],victimId=victim.cardId;
      const pending={...snapshot,preMatchCoachId:"1940",
        presentation:{preMatchSeen:false,preMatchPowerStatus:"pending"}};
      const selection={playerIds:[victimId]};
      const checked=context.RoadToGloryCoachPreMatchRuntime.validate(pending,"1940",selection);
      assert.equal(checked?.moveIndices.length,4,
        "Zoolan must recognize Halloween opponent's four special moves");
      const blocked=context.RoadToGloryCoachPreMatchRuntime.apply(pending,"1940",selection);
      assert.equal(blocked.preMatchCoachEffect.coachId,"1940");
      for(let moveIndex=0;moveIndex<4;moveIndex++)
        assert.equal(context.RoadToGloryCoachPreMatchRuntime.blocked(
          blocked,"opponent",victimId,moveIndex),true);
    }
    trial.dispose();
    delete records["local:halloween2026:match"];
  }
  // Use the ACTUAL Halloween Squadra -> Configura potere modal wiring,
  // not only programmatically manufactured selections. Catch regressions where
  // the popup opens but tapping cards/CONFERMA produces no persisted effect.
  function fakeCoachModal(){
    const modal={html:"",classList:{remove(){}},clickables:new Map()};
    function button(key,disabled=false){
      const el={dataset:key,disabled,click:null,addEventListener(kind,fn){
        if(kind==="click")this.click=fn;
      },setAttribute(){},closest:()=>({classList:{toggle(){}}}),
      fire(){if(this.disabled)throw Error("Power button disabled");return this.click?.();}};
      return el;
    }
    modal.querySelectorAll=selector=>{
      if(selector===".rtg-coach-field-picker [data-rtg-squad-player]"){
        return [...modal.html.matchAll(/data-rtg-squad-player="([^"]+)"/g)]
          .map(match=>button({rtgSquadPlayer:match[1]}));
      }
      if(selector==="[data-rtg-coach-power-element]"){
        return [...modal.html.matchAll(/data-rtg-coach-power-element="([^"]+)" data-rtg-coach-power-target="([^"]+)"/g)]
          .map(match=>button({rtgCoachPowerElement:match[1],rtgCoachPowerTarget:match[2]}));
      }
      return [];
    };
    modal.querySelector=selector=>{
      if(selector===".rtg-coach-power-config")
        return modal.html.includes('class="rtg-coach-power-config ')
          ?{set outerHTML(value){modal.html=value;}}:null;
      if(selector===".modal")return {scrollTop:0,isConnected:true};
      if(selector==="[data-rtg-coach-power-save]"){
        const found=modal.html.match(/<button[^>]*data-rtg-coach-power-save( disabled)?/);
        return found?button({},Boolean(found[1])):null;
      }
      if(selector==="[data-rtg-coach-power-clear]"||selector==="[data-rtg-coach-power-cancel]")
        return button({});
      return null;
    };
    return modal;
  }
  for(const coachId of ["208","4401"]){
    const team={...baseTeam,coachId,coachPowerSelection:null};
    const stored=records["local:halloween2026:squad"];
    records["local:halloween2026:squad"]={
      ...stored,activeSquadSlot:1,slots:{...stored.slots,"1":team}
    };
    const uiApp=createApp(),root=fakeCoachModal(),errors=[];
    const controller=E.create({app:uiApp,storage,squadView:nativeView,
      runView:nativeRunView,getModalRoot:()=>root,
      openModal:html=>{root.html=html;},closeModal:()=>{},
      toast:(message,kind)=>errors.push({message,kind})});
    await controller.open();
    await uiApp.controls["data-halloween-tab"]
      .find(item=>item.dataset.halloweenTab==="squad").fire();
    const configure=uiApp.controls["data-rtg-coach-power-configure"]?.[0];
    assert.ok(configure,"The coach power button must exist in Halloween Squadra");
    await configure.fire();
    let cards=root.querySelectorAll(".rtg-coach-field-picker [data-rtg-squad-player]");
    assert.equal(cards.length,11,"All 11 Halloween starters must be selectable in the actual coach modal");
    for(const id of eventIds){
      const item=cards.find(card=>card.dataset.rtgSquadPlayer===id);
      assert.ok(item,"Owned event starter must be present in coach picker");
      await item.fire();
      cards=root.querySelectorAll(".rtg-coach-field-picker [data-rtg-squad-player]");
    }
    if(coachId==="4401"){
      for(const id of eventIds){
        const target=E.eventPlayer(id.split("::")[1]);
        const current=context.RoadToGloryCoachPowerRuntime.elementKey(target.element);
        const option=root.querySelectorAll("[data-rtg-coach-power-element]")
          .find(item=>item.dataset.rtgCoachPowerTarget===id&&
            item.dataset.rtgCoachPowerElement!==current);
        assert.ok(option,"Yi must offer alternate elements for both selected players");
        await option.fire();
      }
    }
    const save=root.querySelector("[data-rtg-coach-power-save]");
    assert.ok(save&&!save.disabled,
      "Valid "+coachId+" selection must enable CONFERMA POTERE in the real popup");
    await save.fire();
    const canonical=records["local:halloween2026:squad"].slots["1"];
    assert.equal(canonical.coachPowerSelection?.coachId,coachId,
      "Confirming from UI must persist the selected "+coachId+" power");
    assert.equal(canonical.coachPowerSelection.cardIds.length,2);
    if(coachId==="4401")assert.equal(canonical.coachPowerSelection.targets.length,2);
    assert.equal(errors.filter(x=>x.kind==="error").length,0,
      "Coach selection must not raise an error in Halloween UI");
    controller.dispose();
  }
  // A legacy saved event slot may contain a free agent never earned in runs.
  // Opening repairs it IN MEMORY, and the next canonical squad save removes
  // the unauthorized card. The shared account and cloud are never rewritten.
  const lockedPid="halloween-free-15",lockedCard="free_agents::"+lockedPid;
  albumUnlockedIds.delete(lockedPid);
  const legacySquad=clone(records["local:halloween2026:squad"]);
  const slot=clone(legacySquad.slots["1"]);
  const legacyRosterIds=[...slot.lineup,...slot.bench];
  if(!legacyRosterIds.includes(lockedCard)){
    const replacement=slot.bench[0];
    slot.bench[0]=lockedCard;
    assert.notEqual(replacement,lockedCard);
  }
  legacySquad.slots["1"]=slot;
  records["local:halloween2026:squad"]=clone(legacySquad);
  const sharedBeforeUnlock=clone(records["shared:account"]);
  let uiAllowedFreeAgents=null;
  const entitlementView={...squadView,renderModel(args){
    uiAllowedFreeAgents=args.freeAgentIds;
    return squadView.renderModel(args);
  }};
  const entitlementApp=createApp(),entitlementErrors=[];
  const entitlementController=E.create({app:entitlementApp,storage,squadView:entitlementView,
    runView:nativeRunView,toast:(message)=>entitlementErrors.push(message)});
  await entitlementController.open();
  assert.deepEqual(records["local:halloween2026:squad"],legacySquad,
    "Read and repair must not write or migrate legacy squads implicitly");
  await entitlementApp.controls["data-halloween-tab"]
    .find(button=>button.dataset.halloweenTab==="squad").fire();
  assert.ok(Array.isArray(uiAllowedFreeAgents));
  assert.equal(uiAllowedFreeAgents.includes(lockedPid),false,
    "The Halloween RTG squad view receives only album-unlocked free agents");
  assert.ok(entitlementApp.innerHTML.includes("rtg-squad-shell"));
  await entitlementApp.controls["data-rtg-adapt"][0].fire();
  const repairedByEdit=records["local:halloween2026:squad"].slots["1"];
  assert.equal([...repairedByEdit.lineup,...repairedByEdit.bench].includes(lockedCard),false,
    "A saved squad edit must exclude free agents locked in the canonical Album");
  assert.equal(new Set([...repairedByEdit.lineup,...repairedByEdit.bench]).size,15);
  assert.deepEqual(clone(records["shared:account"]),sharedBeforeUnlock,
    "Album entitlement repair must not mutate the shared account");
  entitlementController.dispose();
  albumUnlockedIds.add(lockedPid);
  console.log("RTG Halloween: 18 players / 72 moves, RTG run/squad/album/fullbody layout, 11v11 pitch, OVR+1, 16 vampire filters, countdown, idempotent 600/300 prizes, unique 200-pumpkin pulls, cloud compatibility PASS");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
