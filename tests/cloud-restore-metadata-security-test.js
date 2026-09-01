'use strict';
const assert=require('assert'),P=require('../js/cloud-restore-protocol'),Metadata=require('../js/cloud-local-metadata'),B=require('./helpers/budget-storage'),{load}=require('./helpers/production-runtime');
const clone=value=>JSON.parse(JSON.stringify(value));
(async()=>{
 const storage=new B(),runtime=load(storage),uid='u',journalKey=`inazuma.cloud.restoreJournal.${uid}`,metadataKey='metadata';
 const run=runtime.RunState.createRun({name:'Local'},'ie1');run.bossIndex=4;run.inventory=[{id:'local'}];runtime.RunState.save(run);const before=JSON.stringify(runtime.RunState.load('ie1',{readOnly:true}));
 let journal=P.createJournal({operationId:'o',uid,targetCloudRevision:1,targetCloudCommitId:'c1',targetManifestIdentity:'i',sourceLocalEpoch:0,expectedLocalEpoch:0,startedAt:'n'});journal={...journal,runProgress:{ie1:{status:'pending'}},sourceRunProvenance:{ie1:{generation:9}}};storage.setItem(journalKey,JSON.stringify(journal));runtime.PersistenceRecoveryGuard.bindUid(uid);
 const target={profile:{teamIdentity:{name:'Cloud'}},runs:{ie1:{runId:'cloud-must-be-ignored'}},album:{unlocked:['p1']},development:{coins:42},hallOfFame:{teams:[]}};
 const local={profile:{},album:{},development:{},hallOfFame:{}};const applications={profile:0,album:0,development:0,hall:0};let blocked=true;
 const adapters={assertOwnership(active){runtime.PersistenceRecoveryGuard.assertWritable({restoreOwnershipToken:active.operationId})},storeEquals(name,t){const key=name==='hall'?'hallOfFame':name;return JSON.stringify(local[key])===JSON.stringify(t[key])},applyStore(name,t){const key=name==='hall'?'hallOfFame':name;local[key]=clone(t[key]);applications[name]++},verify(){return ['profile','album','development','hall'].every(name=>{const key=name==='hall'?'hallOfFame':name;return JSON.stringify(local[key])===JSON.stringify(target[key])})},writeMetadata(){return Metadata.read(storage,metadataKey,uid,'d')}};
 const args={journal,loadTarget:async()=>({snapshot:target,manifest:{revision:1}}),writeJournal:j=>(storage.setItem(journalKey,JSON.stringify(j)),j),clearJournal:()=>storage.removeItem(journalKey),adapters,onBlocked:()=>blocked=true,onComplete:()=>blocked=false};
 storage.fail={method:'getItem',key:metadataKey};await assert.rejects(P.recover(args),e=>e.code==='storage-access-error');storage.fail=null;
 assert(storage.getItem(journalKey),'metadata failure preserves account journal');assert.equal(blocked,true);assert.deepStrictEqual(applications,{profile:1,album:1,development:1,hall:1});assert.equal(JSON.stringify(runtime.RunState.load('ie1',{readOnly:true})),before);
 const playable=runtime.RunState.load('ie1',{readOnly:true});playable.bossIndex=5;runtime.RunState.save(playable);assert.equal(runtime.RunState.load('ie1',{readOnly:true}).bossIndex,5,'account journal cannot block RunStorage');
 adapters.writeMetadata=()=>Metadata.write(storage,metadataKey,{uid,deviceId:'d',status:'associated',revision:1});const result=await P.recover({...args,journal:JSON.parse(storage.getItem(journalKey))});
 assert.equal(result.status,'restored');assert.equal(storage.getItem(journalKey),null);assert.equal(blocked,false);assert.deepStrictEqual(applications,{profile:1,album:1,development:1,hall:1},'retry is idempotent');assert.equal(runtime.RunState.load('ie1',{readOnly:true}).bossIndex,5);assert.equal(runtime.RunState.load('ie1',{readOnly:true}).inventory[0].id,'local');
 console.log('restore metadata failure preserves journal, permanent idempotence and local run playability: ok');
})().catch(e=>{console.error(e);process.exit(1)});
