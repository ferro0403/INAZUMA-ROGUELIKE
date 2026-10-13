"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const index=fs.readFileSync("index.html","utf8");
const progression=["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-progression.js","js/road-to-glory/rtg-gacha.js","js/road-to-glory/rtg-squad-runtime.js"];
const match=["js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-ai-policy.js","js/road-to-glory/rtg-opponent-generator.js","js/road-to-glory/rtg-penalty-runtime.js","js/road-to-glory/rtg-match-engine.js"];
let previous=index.indexOf(progression.at(-1));assert(previous>=0);
for(const script of match){const pos=index.indexOf(script);assert(pos>previous,`${script} must follow previous RTG dependency`);previous=pos;}
assert(previous<index.indexOf("js/app.js"));
let openCalls=0;const c={globalThis:null,window:null,console,Error,TypeError,Object,Array,String,Number,Promise,JSON,Math,RegExp,Set,Map,indexedDB:{open(){openCalls++;throw new Error("no storage on load");}},RoadToGloryRng:{},RoadToGlorySquadRuntime:{},RoadToGloryConfig:{SEASON1:{}}};c.globalThis=c;c.window=c;vm.createContext(c);
for(const script of match)vm.runInContext(fs.readFileSync(script,"utf8"),c,{filename:script});
assert.strictEqual(openCalls,0);
console.log("rtg-match-load-order-test: PASS");
