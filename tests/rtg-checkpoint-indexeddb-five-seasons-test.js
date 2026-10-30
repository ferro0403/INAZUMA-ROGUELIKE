"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");
const {makeFakeIndexedDb}=require("./helpers/fake-indexeddb-atomic");

function load(){
  const c={console,Error,TypeError,Object,Array,String,Number,Promise,JSON,Math,RegExp,Set,Map};
  c.globalThis=c;
  c.SeasonRegistry={normalizeSeasonId:v=>String(v),player:()=>null};
  c.ProfiledSeasonRuntime={canonicalPlayerId:(_s,p)=>String(p)};
  vm.createContext(c);
  for(const path of [
    "js/road-to-glory/rtg-config.js",
    "js/road-to-glory/rtg-rng.js",
    "js/road-to-glory/rtg-card-identity.js",
    "js/road-to-glory/rtg-state.js",
    "js/road-to-glory/rtg-progression.js",
    "js/road-to-glory/rtg-storage.js",
    "js/road-to-glory/rtg-repository.js"
  ])vm.runInContext(fs.readFileSync(path,"utf8"),c,{filename:path});
  return c;
}
const c=load(),C=c.RoadToGloryConfig,P=c.RoadToGloryProgression;
const copy=x=>JSON.parse(JSON.stringify(x));
for(const sid of C.SEASON_IDS){
  test("RTG "+sid+": second defeat rewinds canonical IndexedDB to latest earned checkpoint; failed save leaves state unchanged",async()=>{
    const opts={},storage=c.RoadToGloryStorage.create({indexedDB:makeFakeIndexedDb(opts)});
    const createRepository=()=>{
      const repository=c.RoadToGloryRepository.create({
        storage,stateApi:c.RoadToGloryState,seedFactory:()=>sid+"-checkpoint-persistence-seed"
      });
      repository.selectCampaign(sid==="ie2"||sid==="orion"?"rtg-ares-orion":"rtg-ie-trilogy");
      return repository;
    };
    let repository=createRepository();
    await repository.ensureCampaign();
    const nodes=Array.from(C.buildSeasonNodes(sid));
    const target=nodes.find(n=>n.type==="main"&&n.mainIndex===4);
    const targetIndex=nodes.indexOf(target);
    const checkpoint=nodes.findIndex(n=>n.type==="main"&&n.mainIndex===2);
    const expectedResume=nodes[checkpoint+1].id;
    await repository.update("select-season",state=>{
      state.activeSeasonId=sid;
      state.seasonComplete=false;
      state.currentNodeId=nodes[0].id;
      state.lives=2;
      state.checkpointMainIndex=-1;
      state.defeatedTeamIds=[];
      state.attemptsByNode={};
      return state;
    });
    for(const node of nodes.slice(0,targetIndex)){
      await repository.update("advance-story",state=>{
        assert.equal(state.currentNodeId,node.id,"Story progression before "+node.id);
        return node.type==="main"
          ?P.recordMainVictory(state,{teamId:node.teamId,matchId:"won:"+sid+":"+node.teamId})
          :P.recordSecondaryResult(state,{nodeId:node.id,result:"victory",attemptNumber:1});
      });
    }
    const before=await repository.read();
    assert.equal(before.currentNodeId,target.id);
    assert.equal(before.checkpointMainIndex,2);
    assert.equal(before.lives,2);
    const preserved={
      tokens:before.tokens,
      defeatedTeamIds:copy(before.defeatedTeamIds),
      firstClearMatchIds:copy(before.firstClearMatchIds),
      attemptsByNode:copy(before.attemptsByNode)
    };

    await repository.update("first-defeat",state=>P.recordMainLoss(state,{nodeId:target.id}));
    repository=createRepository(); // simulate reload / a new controller against same IndexedDB
    const first=await repository.read();
    assert.equal(first.lives,1);
    assert.equal(first.currentNodeId,target.id,"First defeat must allow replay of same match");

    // The second loss should roll back even if old metadata has a stale index.
    await repository.update("legacy-checkpoint-index",state=>{state.checkpointMainIndex=-1;return state;});
    await repository.update("second-defeat",state=>P.recordMainLoss(state,{nodeId:target.id}));
    repository=createRepository();
    const restored=await repository.read();
    assert.equal(restored.lives,2);
    assert.equal(restored.checkpointMainIndex,2);
    assert.equal(restored.currentNodeId,expectedResume,"Must resume after earned checkpoint, not at failed boss");
    for(const [key,value] of Object.entries(preserved))
      assert.deepEqual(copy(restored[key]),copy(value),"Checkpoint rollback must retain "+key);

    // Losing on the secondary immediately after checkpoint consumes a life.
    // Inject a real transaction abort before the second loss and verify no partial save.
    const secondary=nodes[checkpoint+1];
    if(secondary?.type==="secondary"){
      await repository.update("first-secondary-defeat",state=>P.recordSecondaryResult(state,{
        nodeId:secondary.id,result:"loss",attemptNumber:2
      }));
      const beforeFailure=await repository.read();
      assert.equal(beforeFailure.lives,1);
      opts.writeError=Object.assign(new Error("quota"),{name:"QuotaExceededError"});
      await assert.rejects(
        repository.update("failed-checkpoint-rewind",state=>P.recordSecondaryResult(state,{
          nodeId:secondary.id,result:"loss",attemptNumber:3
        })),error=>error.code==="storage-quota-exceeded"
      );
      delete opts.writeError;
      repository=createRepository();
      const afterFailure=await repository.read();
      assert.deepEqual(copy(afterFailure),copy(beforeFailure),
        "Failed atomic write must not consume second life or change checkpoint");
      await repository.update("retry-secondary-defeat",state=>P.recordSecondaryResult(state,{
        nodeId:secondary.id,result:"loss",attemptNumber:3
      }));
      const afterRetry=await repository.read();
      assert.equal(afterRetry.lives,2);
      assert.equal(afterRetry.currentNodeId,expectedResume);
    }
  });
}
