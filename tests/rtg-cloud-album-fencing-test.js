"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function harness(){
  const values=new Map(),listeners=new Map();let writeError=null;
  const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(writeError&&k==='inazuma.rtg.album.v1')throw writeError;values.set(k,String(v));}};
  const c={console,localStorage,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},addEventListener:(t,f)=>{if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(f);},dispatchEvent:e=>{for(const f of listeners.get(e.type)||[])f(e);}};
  vm.createContext(c);
  for(const file of ['js/persistence-recovery-guard.js','js/road-to-glory/rtg-persistence-runtime.js','js/road-to-glory/rtg-album-controller.js','js/road-to-glory/rtg-squad-slot-runtime.js','js/road-to-glory/rtg-controller.js']){
    if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
  }
  const campaign={activeSeasonId:'ie1',tokens:600,gachaAcquiredCards:['old-card'],squads:{ie1:{formationId:'4-3-3',lineup:Array.from({length:11},(_,i)=>String(i)),bench:[]}}};
  const deps={localStorage,id:String,clone:v=>JSON.parse(JSON.stringify(v)),cardMeta:cardId=>({cardId}),getCampaign:()=>campaign,acquiredCardIdSet:state=>new Set(state.gachaAcquiredCards),activeSeasonId:()=> 'ie1',config:{SEASON_IDS:['ie1']},renderHtml:()=>{},mountDevQuickTools:()=>{},runView:{albumCollectionMarkup:()=>''},ensureData:async()=>{}};
  return {c,values,campaign,deps,fail:e=>{writeError=e;},restore:()=>{assert.ok(c.RoadToGloryPersistence,'persistent RTG runtime required');const j={operationId:'restore-1',uid:'u'};c.RoadToGloryPersistence.beginRestore(j);c.RoadToGloryPersistence.completeRestore(j);}};
}
const code=expected=>error=>error.code===expected;
test('Album respects recovery guard and preserves storage quota/security errors',()=>{
  const h=harness(),album=h.c.RoadToGloryAlbumController.create(h.deps);
  h.c.PersistenceRecoveryGuard.setBlocked({});assert.throws(()=>album.rememberRtgAlbumCard('new'),code('restore-recovery-required'));
  h.c.PersistenceRecoveryGuard.clearBlocked();
  for(const name of ['QuotaExceededError','SecurityError']){const failure=Object.assign(new Error(name),{name});h.fail(failure);assert.throws(()=>album.rememberRtgAlbumCard('new'),e=>e===failure);}
});
for(const method of ['renderAlbumTeams','renderAlbumRoster','renderAlbum'])test(`${method}: pending Album work cannot repopulate after completed restore`,async()=>{
  const h=harness();let release;h.deps.ensureData=()=>new Promise(r=>{release=r;});
  const album=h.c.RoadToGloryAlbumController.create(h.deps),pending=album[method]('team');
  h.restore();h.values.set('inazuma.rtg.album.v1',JSON.stringify({version:1,cardIds:['restored']}));release();
  await assert.rejects(pending,code('rtg-stale-runtime'));
  assert.deepEqual(JSON.parse(h.values.get('inazuma.rtg.album.v1')).cardIds,['restored']);
  assert.throws(()=>album.rememberRtgAlbumCard('old'),code('rtg-stale-runtime'));
});
test('squad slot legacy reads stay in memory and stale slot callbacks cannot write',()=>{
  const h=harness();h.values.set('inazuma.rtg.squad-slots.v1',JSON.stringify({'1':{coachId:'36'}}));
  const slots=h.c.RoadToGlorySquadSlotRuntime.create(h.deps);
  assert.equal(slots.readSquadSlots()['1'].coachId,'36');assert.equal(h.values.has('inazuma.rtg.squad-slots.v2.ie1'),false);
  h.c.PersistenceRecoveryGuard.setBlocked({});assert.throws(()=>slots.writeActiveSquadSlot(2),code('restore-recovery-required'));
  h.c.PersistenceRecoveryGuard.clearBlocked();h.restore();
  assert.throws(()=>slots.storeSquadSlot(1,{}),code('rtg-stale-runtime'));
  assert.throws(()=>slots.writeActiveSquadSlot(3),code('rtg-stale-runtime'));
});
function mainController(h,repository){
  return h.c.RoadToGloryController.create({repository,runView:{runMarkup:()=>''},config:{SEASON1:{},buildSeasonNodes:()=>[]},squadRuntime:{accessibleCardIds:()=>[],validateSquad:()=>({valid:false,reasons:['fixture']})},
    entitlements:{accessStatus:()=>({unlocked:true}),unlockedFreeAgentIds:()=>[]},getAlbumProgress:()=>({read:()=>({})}),ensureSeason1Db:async()=>({seasonId:'ie1',players:[]}),getFreeAgentsDb:()=>({players:[]}),
    playerResolver:{resolveAtLevel20:()=>({cardId:'new-card'})},gacha:{pull:state=>({state:{...state,tokens:state.tokens-300,gachaAcquiredCards:[...state.gachaAcquiredCards,'new-card']},result:{cardId:'new-card'}})}});
}
test('pending pull is single-flight and cannot write Album or reveal results after restore',async()=>{
  const h=harness();let release,updates=0,current=structuredClone(h.campaign);
  const repository={update:async(_label,fn)=>{updates++;current=fn(current);await new Promise(r=>{release=r;});return current;}};
  const controller=mainController(h,repository),pending=controller.pull({reveal:false});
  const duplicate=controller.pull({reveal:false});assert.equal(updates,1);assert.equal(await duplicate,null);
  h.restore();release();await assert.rejects(pending,code('rtg-stale-runtime'));assert.equal(h.values.has('inazuma.rtg.album.v1'),false);
  await assert.rejects(controller.pull({reveal:false}),code('rtg-stale-runtime'));assert.equal(updates,1);
});
test('Album failure after pull leaves canonical acquired card durable for explicit retry',async()=>{
  const h=harness();let current=structuredClone(h.campaign);
  const controller=mainController(h,{update:async(_label,fn)=>{current=fn(current);return current;}});
  // Fail only the Album store; recovery reservation must still succeed.
  const set=h.deps.localStorage.setItem;h.deps.localStorage.setItem=(k,v)=>{if(k==='inazuma.rtg.album.v1')throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});return set(k,v);};
  await assert.rejects(controller.pull({reveal:false}),e=>e.name==='QuotaExceededError');
  assert.equal(current.tokens,300);assert.ok(current.gachaAcquiredCards.includes('new-card'));
  h.deps.localStorage.setItem=set;h.deps.getCampaign=()=>current;
  h.c.RoadToGloryAlbumController.create(h.deps).syncCurrentPullsIntoAlbum();
  assert.ok(JSON.parse(h.values.get('inazuma.rtg.album.v1')).cardIds.includes('new-card'));
});
test('idle main controller requires canonical reload on next open after completed restore',async()=>{
  const h=harness();h.campaign.squads.ie1.bench=['b1','b2','b3','b4'];
  let current=structuredClone(h.campaign),ensures=0;
  const controller=mainController(h,{ensureCampaign:async()=>{ensures++;return structuredClone(current);},update:async(_label,fn)=>{current=fn(current);return structuredClone(current);}});
  await controller.open();assert.equal(controller.getState().tokens,600);
  h.restore();assert.equal(controller.getState(),null);
  await assert.rejects(controller.pull({reveal:false}),code('rtg-stale-runtime'));
  current.tokens=77;current.campaignSeed='restored-canonical';await controller.open();
  assert.equal(ensures,2);assert.equal(controller.getState().tokens,77);assert.equal(controller.getState().campaignSeed,'restored-canonical');
});
test('an open suspended before campaign load cannot initialize after another restore and open',async()=>{
  const h=harness();h.campaign.squads.ie1.bench=['b1','b2','b3','b4'];let release,ensures=0;
  const controller=mainController(h,{ensureCampaign:async()=>{ensures++;return structuredClone(h.campaign);}});
  // The database loader is the asynchronous boundary before ensureCampaign.
  let calls=0;h.c.SeasonRegistry={database:()=>null};
  // Supply loader through a separate controller so its first open can be held.
  const loader=()=>new Promise(r=>{release=r;});
  const deps={repository:{ensureCampaign:async()=>{ensures++;return structuredClone(h.campaign);}},runView:{runMarkup:()=>''},config:{SEASON1:{},buildSeasonNodes:()=>[]},entitlements:{accessStatus:()=>({unlocked:true}),unlockedFreeAgentIds:()=>[]},getAlbumProgress:()=>({read:()=>({})}),ensureSeason1Db:async()=>{calls++;return calls===1?loader():{seasonId:'ie1',players:[]};},getFreeAgentsDb:()=>({players:[]})};
  const held=h.c.RoadToGloryController.create(deps),pending=held.open();h.restore();await held.open();
  release({seasonId:'ie1',players:[]});await assert.rejects(pending,code('rtg-stale-runtime'));assert.equal(ensures,1);
  assert.equal(held.getState().tokens,600);assert.equal(controller.getState(),null);
});
test('canonical reopen recreates child controllers with the new repository generation',async()=>{
  const h=harness();vm.runInContext(fs.readFileSync('js/road-to-glory/rtg-squad-controller.js','utf8'),h.c);
  h.campaign.squads.ie1.bench=['b1','b2','b3','b4'];const repository={ensureCampaign:async()=>structuredClone(h.campaign),update:async(_label,fn)=>fn(structuredClone(h.campaign))};
  const controller=mainController(h,repository);await controller.open();
  await assert.rejects(controller.saveSquad(h.campaign.squads.ie1),code('rtg-squad-invalid'));
  h.restore();await controller.open();
  await assert.rejects(controller.saveSquad(h.campaign.squads.ie1),code('rtg-squad-invalid'));
});
test('match start suspended on asset readiness stays fenced after restore and reopen',async()=>{
  const h=harness();h.campaign.squads.ie1.bench=['b1','b2','b3','b4'];let release,updates=0;
  const controller=mainController(h,{ensureCampaign:async()=>structuredClone(h.campaign),update:async(_label,fn)=>{updates++;return fn(structuredClone(h.campaign));}});
  await controller.open();h.c.RtgFourMovesRuntime={ready:new Promise(r=>{release=r;})};
  const pending=controller.startMatch('old-node');h.restore();await controller.open();release(true);
  await assert.rejects(pending,code('rtg-stale-runtime'));assert.equal(updates,0);
});
test('pull continuation keeps its captured generation when another open refreshes the instance',async()=>{
  const h=harness();h.campaign.squads.ie1.bench=['b1','b2','b3','b4'];let reopening,current=structuredClone(h.campaign),controller;
  const repository={ensureCampaign:async()=>structuredClone(h.campaign),update:async(_label,fn)=>{
    current=fn(current);
    queueMicrotask(()=>queueMicrotask(()=>{h.restore();reopening=controller.open();}));
    return current;
  }};
  controller=mainController(h,repository);
  await assert.rejects(controller.pull({reveal:false}),code('rtg-stale-runtime'));
  await reopening;
  assert.equal(h.values.has('inazuma.rtg.album.v1'),false);assert.equal(controller.getState().tokens,600);
});
