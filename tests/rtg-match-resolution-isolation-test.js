"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-ai-policy.js","js/road-to-glory/rtg-penalty-runtime.js","js/road-to-glory/rtg-match-engine.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryMatchEngine,R=c.RoadToGloryRng;
const p=(id,role,overall)=>({playerId:id,name:id,normalizedRole:role,position:role,overall,attack:overall,control:overall,speed:overall,grit:overall,physical:overall,stamina:overall,defense:overall,save:overall,element:"Wind"});
const strong=p("u1","MF",99),weak=p("o1","DF",1);
let seed="";for(let i=0;i<1000;i++){const s="isolation-"+i;if(R.float(s,"encounter-result:e1",0)<.9){seed=s;break;}}assert(seed);
const base={
 matchId:"m",seed,period:"second_half",status:"active",result:null,actionTarget:30,firstHalfTarget:15,manualTarget:14,
 manualIndexes:[5,8],actionIndex:5,extraActionIndex:0,manualResolved:0,
 score:{user:0,opponent:0},possession:"user",fieldZone:"shot",
 userSquad:{lineup:[strong],bench:[]},opponentSquad:{lineup:[weak],bench:[]},
 userRosterIds:["u1"],moveUsesByPlayerId:{},recentParticipants:[],log:[],shootout:null,
 pendingEncounter:{encounterId:"e1",kind:"dribble",actorKind:"dribble",opponentKind:"defense",actorSide:"user",opponentSide:"opponent",actorPlayerId:"u1",opponentPlayerId:"o1",userSide:"user",userPlayerId:"u1",userKind:"dribble",userBaseActionLabel:"Dribbling",userMove:null,aiSide:"opponent",aiPlayerId:"o1",aiKind:"defense",aiChoice:"base",aiMove:null}
};
const resolved=E.resolvePendingEncounter(JSON.parse(JSON.stringify(base)),"base");
assert.strictEqual(resolved.log.length,1,"a manual duel must stay isolated until Continue");
assert.strictEqual(resolved.log[0].kind,"dribble");
assert.deepStrictEqual(JSON.parse(JSON.stringify(resolved.score)),{user:0,opponent:0},"dribbling can never increment the score");
assert.strictEqual(resolved.pendingEncounter,null);
assert.strictEqual(resolved.fieldZone,"shot","winning an attacking dribble advances to the shot zone");
const continued=E.prepareNext(resolved);
assert(continued.log.length>=1,"automatic flow may continue only after explicit continue");

const shot={...JSON.parse(JSON.stringify(base)),fieldZone:"shot",score:{user:0,opponent:0},actionIndex:6,log:[],pendingEncounter:{...base.pendingEncounter,encounterId:"e2",kind:"shot",actorKind:"shot",opponentKind:"save",userKind:"shot",userBaseActionLabel:"Tiro"}};
let shotSeed="";for(let i=0;i<1000;i++){const s="shot-"+i;if(R.float(s,"encounter-result:e2",0)<.9){shotSeed=s;break;}}shot.seed=shotSeed;
const goal=E.resolvePendingEncounter(shot,"base");
assert.strictEqual(goal.log.length,1);
assert.strictEqual(goal.log[0].kind,"shot");
assert.strictEqual(goal.score.user,1,"only a won shot duel increments the score");
console.log("rtg-match-resolution-isolation-test: PASS");
