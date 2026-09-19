"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-ai-policy.js","js/road-to-glory/rtg-penalty-runtime.js","js/road-to-glory/rtg-match-engine.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryMatchEngine;
const p=(id,role,stats={})=>({playerId:id,name:id,normalizedRole:role,position:role,overall:80,attack:80,control:80,speed:80,grit:80,physical:80,stamina:80,defense:80,save:80,element:"Wind",...stats});
function squad(prefix){return{lineup:[p(prefix+"g","GK"),p(prefix+"d1","DF"),p(prefix+"d2","DF"),p(prefix+"d3","DF"),p(prefix+"d4","DF"),p(prefix+"m1","MF"),p(prefix+"m2","MF"),p(prefix+"m3","MF"),p(prefix+"f1","FW"),p(prefix+"f2","FW"),p(prefix+"f3","FW")],bench:[]};}

// A dribbler who has just broken into shooting range keeps the ball for the shot.
let continuity=E.createMatch({matchId:"continuity",seed:"continuity-seed",userSquad:squad("u"),opponentSquad:squad("o")});
continuity.firstHalfTarget=999;continuity.actionTarget=999;continuity.manualIndexes=Array.from({length:20},(_,i)=>i);
continuity.possession="user";continuity.fieldZone="shot";
continuity.log.push({kind:"dribble",actorWon:true,actorSide:"user",actorPlayerId:"uf2"});
continuity=E.prepareNext(continuity);
assert.strictEqual(continuity.pendingEncounter.kind,"shot");
assert.strictEqual(continuity.pendingEncounter.actorPlayerId,"uf2","successful dribbler should take the immediate shot");

// Winning a midfield duel still progresses normally; losing it creates a counterattack,
// not another neutral midfield exchange and never an instant shot.
let counter=E.createMatch({matchId:"counter",seed:"counter-seed",userSquad:squad("u"),opponentSquad:squad("o")});
counter.firstHalfTarget=999;counter.actionTarget=999;counter.manualIndexes=[0];counter.possession="user";counter.fieldZone="midfield";
counter=E.prepareNext(counter);assert.strictEqual(counter.pendingEncounter.kind,"midfield");
const pending=counter.pendingEncounter;
counter=E.resolvePendingEncounter(counter,"base");
const last=counter.log[counter.log.length-1];
if(last.actorWon){assert.strictEqual(counter.fieldZone,"attack");assert.strictEqual(counter.possession,pending.actorSide);}
else{assert.strictEqual(counter.fieldZone,"attack");assert.strictEqual(counter.possession,pending.opponentSide);}

// Role discipline: across many deterministic attacking selections, forwards dominate shots
// and defenders dominate defensive duels; out-of-role players remain possible but uncommon.
let fwShots=0,dfShots=0,dfDefenses=0,fwDefenses=0;
for(let i=0;i<80;i++){
  let s=E.createMatch({matchId:`roles-${i}`,seed:`roles-${i}`,userSquad:squad("u"),opponentSquad:squad("o")});
  s.firstHalfTarget=999;s.actionTarget=999;s.manualIndexes=[0];s.possession="user";s.fieldZone="shot";
  s=E.prepareNext(s);const shooter=s.pendingEncounter.actorPlayerId;if(shooter.includes("f"))fwShots++;if(shooter.includes("d"))dfShots++;
  s.pendingEncounter=null;s.possession="user";s.fieldZone="attack";s=E.prepareNext(s);const defender=s.pendingEncounter.opponentPlayerId;if(defender.includes("d"))dfDefenses++;if(defender.includes("f"))fwDefenses++;
}
assert(fwShots>dfShots*4,`forwards should strongly dominate shots: FW=${fwShots}, DF=${dfShots}`);
assert(dfDefenses>fwDefenses*4,`defenders should strongly dominate defensive duels: DF=${dfDefenses}, FW=${fwDefenses}`);
console.log("rtg-aggressive-role-aware-flow-test: PASS");
