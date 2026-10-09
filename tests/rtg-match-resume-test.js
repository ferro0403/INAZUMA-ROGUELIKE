"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-ai-policy.js","js/road-to-glory/rtg-penalty-runtime.js","js/road-to-glory/rtg-match-engine.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryMatchEngine;
function p(id,role,type){return{playerId:id,position:role,normalizedRole:role,overall:80,attack:80,control:80,speed:80,grit:80,physical:80,stamina:80,defense:80,save:80,element:"Wind",move:type?{name:id+" move",type,power:70,element:"Wind"}:null};}
function sq(x){return{formationId:"4-3-3",lineup:[p(x+"g","GK","save"),p(x+"d1","DF","defense"),p(x+"d2","DF","defense"),p(x+"d3","DF","defense"),p(x+"d4","DF","defense"),p(x+"m1","MF","dribble"),p(x+"m2","MF","dribble"),p(x+"m3","MF","dribble"),p(x+"f1","FW","shot"),p(x+"f2","FW","shot"),p(x+"f3","FW","shot")],bench:[p(x+"bg","GK","save"),p(x+"bd","DF","defense"),p(x+"bm","MF","dribble"),p(x+"bf","FW","shot")]};}
const round=v=>JSON.parse(JSON.stringify(v));
let a=E.createMatch({matchId:"resume",nodeId:"main:occult",matchType:"main",attemptNumber:1,seed:"resume-seed",userSquad:sq("u"),opponentSquad:sq("o")});
a=E.prepareNext(a);let b=round(a);assert.deepStrictEqual(round(a),b);
const choice=a.pendingEncounter?.userMove?"move":"base";
const a1=E.resolvePendingEncounter(a,choice),b1=E.resolvePendingEncounter(b,choice);assert.deepStrictEqual(round(a1),round(b1));
a=a1;let guard=0;while(a.status!=="halftime"&&guard++<100){a=a.pendingEncounter?E.resolvePendingEncounter(a,"base"):E.prepareNext(a);}
assert.strictEqual(a.status,"halftime");b=round(a);
const a2=E.confirmHalftime(a,a.userSquad,{validateHalftime:()=>({eligible:true})});
const b2=E.confirmHalftime(b,b.userSquad,{validateHalftime:()=>({eligible:true})});assert.deepStrictEqual(round(a2),round(b2));
let extra=round(a2);extra.period="second_half";extra.status="active";extra.pendingEncounter=null;extra.actionIndex=extra.actionTarget;extra.score={user:1,opponent:1};
extra=E.prepareNext(extra);assert.strictEqual(extra.period,"extra_first");const extraReload=round(extra);assert.deepStrictEqual(round(extra),extraReload);
extra.extraActionIndex=6;extra.period="extra_second";extra.pendingEncounter=null;extra.score={user:2,opponent:2};extra.status="active";
extra=E.prepareNext(extra);assert.strictEqual(extra.status,"penalties");
let penReload=round(extra);
const kick={attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"right",encounterContext:{actor:p("s","FW",null),opponent:p("k","GK",null)}};
const k1=E.resolvePenaltyKick(extra,kick).state,k2=E.resolvePenaltyKick(penReload,kick).state;assert.deepStrictEqual(round(k1),round(k2));
assert.deepStrictEqual(round(k1.opponentSquad),round(extra.opponentSquad));
console.log("rtg-match-resume-test: PASS");
