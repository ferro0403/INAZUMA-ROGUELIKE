"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");
const {makeFakeIndexedDb}=require("./helpers/fake-indexeddb-atomic");

const ctx={console,Error,TypeError,Math,JSON,Array,Object,String,Number,Promise,Set,Map,RegExp};
ctx.globalThis=ctx;
ctx.SeasonRegistry={normalizeSeasonId:x=>String(x),player:()=>null};
ctx.ProfiledSeasonRuntime={canonicalPlayerId:(_sid,p)=>String(p)};
vm.createContext(ctx);
for(const path of [
  "js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-card-identity.js","js/road-to-glory/rtg-state.js",
  "js/road-to-glory/rtg-progression.js","js/road-to-glory/rtg-storage.js",
  "js/road-to-glory/rtg-repository.js"
])vm.runInContext(fs.readFileSync(path,"utf8"),ctx,{filename:path});
const C=ctx.RoadToGloryConfig,P=ctx.RoadToGloryProgression;
const copy=value=>JSON.parse(JSON.stringify(value));

for(const sid of C.SEASON_IDS){
  test(sid+": an earned numeric checkpoint survives inconsistent legacy wins, reload and two defeats",async()=>{
    const options={},storage=ctx.RoadToGloryStorage.create({indexedDB:makeFakeIndexedDb(options)});
    const mkRepo=()=>{
      const repo=ctx.RoadToGloryRepository.create({
        storage,stateApi:ctx.RoadToGloryState,seedFactory:()=>sid+"-checkpoint-hardening"
      });
      repo.selectCampaign(sid==="ie2"||sid==="orion"?"rtg-ares-orion":"rtg-ie-trilogy");
      return repo;
    };
    let repo=mkRepo();
    await repo.ensureCampaign();
    const nodes=Array.from(C.buildSeasonNodes(sid)),cfg=C.season(sid);
    const start=nodes[0].id;
    const boss=nodes.find(node=>node.type==="main"&&node.mainIndex===4);
    const checkpoint=nodes.findIndex(node=>node.type==="main"&&node.mainIndex===2);
    const resume=nodes[checkpoint+1].id;
    await repo.update("seed-genuine-legacy-checkpoint",state=>{
      state.activeSeasonId=sid;state.currentNodeId=boss.id;
      state.furthestNodeIndex=nodes.indexOf(boss);
      state.checkpointMainIndex=2;state.lives=2;
      state.seasonComplete=false;state.defeatedTeamIds=[cfg.mainTeams[0]];state.firstClearMatchIds=[];
      state.tokens=12345;state.attemptsByNode={};
      return state;
    });
    const seed=await repo.read();
    const first=await repo.update("first-loss",s=>P.recordMainLoss(s,{nodeId:boss.id}));
    assert.equal(first.currentNodeId,boss.id,"First loss must keep the same match");
    assert.equal(first.lives,1);
    repo=mkRepo();
    const second=await repo.update("second-loss",s=>P.recordMainLoss(s,{nodeId:boss.id}));
    assert.equal(second.currentNodeId,resume,
      "Old save with an earned numeric checkpoint must NOT restart the Season");
    assert.equal(second.checkpointMainIndex,2);
    assert.equal(second.lives,cfg.livesPerCheckpoint);
    repo=mkRepo();
    const loaded=await repo.read();
    assert.equal(loaded.currentNodeId,resume);
    assert.equal(loaded.checkpointMainIndex,2);
    assert.equal(loaded.tokens,seed.tokens);
    assert.deepEqual(copy(loaded.gachaAcquiredCards),copy(seed.gachaAcquiredCards));
    assert.deepEqual(copy(loaded.developmentByCardId),copy(seed.developmentByCardId));

    // The old broken rollback can leave an existing save at the first node,
    // with checkpointMainIndex already overwritten to -1. The clear ledger
    // and furthest index allow a conservative one-transaction repair on reopen.
    await repo.update("seed-previously-broken-save",s=>{
      s.currentNodeId=start;s.checkpointMainIndex=-1;s.lives=1;
      s.furthestNodeIndex=nodes.indexOf(boss);
      s.defeatedTeamIds=cfg.mainTeams.slice(0,3);
      return s;
    });
    const stranded=await repo.read();
    assert.equal(P.repairCheckpointPosition(stranded).currentNodeId,resume);
    options.writeError=Object.assign(new Error("quota"),{name:"QuotaExceededError"});
    await assert.rejects(repo.update("failed-legacy-repair",s=>P.repairCheckpointPosition(s)),
      error=>error.code==="storage-quota-exceeded");
    delete options.writeError;
    repo=mkRepo();
    assert.deepEqual(copy(await repo.read()),copy(stranded),
      "Failed repair must not consume lives, move position or damage collection");
    const repaired=await repo.update("repair-after-reopen",s=>P.repairCheckpointPosition(s));
    assert.equal(repaired.currentNodeId,resume);
    assert.equal(repaired.checkpointMainIndex,2);
    assert.equal(repaired.lives,cfg.livesPerCheckpoint);
    assert.equal(repaired.tokens,seed.tokens);
    const healthy=await repo.read();
    assert.strictEqual(P.repairCheckpointPosition(healthy),healthy,
      "Healthy campaigns must not trigger extra writes");

    // A recorded first-clear match ID can repair a save whose old winner
    // list AND numeric checkpoint have both become incomplete.
    const journalOnly={...copy(healthy),
      currentNodeId:start,furthestNodeIndex:0,checkpointMainIndex:-1,
      defeatedTeamIds:[],firstClearMatchIds:[`rtg:main:${cfg.mainTeams[2]}:1`],
      lives:1,activeMatch:null};
    assert.equal(P.repairCheckpointPosition(journalOnly).currentNodeId,resume);

    // Cannot claim an unearned future checkpoint based on bogus metadata.
    const phantom={...copy(healthy),
      currentNodeId:start,furthestNodeIndex:0,
      checkpointMainIndex:cfg.checkpointMainIndexes.at(-1),
      defeatedTeamIds:[],firstClearMatchIds:[],lives:1};
    assert.strictEqual(P.repairCheckpointPosition(phantom),phantom);
    const defeated=P.recordMainLoss(phantom,{nodeId:start});
    assert.equal(defeated.currentNodeId,start);
    assert.equal(defeated.checkpointMainIndex,-1);
    assert.strictEqual(P.repairCheckpointPosition({...phantom,activeMatch:{matchId:"ongoing"}}).activeMatch.matchId,"ongoing");
    assert.strictEqual(P.repairCheckpointPosition({...phantom,seasonComplete:true}).seasonComplete,true);

    // Unlocking every boss via DEV must not cause a jump to a future checkpoint.
    const poolUnlocked={...copy(healthy),currentNodeId:boss.id,
      furthestNodeIndex:nodes.indexOf(boss),checkpointMainIndex:-1,
      defeatedTeamIds:cfg.mainTeams.slice(),firstClearMatchIds:[],lives:1};
    assert.equal(P.recordMainLoss(poolUnlocked,{nodeId:boss.id}).currentNodeId,resume);

    // Every later checkpoint, not just the first one, is a valid rewind target.
    for(const cpIndex of cfg.checkpointMainIndexes){
      const routeIndex=nodes.findIndex(n=>n.id==="main:"+cfg.mainTeams[cpIndex]);
      const next=nodes[routeIndex+1]?.id;
      if(!next)continue;
      const advanced={...copy(healthy),
        currentNodeId:nodes.at(-1).id,furthestNodeIndex:nodes.length-1,
        checkpointMainIndex:cpIndex,defeatedTeamIds:cfg.mainTeams.slice(0,cpIndex+1),
        firstClearMatchIds:[],seasonComplete:false,lives:1};
      assert.equal(P.recordMainLoss(advanced,{nodeId:advanced.currentNodeId}).currentNodeId,next,
        "Wrong checkpoint after boss "+(cpIndex+1));
    }
  });
}
