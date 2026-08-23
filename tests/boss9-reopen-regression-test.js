"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm"),data=require("../data/IE1_season_compact.json");
class Storage{constructor(values=new Map()){this.values=values;}getItem(k){return this.values.has(k)?this.values.get(k):null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
const shared=new Map();
function runtime(){const c={console,localStorage:new Storage(shared),Date,Math,JSON,SEASON1_CONFIG:{saveKey:"run",saveVersion:2,startingLives:2,maxRunLives:2,legacySaveKeys:["old-run"]},SeasonRegistry:{normalizeSeasonId:()=>"ie1",activeId:()=>"ie1",list:()=>[{id:"ie1"}]},DevelopmentV2:{read:()=>({players:{}})},dispatchEvent(){},CustomEvent:class{}};c.globalThis=c;vm.runInNewContext(fs.readFileSync("js/run-state.js","utf8"),c);vm.runInNewContext(fs.readFileSync("js/boss-gameover-runtime.js","utf8"),c);return c;}
const index=8,boss=data.bossOrder[index];assert.ok(boss);
let api=runtime(),run=api.RunState.createRun({name:"Raimon"},"ie1");
const previous=data.bossOrder.slice(0,index).map(x=>String(x.teamId));Object.assign(run,{lives:2,bossIndex:index,completedBossIds:previous,unlockedTeamIds:[...previous],roster:[{playerId:"starter"}],phase:"map",statistics:{},currentZone:{bossIndex:index,currentNodeId:"boss9",nodes:[],completedNodeIds:[]},postBossFlow:{status:"reward",bossIndex:index,matchNodeId:"boss9",remainingRewards:2,rewardNumber:1,excludedIds:[],rerolls:0,candidateIds:[]},pendingBossVictory:{bossIndex:index,bossId:String(boss.teamId),rewardsRemaining:2,excludedIds:[],rerolls:0,candidateIds:[]}});
api.RunState.save(run);const before=run.storageGeneration,stalePrimary=shared.get("run:ie1");
// Production candidate, acquisition metadata, and advance boundaries used by app.js.
const rewardId=String(boss.rewardPoolPlayerIds[0]);
api.BossGameOverRuntime.prepareBossRewardCandidatesMutation({run,seasonDb:data,candidateIds:boss.rewardPoolPlayerIds.slice(0,3)});
api.BossGameOverRuntime.applyBossRewardPickMutation({run,playerId:rewardId,acquire:current=>{const entry={playerId:rewardId,recruitmentSource:"boss_reward"};current.roster=current.roster.concat(entry);return entry;}});
api.BossGameOverRuntime.advanceBossRewardMutation({run});
api.BossGameOverRuntime.prepareBossRewardCandidatesMutation({run,seasonDb:data,candidateIds:boss.rewardPoolPlayerIds.slice(3,6)});
api.BossGameOverRuntime.advanceBossRewardMutation({run});
api.BossGameOverRuntime.applyBossVictoryHandoffMutation({run,seasonDb:data,ensureCurrentZone:()=>{run.currentZone={bossIndex:run.bossIndex,currentNodeId:"zone-next",nodes:[],completedNodeIds:[]};},buildFinalization:()=>{throw Error("boss 9 is not final");}});
api.RunState.save(run);const after=run.storageGeneration;assert.ok(after>before);shared.set("run:ie1_backup",stalePrimary);shared.set("old-run",stalePrimary);
for(let reopen=1;reopen<=2;reopen++){api=runtime();run=api.RunState.load("ie1");assert.strictEqual(run.storageGeneration,after);assert.strictEqual(run.bossIndex,index+1);assert.strictEqual(run.completedBossIds.filter(id=>id===String(boss.teamId)).length,1);assert.strictEqual(run.roster.filter(p=>String(p.playerId)===rewardId).length,1);assert.strictEqual(run.postBossFlow,null);assert.strictEqual(run.lives,2);assert.strictEqual(run.currentZone.bossIndex,index+1);}
console.log(`boss9-reopen-regression-test: ${boss.teamName} (${boss.teamId}), index 8 / position 9, primary ${before}->${after} defeats stale backup on two real RunState loads`);
