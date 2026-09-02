"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const players=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"].map((position,i)=>({playerId:`p${i}`,name:`P${i}`,position,category:"Normale",overall:50,finalOverall:50,stats:{}}));
const seasonDb={seasonId:"ie1",players,formations:{eleven:[{id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}}]},bossOrder:[{teamId:"boss",teamName:"Boss",bossFormation:"4-3-3",bossLevel:1,startingXIPlayerIds:players.map(p=>p.playerId)}]};
function makeRun(type="random"){return {runId:"production-map",seasonId:"ie1",phase:"map",lives:3,bossIndex:0,completedBossIds:[],unlockedTeamIds:[],completedSpecialMatchIds:[],unlockedSpecialTeamIds:[],claimedSpecialMatchRewardIds:[],permanentEffectOutbox:[],roster:players.map(p=>({playerId:p.playerId,source:"ie1",level:0})),lineup:players.map(p=>p.playerId),bench:[],inventory:[],formationId:"4-3-3",teamIdentity:{name:"Raimon"},statistics:{},currentZone:{bossIndex:0,bossId:"boss",seed:"stable",currentNodeId:"start",startNodeId:"start",pendingNodeId:null,completedNodeIds:[],path:["start"],nodes:[{id:"start",type:"start",layer:0},{id:"node",type,layer:1}],edges:[["start","node"]]},activeMatch:null};}
const storage=new BudgetStorage(Infinity); const rt=load(storage,{run:makeRun(),seasonDb});
rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
let rng=0; rt.context.MapEngine.resolveRandomNodeType=(current,node)=>{rng+=1;node.revealedType="item";return "item";};
rt.seam.renderMap({persist:false}); rt.query('[data-node-id="node"]').click();
assert.equal(rt.canonical.currentZone.nodes[1].revealedType,"item"); assert.equal(rng,1); assert.equal(rt.canonical.currentZone.pendingNodeId,"node");
rt.destroy(); const reopened=load(storage,{fullRuntime:true,seasonId:"ie1",seasonDb}); reopened.context.RoguelikeRules.isProfileAwareRosterEntry = () => false; reopened.seam.resumePendingItemReward();
assert.equal(reopened.canonical.currentZone.nodes[1].revealedType,"item"); assert.equal(rng,1,"reopen does not reroll random node");
console.log("map node production path: random reveal is canonical and stable across reopen OK");
