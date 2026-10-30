"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");
const {makeFakeIndexedDb}=require("./helpers/fake-indexeddb-atomic");

const ctx={console,Error,TypeError,Math,JSON,Array,Object,String,Number,Promise,Set,Map,RegExp};
ctx.globalThis=ctx;
ctx.SeasonRegistry={
  normalizeSeasonId:s=>String(s),
  player:()=>null,
  loadDatabase:async seasonId=>({seasonId,players:[],profiles:[]})
};
ctx.ProfiledSeasonRuntime={canonicalPlayerId:(_sid,p)=>String(p)};
vm.createContext(ctx);
for(const path of [
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-state.js",
  "js/road-to-glory/rtg-progression.js",
  "js/road-to-glory/rtg-storage.js",
  "js/road-to-glory/rtg-repository.js",
  "js/road-to-glory/rtg-season-transition-controller.js"
])vm.runInContext(fs.readFileSync(path,"utf8"),ctx,{filename:path});

const C=ctx.RoadToGloryConfig;
const P=ctx.RoadToGloryProgression;
const clone=o=>JSON.parse(JSON.stringify(o));
const journeys=[
  {campaignId:"rtg-ares-orion",seasonIds:["ie2","orion"]},
  {campaignId:"rtg-ie-trilogy",seasonIds:["ie1","ie1_s2","ie1_s3"]}
];

