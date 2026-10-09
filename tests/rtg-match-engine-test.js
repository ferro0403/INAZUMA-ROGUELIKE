"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-ai-policy.js","js/road-to-glory/rtg-penalty-runtime.js","js/road-to-glory/rtg-match-engine.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryMatchEngine;
function player(id,role,moveType,overall=80){const p={playerId:id,position:role,normalizedRole:role,overall,attack:overall,control:overall,speed:overall,grit:overall,physical:overall,stamina:overall,defense:overall,save:overall,element:"Wind"};if(moveType)p.move={name:`${id}-move`,type:moveType,power:70,element:"Wind"};return p;}
function squad(prefix,withMoves=true){
 const lineup=[player(prefix+"g","GK",withMoves?"save":null),player(prefix+"d1","DF",withMoves?"defense":null),player(prefix+"d2","DF",withMoves?"defense":null),player(prefix+"d3","DF",withMoves?"defense":null),player(prefix+"d4","DF",withMoves?"defense":null),player(prefix+"m1","MF",withMoves?"dribble":null),player(prefix+"m2","MF",withMoves?"dribble":null),player(prefix+"m3","MF",withMoves?"dribble":null),player(prefix+"f1","FW",withMoves?"shot":null),player(prefix+"f2","FW",withMoves?"shot":null),player(prefix+"f3","FW",withMoves?"shot":null)];
 const bench=[player(prefix+"bg","GK",withMoves?"save":null),player(prefix+"bd","DF",withMoves?"defense":null),player(prefix+"bm","MF",withMoves?"dribble":null),player(prefix+"bf","FW",withMoves?"shot":null)];
 return {formationId:"4-3-3",lineup,bench};
}
const input={matchId:"m1",nodeId:"main:occult",matchType:"main",attemptNumber:1,seed:"match-seed",userSquad:squad("u"),opponentSquad:squad("o")};
const a=E.createMatch(input),b=E.createMatch(input);
assert(a.actionTarget>=22&&a.actionTarget<=30);assert(a.manualTarget>=17&&a.manualTarget<=21&&a.manualTarget<=a.actionTarget);
assert.strictEqual(a.period,"first_half");assert.deepStrictEqual(JSON.parse(JSON.stringify(a.score)),{user:0,opponent:0});assert.strictEqual(a.fieldZone,"midfield");
assert.strictEqual(a.moveUsesByPlayerId["user:uf1"],2);assert.strictEqual(a.moveUsesByPlayerId["opponent:of1"],2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(a.manualIndexes)),JSON.parse(JSON.stringify(b.manualIndexes)));assert.strictEqual(a.actionTarget,b.actionTarget);
const noMoves=E.createMatch({...input,matchId:"m2",seed:"no-moves",userSquad:squad("n",false)});
assert.strictEqual(Object.keys(noMoves.moveUsesByPlayerId).some(k=>k.startsWith("user:n")),false);
let prepared=E.prepareNext(a);
assert(prepared.pendingEncounter);assert(["Tiro","Parata","Dribbling","Difesa"].includes(prepared.pendingEncounter.userBaseActionLabel));
if(prepared.pendingEncounter.kind==="midfield")assert.strictEqual(prepared.pendingEncounter.userBaseActionLabel,prepared.pendingEncounter.actorSide==="user"?"Dribbling":"Difesa");
const frozenAi=prepared.pendingEncounter.aiChoice;const frozen=JSON.parse(JSON.stringify(prepared));
const userCanMove=!!prepared.pendingEncounter.userMove;
const resolvedBase=E.resolvePendingEncounter(JSON.parse(JSON.stringify(frozen)),"base");
const resolvedMove=userCanMove?E.resolvePendingEncounter(JSON.parse(JSON.stringify(frozen)),"move"):resolvedBase;
assert.strictEqual(frozenAi,prepared.pendingEncounter.aiChoice);
if(userCanMove){const key=`${prepared.pendingEncounter.userSide}:${prepared.pendingEncounter.userPlayerId}`;const beforeUses=Number(frozen.moveUsesByPlayerId[key]||0);const moveEvent=resolvedMove.log[resolvedMove.log.length-1];const userWon=prepared.pendingEncounter.userSide===prepared.pendingEncounter.actorSide?!!moveEvent.actorWon:!moveEvent.actorWon;const shouldConsume=["shot","save"].includes(prepared.pendingEncounter.userKind)||userWon;assert.strictEqual(resolvedMove.moveUsesByPlayerId[key],beforeUses-(shouldConsume?1:0));}
let silent=E.createMatch({...input,matchId:"no-silent-goal",seed:"no-silent-goal-seed"});
silent.manualIndexes=[];silent.manualTarget=0;
const silentScore=JSON.stringify(silent.score);
silent=E.prepareNext(silent);
assert(silent.pendingEncounter);assert.strictEqual(silent.pendingEncounter.kind,"shot");assert.strictEqual(JSON.stringify(silent.score),silentScore);assert.strictEqual(silent.log.some(event=>event.goalSide),false);
let chain=E.createMatch({...input,matchId:"chain-no-random-goal",seed:"chain-no-random-goal-seed"});
chain.manualIndexes=[0];chain.manualTarget=1;chain=E.prepareNext(chain);assert(chain.pendingEncounter);
if(chain.pendingEncounter.kind!=="shot"){const beforeChainScore=JSON.stringify(chain.score);chain=E.resolvePendingEncounter(chain,"base");chain=E.prepareNext(chain);assert.strictEqual(JSON.stringify(chain.score),beforeChainScore);assert(chain.pendingEncounter);assert.strictEqual(chain.pendingEncounter.kind,"shot");}
let match=E.createMatch({...input,matchId:"half",seed:"half-seed"});
match=E.prepareNext(match);let guard=0;while(match.status!=="halftime"&&guard++<80){if(match.pendingEncounter)match=E.resolvePendingEncounter(match,"base");else match=E.prepareNext(match);}assert.strictEqual(match.status,"halftime");
const usesBefore=JSON.stringify(match.moveUsesByPlayerId);match=E.confirmHalftime(match,match.userSquad,{validateHalftime:()=>({eligible:true})});assert.notStrictEqual(match.status,"halftime");assert.strictEqual(JSON.stringify(match.moveUsesByPlayerId),usesBefore);
let boundary=E.createMatch({...input,matchId:"extra",seed:"extra-seed"});
boundary.period="second_half";boundary.actionIndex=boundary.actionTarget;boundary.score={user:1,opponent:1};boundary.pendingEncounter=null;boundary.status="active";boundary=E.prepareNext(boundary);assert.strictEqual(boundary.period,"extra_first");assert.strictEqual(boundary.status,"active");
boundary.extraActionIndex=6;boundary.period="extra_second";boundary.score={user:2,opponent:2};boundary.pendingEncounter=null;boundary=E.prepareNext(boundary);assert.strictEqual(boundary.status,"penalties");assert(boundary.shootout);
// Svincolati / secondary matches must also produce a winner: a draw after 90'
// enters extra time and, if still level, reaches the same penalty shootout.
let secondary=E.createMatch({...input,matchId:"secondary-extra",nodeId:"secondary:free-agents",matchType:"secondary",seed:"secondary-extra-seed"});
secondary.period="second_half";secondary.actionIndex=secondary.actionTarget;secondary.score={user:0,opponent:0};secondary.pendingEncounter=null;secondary.status="active";
secondary=E.prepareNext(secondary);assert.strictEqual(secondary.period,"extra_first");assert.strictEqual(secondary.status,"active");
secondary.period="extra_second";secondary.extraActionIndex=6;secondary.score={user:1,opponent:1};secondary.pendingEncounter=null;secondary.status="active";
secondary=E.prepareNext(secondary);assert.strictEqual(secondary.status,"penalties");assert(secondary.shootout);
const beforePenaltyUse=boundary.moveUsesByPlayerId["user:uf1"];const shooter=boundary.userSquad.lineup.find(p=>p.playerId==="uf1"),keeper=boundary.opponentSquad.lineup.find(p=>p.playerId==="og");
const pen=E.resolvePenaltyKick(boundary,{attackingSide:"user",shooterPlayerId:"uf1",goalkeeperPlayerId:"og",shooterChoice:"left",goalkeeperChoice:"left",shooterMove:shooter.move,goalkeeperMove:null,encounterContext:{actor:shooter,opponent:keeper}});assert.strictEqual(pen.state.moveUsesByPlayerId["user:uf1"],beforePenaltyUse-1);
const abandoned=E.abandon(a);assert.strictEqual(abandoned.status,"abandoned");assert.strictEqual(abandoned.result.winner,"opponent");
console.log("rtg-match-engine-test: PASS");
