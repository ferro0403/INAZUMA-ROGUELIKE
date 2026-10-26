"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {makeFakeIndexedDb}=require('./helpers/fake-indexeddb-atomic');
function harness({values=new Map(),fakeOptions={},runtime=true}={}){
  const listeners=new Map(),events=[];
  const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
  const c={console,localStorage,queueMicrotask,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn),dispatchEvent:event=>{events.push(event);for(const fn of listeners.get(event.type)||[])fn(event);},
    SeasonRegistry:{normalizeSeasonId:String,player:()=>null},ProfiledSeasonRuntime:{canonicalPlayerId:(_s,p)=>String(p)}};
  vm.createContext(c);
  function load(name){vm.runInContext(fs.readFileSync(name,'utf8'),c,{filename:name});}
  load('js/persistence-recovery-guard.js');
  if(runtime&&fs.existsSync('js/road-to-glory/rtg-persistence-runtime.js'))load('js/road-to-glory/rtg-persistence-runtime.js');
  for(const file of ['card-identity','storage','coaches','state','repository'])load(`js/road-to-glory/rtg-${file}.js`);
  const fake=makeFakeIndexedDb(fakeOptions),storage=c.RoadToGloryStorage.create({indexedDB:fake});
  return {c,values,events,fake,storage};
}
const code=expected=>error=>error.code===expected;
const journal={uid:'restore-user',operationId:'restore-1'};
const mutations={write:s=>s.write({tokens:9}),update:s=>s.update(()=>({tokens:9})),updateMany:s=>s.updateMany(['state'],()=>({writes:{state:{tokens:9}},value:true})),remove:s=>s.remove()};
for(const [name,mutate] of Object.entries(mutations)){
  test(`${name}: guard blocks before opening IDB`,async()=>{
    const h=harness();h.c.PersistenceRecoveryGuard.setBlocked({operationId:'blocked'});
    await assert.rejects(mutate(h.storage),code('restore-recovery-required'));
    assert.equal(h.fake._openCalls(),0);
  });
  test(`${name}: restore during database open rejects old generation after completion`,async()=>{
    const h=harness();const pending=mutate(h.storage);
    assert.ok(h.c.RoadToGloryPersistence,'persistent RTG runtime required');
    h.c.RoadToGloryPersistence.beginRestore(journal);h.c.RoadToGloryPersistence.completeRestore(journal);
    await assert.rejects(pending,code('rtg-stale-runtime'));assert.equal(await h.storage.read(),undefined);
    assert.equal(h.events.filter(e=>e.type==='inazuma:local-save-committed').length,0);
  });
}
test('runtime fences other tabs without auth UID, keeps completed generation and idempotence',()=>{
  const a=harness(),b=harness({values:a.values});
  assert.ok(a.c.RoadToGloryPersistence,'persistent RTG runtime required');
  const token=b.c.RoadToGloryPersistence.capture();
  a.c.RoadToGloryPersistence.beginRestore(journal);
  assert.throws(()=>b.c.RoadToGloryPersistence.assertWritable(),code('restore-recovery-required'));
  assert.throws(()=>b.c.RoadToGloryPersistence.assertWritable({restoreOwnershipToken:'wrong'}),code('restore-ownership-lost'));
  a.c.RoadToGloryPersistence.completeRestore(journal);
  assert.throws(()=>b.c.RoadToGloryPersistence.assertGeneration(token),code('rtg-stale-runtime'));
  const complete=b.c.RoadToGloryPersistence.capture();a.c.RoadToGloryPersistence.beginRestore(journal);
  assert.equal(b.c.RoadToGloryPersistence.capture(),complete);b.c.RoadToGloryPersistence.assertWritable();
});
test('generation is checked inside updater before put, transaction is atomic',async()=>{
  const h=harness();await h.storage.write({tokens:1});
  await assert.rejects(h.storage.update(()=>{
    h.c.RoadToGloryPersistence.beginRestore(journal);h.c.RoadToGloryPersistence.completeRestore(journal);return {tokens:9};
  }),code('rtg-stale-runtime'));
  assert.equal((await h.storage.read()).tokens,1);
});
test('canonical commit event is after IDB completion; failures and restore writes stay silent',async()=>{
  const h=harness();let committed;
  h.c.addEventListener('inazuma:local-save-committed',()=>{committed=h.fake._databases.get('inazumaRoadToGlory').stores.get('campaign').get('state');});
  await h.storage.write({tokens:4});assert.equal(committed.tokens,4);
  assert.deepEqual(JSON.parse(JSON.stringify(h.events.find(e=>e.type==='inazuma:local-save-committed').detail)),{domain:'account-permanent',sector:'rtg'});
  await h.storage.update(()=>({tokens:5}),'state',{suppressCloudEvent:true});
  const failure=harness({fakeOptions:{failPutKey:'state'}});await assert.rejects(failure.storage.write({}),code('storage-quota-exceeded'));
  assert.equal(failure.events.length,0);assert.equal(h.events.length,1);
  h.c.RoadToGloryPersistence.beginRestore(journal);
  h.values.set('inazuma.cloud.restoreJournal.restore-user',JSON.stringify({...journal,stage:'rtg'}));h.c.PersistenceRecoveryGuard.bindUid(journal.uid);
  await h.storage.write({tokens:6},'state',{restoreOwnershipToken:journal.operationId});
  assert.equal(h.events.filter(e=>e.type==='inazuma:local-save-committed').length,1);
});
test('expected generation rejects stale explicit writes even after restore completes',async()=>{
  const h=harness();assert.ok(h.c.RoadToGloryPersistence,'persistent RTG runtime required');const token=h.c.RoadToGloryPersistence.capture();
  h.c.RoadToGloryPersistence.beginRestore(journal);h.c.RoadToGloryPersistence.completeRestore(journal);
  for(const action of [()=>h.storage.write({},'state',{expectedRtgGeneration:token}),()=>h.storage.update(()=>({}),'state',{expectedRtgGeneration:token}),()=>h.storage.updateMany(['state'],()=>({writes:{state:{}},value:null}),{expectedRtgGeneration:token}),()=>h.storage.remove('state',{expectedRtgGeneration:token})])await assert.rejects(action(),code('rtg-stale-runtime'));
});
test('repository preserves marked raw squads and null-campaign backups without granting coaches',async()=>{
  const h=harness(),S=h.c.RoadToGloryState;
  const squads={ie1:{formationId:'4-4-2',lineup:['free_agents::hero'],bench:[],coachId:'36',coachPowerSelections:{unowned:'kept'},activeRoleVariantByCardId:{},extraLocal:{value:3}}};
  const raw={...S.createInitial({campaignSeed:'restored'}),squads,localSquadsPreserved:true,coachOwnedIds:[]};
  await h.storage.write(raw);await h.storage.write({tokens:0,gachaAcquiredCards:[],developmentByCardId:{},coachOwnedIds:[]},'shared:account');
  const repo=h.c.RoadToGloryRepository.create({storage:h.storage,seedFactory:()=> 'fresh'});
  for(const state of [await repo.read(),await repo.ensureCampaign(),await repo.update('noop',s=>s)]){
    assert.deepEqual(JSON.parse(JSON.stringify(state.squads)),squads);assert.equal(state.localSquadsPreserved,true);assert.deepEqual(Array.from(state.coachOwnedIds),[]);
  }
  for(const campaignId of ['rtg-ie-trilogy','rtg-ares-orion']){
    repo.selectCampaign(campaignId);const key=campaignId==='rtg-ie-trilogy'?'state':`state:${campaignId}`;
    await h.storage.write(null,key);await h.storage.write(squads,`local:squads:${campaignId}`);
    const created=await repo.ensureCampaign();assert.deepEqual(JSON.parse(JSON.stringify(created.squads)),squads);assert.equal(created.localSquadsPreserved,true);
    await h.storage.write(null,key);const updated=await repo.update('init',s=>s);assert.deepEqual(JSON.parse(JSON.stringify(updated.squads)),squads);assert.equal(updated.campaignSeed,'fresh');
  }
});
test('cross-tab restore aborts staged puts before transaction completion',async()=>{
  const h=harness(),other=harness({values:h.values});await h.storage.write({tokens:1});
  const db=await h.storage.open(),transaction=db.transaction.bind(db);let inject=true;
  db.transaction=(...args)=>{
    const tx=transaction(...args),objectStore=tx.objectStore.bind(tx);
    tx.objectStore=(...args)=>{const store=objectStore(...args),put=store.put;return {...store,put:(...args)=>{
      const result=put(...args);
      if(inject){inject=false;queueMicrotask(()=>{other.c.RoadToGloryPersistence.beginRestore(journal);other.c.RoadToGloryPersistence.completeRestore(journal);h.c.dispatchEvent({type:'storage'});});}
      return result;
    }};};return tx;
  };
  await assert.rejects(h.storage.write({tokens:9}),code('rtg-stale-runtime'));
  assert.equal((await h.storage.read()).tokens,1);
  assert.equal(h.events.filter(e=>e.type==='inazuma:local-save-committed').length,1);
});
test('a guard becoming blocked during a pending put aborts the transaction',async()=>{
  const h=harness();await h.storage.write({tokens:1});const db=await h.storage.open(),transaction=db.transaction.bind(db);
  db.transaction=(...args)=>{
    const tx=transaction(...args),objectStore=tx.objectStore.bind(tx);
    tx.objectStore=(...args)=>{const store=objectStore(...args),put=store.put;return {...store,put:(...args)=>{
      queueMicrotask(()=>h.c.PersistenceRecoveryGuard.setBlocked({operationId:'blocked'}));return put(...args);
    }};};return tx;
  };
  await assert.rejects(h.storage.update(()=>({tokens:9})),code('restore-recovery-required'));
  assert.equal((await h.storage.read()).tokens,1);
});
test('failed delete stays silent and preserves data',async()=>{
  const options={},h=harness({fakeOptions:options});await h.storage.write({tokens:1});
  options.writeError=Object.assign(new Error('denied'),{name:'SecurityError',code:18});
  await assert.rejects(h.storage.remove(),code('storage-access-error'));
  assert.equal((await h.storage.read()).tokens,1);assert.equal(h.events.length,1);
});
test('write APIs retain promise rejection and operation-specific storage errors',async()=>{
  const h=harness();await assert.rejects(()=>h.storage.updateMany([],()=>({})),e=>e.name==='TypeError');
  for(const [name,mutate] of Object.entries(mutations)){
    const failure=harness({fakeOptions:{writeError:new Error('disk failure')}});
    const expected=name==='write'?'rtg-indexeddb-write-failed':name==='remove'?'rtg-indexeddb-delete-failed':name==='update'?'rtg-indexeddb-read-failed':'rtg-indexeddb-update-failed';
    await assert.rejects(mutate(failure.storage),code(expected));
  }
});
test('runtime reserve rejects an explicit stale generation without reserving a mutation',()=>{
  const h=harness(),runtime=h.c.RoadToGloryPersistence,token=runtime.capture();
  runtime.beginRestore(journal);runtime.completeRestore(journal);
  const before=h.c.PersistenceRecoveryGuard.readEpoch();
  assert.throws(()=>runtime.reserve({expectedRtgGeneration:token}),code('rtg-stale-runtime'));
  assert.equal(h.c.PersistenceRecoveryGuard.readEpoch(),before);
});
