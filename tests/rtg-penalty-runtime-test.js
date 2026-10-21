"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-penalty-runtime.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const P=c.RoadToGloryPenaltyRuntime;
const flat=(n)=>({overall:n,attack:n,control:n,grit:n,save:n,physical:n,element:"Wind"});
let s=P.createShootout("pen-seed");
let r=P.resolveKick(s,{attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"left",shooterMove:{power:50,element:"Wind"},goalkeeperMove:null,encounterContext:{actor:flat(80),opponent:flat(80)}});
assert.strictEqual(r.outcome,"goal");assert.strictEqual(r.reason,"shooter-move-only");
r=P.resolveKick(P.createShootout("pen-seed"),{attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"right",shooterMove:null,goalkeeperMove:{power:50,element:"Wind"},encounterContext:{actor:flat(80),opponent:flat(80)}});
assert.strictEqual(r.outcome,"save");assert.strictEqual(r.reason,"goalkeeper-move-only");
r=P.resolveKick(P.createShootout("pen-seed"),{attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"left",shooterMove:null,goalkeeperMove:null,encounterContext:{actor:flat(80),opponent:flat(80)}});
assert.strictEqual(r.outcome,"save");
r=P.resolveKick(P.createShootout("pen-seed"),{attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"right",shooterMove:null,goalkeeperMove:null,encounterContext:{actor:flat(80),opponent:flat(80)}});
assert.strictEqual(r.outcome,"goal");
r=P.resolveKick(P.createShootout("pen-seed"),{attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"right",shooterMove:{power:80,element:"Wind"},goalkeeperMove:{power:50,element:"Wind"},encounterContext:{actor:flat(82),opponent:flat(78)}});
assert(["goal","save"].includes(r.outcome));assert.strictEqual(r.reason,"move-duel");assert(r.probability>=10&&r.probability<=90);
let shoot=P.createShootout("sequence");
const seq=[
 ["user",true],["opponent",false],
 ["user",true],["opponent",false],
 ["user",true],["opponent",false]
];
for(const [side,goal] of seq){
  const kick=P.resolveKick(shoot,{attackingSide:side,shooterChoice:"left",goalkeeperChoice:goal?"right":"left",shooterMove:null,goalkeeperMove:null,encounterContext:{actor:flat(80),opponent:flat(80)}});
  shoot=kick.state;
}
assert.strictEqual(shoot.status,"completed");assert.strictEqual(shoot.winner,"user");
let sudden=P.createShootout("sudden");
for(let i=0;i<10;i++){const side=i%2===0?"user":"opponent";sudden=P.resolveKick(sudden,{attackingSide:side,shooterChoice:"left",goalkeeperChoice:"right",encounterContext:{actor:flat(80),opponent:flat(80)}}).state;}
assert.strictEqual(sudden.status,"sudden-death");
sudden=P.resolveKick(sudden,{attackingSide:"user",shooterChoice:"left",goalkeeperChoice:"right",encounterContext:{actor:flat(80),opponent:flat(80)}}).state;
assert.strictEqual(sudden.status,"sudden-death");
sudden=P.resolveKick(sudden,{attackingSide:"opponent",shooterChoice:"left",goalkeeperChoice:"left",encounterContext:{actor:flat(80),opponent:flat(80)}}).state;
assert.strictEqual(sudden.status,"completed");assert.strictEqual(sudden.winner,"user");
const history=[{userDirection:"left"},{userDirection:"left"},{userDirection:"right"}];
const d1=P.aiDirection(history,"habit",4),d2=P.aiDirection(history,"habit",4);
assert.strictEqual(d1,d2);assert(["left","center","right"].includes(d1));
console.log("rtg-penalty-runtime-test: PASS");
