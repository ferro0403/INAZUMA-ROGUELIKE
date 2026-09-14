"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");const store=new Map(),localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const c={console,localStorage,SEASON1_CONFIG:{saveKey:"testRun",legacySaveKeys:[],saveVersion:2,startingLives:2,maxRunLives:2},SeasonRegistry:{normalizeSeasonId:v=>String(v||"ie1"),activeId:()=>"ie1",list:()=>[{id:"ie1"},{id:"ie1_s2"}],database:()=>null},DevelopmentRuntime:{buildRunSnapshot:()=>({developmentPlayerSnapshot:{}})}};c.globalThis=c;
vm.runInNewContext(fs.readFileSync("js/run-state.js","utf8"),c);
assert.strictEqual(c.RunState.createRun({},"ie1").simulationRulesVersion,2);assert.strictEqual(c.RunState.createRun({},"ie1_s2").simulationRulesVersion,1);
const old=c.RunState.createRun({},"ie1");delete old.simulationRulesVersion;c.RunState.save(old);assert.strictEqual(old.simulationRulesVersion,1);assert.strictEqual(c.RunState.load("ie1",{readOnly:true}).simulationRulesVersion,1);
console.log("run simulation rules versioning: new IE1 V2, old saves/other seasons V1 OK");
