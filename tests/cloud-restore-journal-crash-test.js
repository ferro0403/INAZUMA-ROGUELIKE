'use strict';
const assert=require('assert'),P=require('../js/cloud-restore-protocol'),B=require('./helpers/budget-storage'),{load}=require('./helpers/production-runtime');
const points={prepared:'before:profile',profile:'after:profile',album:'after:album',development:'after:development',hall:'after:hall',verify:'after:verify',metadata:'after:metadata',complete:'after:complete'};
const clone=v=>JSON.parse(JSON.stringify(v));
(async()=>{for(const [label,point] of Object.entries(points)){
 const storage=new B(),runtime=load(storage),uid=`u-${label}`,key=`inazuma.cloud.restoreJournal.${uid}`;const run=runtime.RunState.createRun({name:'Local'},'ie1');run.bossIndex=2;run.inventory=[{id:'keep'}];runtime.RunState.save(run);
 let journal=P.createJournal({operationId:`op-${label}`,uid,targetCloudRevision:1,targetCloudCommitId:'c',targetManifestIdentity:'i',sourceLocalEpoch:0,expectedLocalEpoch:0,startedAt:'n'});storage.setItem(key,JSON.stringify(journal));runtime.PersistenceRecoveryGuard.bindUid(uid);
 const target={profile:{name:'cloud'},runs:{ie1:{runId:'ignored'}},album:{value:1},development:{value:2},hallOfFame:{teams:[{id:'h'}]}};const local={profile:{},album:{},development:{},hallOfFame:{}};const applied={profile:0,album:0,development:0,hall:0};let crashed=false;
 const adapters={assertOwnership(active){runtime.PersistenceRecoveryGuard.assertWritable({restoreOwnershipToken:active.operationId})},storeEquals(name,t){const k=name==='hall'?'hallOfFame':name;return JSON.stringify(local[k])===JSON.stringify(t[k])},applyStore(name,t){const k=name==='hall'?'hallOfFame':name;local[k]=clone(t[k]);applied[name]++},verify(){return true},writeMetadata(){}};
 const common={loadTarget:async()=>({snapshot:target,manifest:{revision:1}}),writeJournal:j=>(storage.setItem(key,JSON.stringify(j)),j),clearJournal:()=>storage.removeItem(key),adapters};
 await assert.rejects(P.recover({journal,...common,crash:stage=>{if(!crashed&&stage===point){crashed=true;throw Object.assign(Error(`crash:${label}`),{code:`crash:${label}`})}}}),e=>e.code===`crash:${label}`);
 assert(storage.getItem(key),`${label}: journal remains recoverable`);
 const playable=runtime.RunState.load('ie1',{readOnly:true});playable.bossIndex=3;runtime.RunState.save(playable);const runAfterLocalPlay=JSON.stringify(runtime.RunState.load('ie1',{readOnly:true}));
 const result=await P.recover({journal:JSON.parse(storage.getItem(key)),...common});assert.equal(result.status,'restored');assert.equal(storage.getItem(key),null);assert.equal(JSON.stringify(runtime.RunState.load('ie1',{readOnly:true})),runAfterLocalPlay,`${label}: retry never changes run`);
 for(const count of Object.values(applied))assert.ok(count<=1,`${label}: permanent store applied at most once`);
 assert.deepStrictEqual(Object.keys(local).sort(),['album','development','hallOfFame','profile']);
 }console.log('account-only restore journal crash matrix prepared/profile/album/development/hall/verify/metadata/complete: ok')})().catch(e=>{console.error(e);process.exit(1)});
