"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={console};context.globalThis=context;
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),context);
context.RoadToGloryRng={weightedPick:items=>items[0],float:()=>0};
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-progression.js","utf8"),context);
const C=context.RoadToGloryConfig,P=context.RoadToGloryProgression;
const cases=[
  {id:"ie1",team:157,free:0,transition:0,extra:37,price:250,agent:null,post:750},
  {id:"ie1_s2",team:230,free:0,transition:1000,extra:41,price:200,agent:null,post:750},
  {id:"ie1_s3",team:296,free:288,transition:1000,extra:57,price:180,agent:90,post:1100},
  {id:"ie2",team:157,free:0,transition:0,extra:39,price:250,agent:null,post:750},
  {id:"orion",team:180,free:129,transition:1000,extra:41,price:200,agent:100,post:900},
];
for(const test of cases){
  const conf=C.season(test.id),nodes=Array.from(C.buildSeasonNodes(test.id));
  assert.strictEqual(conf.pullCost,test.price,test.id);
  assert.strictEqual(conf.recruitmentPullCost,test.agent,test.id);
  if(test.agent!==null)assert.strictEqual(conf.pullCost,conf.recruitmentPullCost*2,"Svincolati must cost exactly half");
  let state={activeSeasonId:test.id,campaignSeed:"balance",tokens:0,seasonComplete:false,lives:2,checkpointMainIndex:-1,currentNodeId:nodes[0].id,furthestNodeIndex:0,defeatedTeamIds:[],firstClearMatchIds:[],attemptsByNode:{}};
  const firstMain=nodes[0],firstSecondary=nodes.find(node=>node.type==="secondary"),lastSecondary=nodes.filter(node=>node.type==="secondary").at(-1);
  assert.strictEqual(C.rewardForNode(state,firstMain),350);
  assert.strictEqual(C.rewardForNode(state,firstSecondary),200);
  assert.strictEqual(C.rewardForNode({...state,seasonComplete:true},firstSecondary),200,"Early secondary farming must stay at 200");
  assert.strictEqual(C.rewardForNode({...state,seasonComplete:true},lastSecondary),test.post,"Only advanced post-game secondaries pay premium");
  for(const node of nodes){
    assert.strictEqual(state.currentNodeId,node.id,`Route stalled at ${test.id} ${node.id}`);
    const previousTokens=state.tokens,expectedReward=C.rewardForNode(state,node);
    state=node.type==="main"
      ?P.recordMainVictory(state,{teamId:node.teamId,matchId:`m-${node.teamId}`})
      :P.recordSecondaryResult(state,{nodeId:node.id,result:"victory",attemptNumber:1});
    const bonus=node===nodes.at(-1)?C.SEASON_COMPLETION_REWARD:0;
    assert.strictEqual(state.tokens-previousTokens,expectedReward+bonus,`Bad match reward: ${test.id} ${node.id}`);
  }
  assert.strictEqual(state.seasonComplete,true);
  const storyTokens=state.tokens+test.transition,collectionCost=test.team*test.price+test.free*(test.agent||0);
  const extra=Math.ceil(Math.max(0,collectionCost-storyTokens)/test.post);
  assert.strictEqual(extra,test.extra,`Incorrect extra-match estimate for ${test.id}`);
  const finalTeam=conf.mainTeams.at(-1),beforeReplay=state.tokens;
  state=P.recordMainVictory(state,{teamId:finalTeam,matchId:"replayed-final"});
  assert.strictEqual(state.tokens-beforeReplay,conf.mainRewards[finalTeam],"Never duplicate the first-clear completion bonus");
  const replayTokens=state.tokens;
  state=P.recordSecondaryResult(state,{nodeId:firstSecondary.id,result:"victory",attemptNumber:2});
  assert.strictEqual(state.tokens-replayTokens,200,"Old secondary never escalates when replayed after finale");
  const preAdvanced=state.tokens;
  state=P.recordSecondaryResult(state,{nodeId:lastSecondary.id,result:"victory",attemptNumber:2});
  assert.strictEqual(state.tokens-preAdvanced,test.post);
  const snapshot=JSON.stringify(state);
  assert.throws(()=>P.recordSecondaryResult(state,{nodeId:"secondary:invalid",result:"victory"}),/Unknown RTG secondary node/);
  assert.strictEqual(JSON.stringify(state),snapshot,"Invalid result must not mutate state");
}
console.log("rtg-season-rewards-balance-test: PASS");
