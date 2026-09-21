"use strict";
const assert=require("assert"),fs=require("fs");
const source=fs.readFileSync("js/road-to-glory/rtg-match-engine.js","utf8");
assert.match(source,/if\(String\(kind\)==="midfield"\)return type===\(hasPossession\?"dribble":"defense"\)\?move:null;/,"midfield move must match possession: dribble attacking, defense defending");
assert.match(source,/const userMoveSucceeded=.*pending\.userKind==="shot"/s,"user move consumption must distinguish shot attempts");
assert.match(source,/if\(userMove&&userMoveSucceeded\)consumeMove/,"failed non-shot user moves must not consume a use");
assert.match(source,/if\(aiMove&&aiMoveSucceeded\)consumeMove/,"failed non-shot AI moves must not consume a use");
console.log("rtg-move-compatibility-consumption-test: PASS");