for(const {campaignId,seasonIds} of journeys){
  test(campaignId+": complete every Season, restart, then two early losses MUST NOT inherit an old checkpoint",async()=>{
    const opts={};
    const storage=ctx.RoadToGloryStorage.create({indexedDB:makeFakeIndexedDb(opts)});
    const createRepo=()=>{
      const repo=ctx.RoadToGloryRepository.create({
        storage,stateApi:ctx.RoadToGloryState,seedFactory:()=>campaignId+"-replay-seed"
      });
      repo.selectCampaign(campaignId);
      return repo;
    };
    let repo=createRepo();
    await repo.ensureCampaign();
    await repo.update("seed-permanent-collection",state=>{
      state.tokens=357;
      state.gachaAcquiredCards=[ctx.RoadToGloryCardIdentity.record({
        playerId:"2214",legacySeasonId:"free_agents"
      })];
      return state;
    });
    let current=await repo.read();
    const transition=ctx.RoadToGlorySeasonTransitionController.create({
      getCampaign:()=>current,
      activeSeasonId:()=>current.activeSeasonId,
      id:String,config:C,clone,
      repository:{update:async(label,mutator)=>{
        repo=createRepo();
        current=await repo.update(label,mutator);
        return current;
      }},
      applyTransition:payload=>{current=payload.campaign;},
      renderRun:()=>current
    });
    const read=async()=>{repo=createRepo();current=await repo.read();return current;};
    const update=async(label,mutator)=>{
      repo=createRepo();
      current=await repo.update(label,mutator);
      return current;
    };
    async function winNode(node){
      await update("win-"+node.id,state=>{
        assert.equal(state.currentNodeId,node.id,"Wrong route node before victory: "+node.id);
        return node.type==="main"
          ?P.recordMainVictory(state,{teamId:node.teamId,matchId:"rtg:"+node.id+":1"})
          :P.recordSecondaryResult(state,{nodeId:node.id,result:"victory",attemptNumber:1});
      });
    }
    async function finishRemaining(seasonId){
      const nodes=Array.from(C.buildSeasonNodes(seasonId));
      while(!current.seasonComplete){
        const node=nodes.find(x=>x.id===current.currentNodeId);
        assert(node,"Unknown current node in "+seasonId);
        await winNode(node);
      }
      assert.equal(current.seasonComplete,true);
      assert.equal(current.checkpointMainIndex,C.season(seasonId).checkpointMainIndexes.at(-1));
    }
    async function finishCampaign(){
      for(let seasonIdx=0;seasonIdx<seasonIds.length;seasonIdx++){
        const sid=seasonIds[seasonIdx];
        assert.equal(current.activeSeasonId,sid);
        await finishRemaining(sid);
        if(seasonIdx<seasonIds.length-1){
          await transition.enterNextSeason();
          await read(); // reload same IndexedDB as a new browser controller
          assert.equal(current.activeSeasonId,seasonIds[seasonIdx+1]);
          assert.equal(current.checkpointMainIndex,-1,"Checkpoint MUST reset on next Season");
          assert.equal(current.currentNodeId,C.buildSeasonNodes(current.activeSeasonId)[0].id);
          assert.equal(current.furthestNodeIndex,0);
          assert.deepEqual(clone(current.firstClearMatchIds),[]);
          assert.deepEqual(clone(current.defeatedTeamIds),[]);
        }
      }
    }

    // Two full replays ensure that a previous pass through Orion / Season 3
    // never contaminates the next Ares / Season 1.
    for(let replay=1;replay<=2;replay++){
      await finishCampaign();
      const previous=await read();
      assert(previous.checkpointMainIndex>=0);
      assert(previous.firstClearMatchIds.length>0);
      const savedCards=clone(previous.gachaAcquiredCards);
      const savedTokens=previous.tokens;
      const savedSeed=previous.campaignSeed;
      const permanentRewards=clone(previous.seasonTransitionRewardedIds);
      const oldCheckpoint=previous.checkpointMainIndex;
      assert(oldCheckpoint>=2);
      await transition.restartCompletedCampaign();
      await read();
      const firstId=seasonIds[0],nodes=Array.from(C.buildSeasonNodes(firstId));
      assert.equal(current.activeSeasonId,firstId);
      assert.equal(current.currentNodeId,nodes[0].id);
      assert.equal(current.lives,2);
      assert.equal(current.checkpointMainIndex,-1);
      assert.equal(current.furthestNodeIndex,0);
      assert.deepEqual(clone(current.defeatedTeamIds),[]);
      assert.deepEqual(clone(current.firstClearMatchIds),[]);
      assert.deepEqual(clone(current.attemptsByNode),{});
      assert.equal(current.seasonComplete,false);
      assert.equal(current.activeMatch,null);
      assert.deepEqual(clone(current.gachaAcquiredCards),savedCards);
      assert.equal(current.tokens,savedTokens);
      assert.equal(current.campaignSeed,savedSeed);
      assert(new Set(current.seasonTransitionRewardedIds).size===current.seasonTransitionRewardedIds.length);
      for(const oldReward of permanentRewards)
        assert(current.seasonTransitionRewardedIds.includes(oldReward),"Permanent payment record erased");

      // Entering RTG again must NOT perform automatic checkpoint recovery
      // based on the completed previous cycle.
      const reopened=P.repairCheckpointPosition(current);
      assert.strictEqual(reopened,current,"New run falsely treated as damaged old save");

      await update("new-run-first-loss",state=>P.recordMainLoss(state,{nodeId:nodes[0].id}));
      assert.equal(current.currentNodeId,nodes[0].id);
      assert.equal(current.lives,1);
      await read();
      await update("new-run-second-loss",state=>P.recordMainLoss(state,{nodeId:nodes[0].id}));
      assert.equal(current.currentNodeId,nodes[0].id,"Old "+oldCheckpoint+" checkpoint teleported the new run");
      assert.equal(current.lives,2);
      assert.equal(current.checkpointMainIndex,-1);
      assert.equal(current.furthestNodeIndex,0);

      // Even a secondary match after the first boss, with two defeats, must
      // send the player to the FIRST node rather than last run's last checkpoint.
      await winNode(nodes[0]);
      const firstSecondary=nodes.find(node=>node.type==="secondary");
      assert.equal(current.currentNodeId,firstSecondary.id);
      await update("new-run-secondary-first-loss",s=>P.recordSecondaryResult(s,{
        nodeId:firstSecondary.id,result:"loss",attemptNumber:1
      }));
      assert.equal(current.currentNodeId,firstSecondary.id);
      assert.equal(current.lives,1);
      await read();
      await update("new-run-secondary-second-loss",s=>P.recordSecondaryResult(s,{
        nodeId:firstSecondary.id,result:"loss",attemptNumber:2
      }));
      assert.equal(current.currentNodeId,nodes[0].id);
      assert.equal(current.checkpointMainIndex,-1);
      assert.equal(current.lives,2);
      assert.strictEqual(P.repairCheckpointPosition(current),current);

      // EARN a fresh checkpoint in THIS run and verify that it now works.
      const cpNodeIndex=nodes.findIndex(node=>node.type==="main"&&node.mainIndex===2);
      for(const node of nodes.slice(0,cpNodeIndex+1))await winNode(node);
      const freshResume=nodes[cpNodeIndex+1].id;
      assert.equal(current.currentNodeId,freshResume);
      assert.equal(current.checkpointMainIndex,2);
      await update("new-run-earned-checkpoint-first-loss",s=>P.recordSecondaryResult(s,{
        nodeId:freshResume,result:"loss",attemptNumber:3
      }));
      assert.equal(current.lives,1);
      assert.equal(current.currentNodeId,freshResume);
      await read();
      await update("new-run-earned-checkpoint-second-loss",s=>P.recordSecondaryResult(s,{
        nodeId:freshResume,result:"loss",attemptNumber:4
      }));
      assert.equal(current.currentNodeId,freshResume);
      assert.equal(current.lives,2);
      assert.equal(current.checkpointMainIndex,2);
      await read();
      assert.strictEqual(P.repairCheckpointPosition(current),current);
    }
  });
}
