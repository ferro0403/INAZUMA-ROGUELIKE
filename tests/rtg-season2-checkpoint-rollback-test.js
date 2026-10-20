"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const ctx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,structuredClone:o=>JSON.parse(JSON.stringify(o))};ctx.globalThis=ctx;vm.createContext(ctx);
for(const p of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-progression.js"])vm.runInContext(fs.readFileSync(p,"utf8"),ctx);
const P=ctx.RoadToGloryProgression;P.setSeasonContext("ie1_s2");
let s={activeSeasonId:"ie1_s2",currentNodeId:"main:secret_service",defeatedTeamIds:[],firstClearMatchIds:[],tokens:0,lives:2,checkpointMainIndex:-1,attemptsByNode:{},seasonComplete:false,furthestNodeIndex:0};
const teams=ctx.RoadToGloryConfig.SEASON2.mainTeams;
for(let i=0;i<3;i++){s.currentNodeId="main:"+teams[i];s=P.recordMainVictory(s,{teamId:teams[i],matchId:"m"+i});}
assert.strictEqual(s.checkpointMainIndex,2);
assert.strictEqual(s.lives,2);
s.currentNodeId="main:"+teams[3];s=P.recordMainLoss(s,{nodeId:s.currentNodeId});assert.strictEqual(s.lives,1);
s=P.recordMainLoss(s,{nodeId:s.currentNodeId});assert.strictEqual(s.lives,2);
assert.strictEqual(s.currentNodeId,"secondary:"+teams[2]+":"+teams[3]+":1");
for(let i=3;i<6;i++){s.currentNodeId="main:"+teams[i];s=P.recordMainVictory(s,{teamId:teams[i],matchId:"m"+i});}
assert.strictEqual(s.checkpointMainIndex,5);
console.log("rtg-season2-checkpoint-rollback-test: PASS");
