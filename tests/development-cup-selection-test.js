"use strict";
const assert=require("assert");
global.localStorage={value:null,getItem(){return this.value;},setItem(_key,value){this.value=value;}};
global.InazumaProgression=require("../js/roguelike_progression.js");
const development=require("../js/development-v2.js");
const wallet={...development.read(),coins:5000,cupsBySeason:{ie1:6,ie1_s2:5,ie1_s3:4,ie2:7},projects:{...development.read().projects,Leggenda:2}};
development.write(wallet);
const selection={ie1:0,ie1_s2:1,ie1_s3:3,ie2:4};
assert(development.validateCupSelection(wallet,selection,8));
assert(!development.validateCupSelection(wallet,{...selection,ie1:1},8),"9/8 is rejected");
assert(!development.validateCupSelection(wallet,{ie1_s2:6,ie1_s3:2},8),"source overdraft is rejected");
const result=development.evolve({playerId:"hauser",playerName:"Hauser",basePotential:90,unlocked:true,freeAgentEligible:true,cupSelection:selection});
assert(result.ok); assert.deepStrictEqual(result.state.cupsBySeason,{ie1:6,ie1_s2:4,ie1_s3:1,ie2:3});
assert.deepStrictEqual(result.state.evolutionHistory[0].cupsConsumedBySource,{ie1_s2:1,ie1_s3:3,ie2:4});
const after=result.state;
const duplicate=development.evolve({playerId:"hauser",playerName:"Hauser",basePotential:90,unlocked:true,freeAgentEligible:true,cupSelection:selection});
assert(!duplicate.ok); assert.deepStrictEqual(development.read().cupsBySeason,after.cupsBySeason,"double submit consumes once");
for(const invalid of [{ie1:6,ie1_s2:1},{ie1:6,ie1_s2:3}]){development.reset();development.write(wallet);const before=development.read();const rejected=development.evolve({playerId:"x",basePotential:90,unlocked:true,freeAgentEligible:true,cupSelection:invalid});assert(!rejected.ok);assert.deepStrictEqual(development.read(),before,"invalid selection is atomic");}
console.log("development-cup-selection-test: exact multi-source and atomic validation OK");
