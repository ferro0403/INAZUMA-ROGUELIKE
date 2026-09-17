"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const {makeFakeIndexedDb}=require("./helpers/fake-indexeddb-lite");
function load(fake){
  const c={globalThis:null,window:null,console,Error,TypeError,Object,Array,String,Number,Promise,JSON,Math,RegExp,Set,Map,indexedDB:fake};
  c.globalThis=c;c.window=c;vm.createContext(c);
  for(const file of[
    "js/road-to-glory/rtg-storage.js",
    "js/road-to-glory/rtg-state.js",
    "js/road-to-glory/rtg-repository.js",
    "js/road-to-glory/rtg-controller.js"
  ]) vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
  return c;
}
function appStub(){return{innerHTML:"",querySelector:()=>null,querySelectorAll:()=>[]};}
(async()=>{
  const options={};
  const fake=makeFakeIndexedDb(options);
  const c=load(fake);
  const storage=c.RoadToGloryStorage.create({indexedDB:fake});
  let seedN=0;
  const repo=c.RoadToGloryRepository.create({storage,stateApi:c.RoadToGloryState,seedFactory:()=>`seed-${++seedN}`});
  await repo.ensureCampaign();
  const ids=Array.from({length:15},(_,i)=>String(i+1));
  const lineup=ids.slice(0,11),bench=ids.slice(11,15);
  const activeMatch={
    matchId:"persisted-match",nodeId:"secondary:occult:wild:1",matchType:"secondary",attemptNumber:3,
    seed:"fixed-match-seed",period:"first_half",status:"active",actionTarget:24,firstHalfTarget:12,manualTarget:18,
    manualIndexes:[0,1,2,3,4,5,7,8,9,10,11,12,13,14,16,18,20,22],actionIndex:5,extraActionIndex:0,manualResolved:4,
    score:{user:1,opponent:0},possession:"user",fieldZone:"attack",
    userSquad:{formationId:"4-3-3",lineup:[],bench:[]},
    opponentSquad:{formationId:"4-4-2",lineup:[{playerId:"fa-a"}],bench:[]},
    userRosterIds:[],moveUsesByPlayerId:{"user:1":1},pendingEncounter:{encounterId:"e1",userPlayerId:"1",opponentPlayerId:"fa-a"},
    recentParticipants:["1","fa-a"],log:[{encounterId:"e0"}],shootout:null,result:null
  };
  await repo.update("seed-active-match",state=>{
    state.squads.ie1={formationId:"4-3-3",lineup,bench,activeRoleVariantByPlayerId:{}};
    state.activeMatch=activeMatch;
    return state;
  });
  let generatorCalls=0;
  let renderedMatch=null;
  const seasonDb={formations:{eleven:[{id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}}]},teams:[],players:[],bossOrder:[]};
  const freeDb={players:ids.map((id,i)=>({playerId:id,position:i===0?"GK":i<5?"DF":i<8?"MF":"FW",normalizedRole:i===0?"GK":i<5?"DF":i<8?"MF":"FW",finalOverall:75}))};
  const controller=c.RoadToGloryController.create({
    app:appStub(),repository:repo,
    runView:{lockedMarkup:()=>"<locked>",runMarkup:()=>"<run>",requirementsMarkup:()=>"",vendingMarkup:()=>"",pullResultMarkup:()=>""},
    squadView:{renderModel:()=>({}),markup:()=>"<squad>",bind:()=>{}},
    matchView:{
      matchMarkup:match=>{renderedMatch=JSON.parse(JSON.stringify(match));return `<match>${match.matchId}</match>`;},
      encounterMarkup:()=>"<duel>",halftimeMarkup:()=>"<half>",penaltyMarkup:()=>"<pen>",resultMarkup:()=>"<result>",bind:()=>{}
    },
    ensureSeason1Db:async()=>seasonDb,getFreeAgentsDb:()=>freeDb,getAlbumProgress:()=>({read:()=>({sharedUnlockedPlayerIds:Object.fromEntries(ids.map(id=>[id,{}]))})}),
    openModal:()=>{},closeModal:()=>{},toast:()=>{},renderHome:()=>{},resetRenderedViewScroll:()=>{},
    entitlements:{accessStatus:()=>({unlocked:true,count:15,formationIds:["4-3-3"]}),unlockedFreeAgentIds:()=>ids},
    config:{buildSeasonNodes:()=>[],SEASON1:{}},
    squadRuntime:{accessiblePlayerIds:({freeAgentIds})=>freeAgentIds,validateSquad:()=>({valid:true})},
    gacha:{},progression:{},matchEngine:{},
    opponentGenerator:{generate:()=>{generatorCalls++;throw new Error("must not reroll persisted opponent");}},
    playerResolver:{resolveAtLevel20:()=>null,resolveMove:()=>null},rng:{},aiPolicy:{},penaltyRuntime:{}
  });
  await controller.open();
  assert.strictEqual(generatorCalls,0);
  assert.strictEqual(renderedMatch.matchId,"persisted-match");
  assert.deepStrictEqual(renderedMatch.score,{user:1,opponent:0});
  assert.strictEqual(renderedMatch.actionIndex,5);
  assert.deepStrictEqual(renderedMatch.moveUsesByPlayerId,{"user:1":1});
  assert.deepStrictEqual(renderedMatch.opponentSquad,activeMatch.opponentSquad);
  assert.deepStrictEqual((await repo.read()).activeMatch,activeMatch);

  await repo.update("seed-economy",state=>{state.tokens=300;state.gacha.pullCount=0;state.gachaAcquiredPlayerIds=[];return state;});
  const before=await repo.read();
  options.writeError=Object.assign(new Error("quota"),{name:"QuotaExceededError"});
  await assert.rejects(repo.update("atomic-failure",state=>{state.tokens-=300;state.gacha.pullCount+=1;state.gachaAcquiredPlayerIds.push("new-player");return state;}),e=>e.code==="storage-quota-exceeded");
  delete options.writeError;
  const after=await repo.read();
  assert.strictEqual(after.tokens,before.tokens);
  assert.strictEqual(after.gacha.pullCount,before.gacha.pullCount);
  assert.deepStrictEqual(after.gachaAcquiredPlayerIds,before.gachaAcquiredPlayerIds);
  console.log("rtg-active-match-reopen-e2e-test: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
