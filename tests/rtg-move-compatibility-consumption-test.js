"use strict";
const assert=require("assert"),fs=require("fs");
const source=fs.readFileSync("js/road-to-glory/rtg-match-engine.js","utf8");
assert.match(source,/if\(String\(kind\)==="midfield"\)return type===\(hasPossession\?"dribble":"defense"\)\?move:null;/,"midfield move must match possession: dribble attacking, defense defending");
assert.match(source,/const userMoveSucceeded=.*\["shot","save"\]\.includes\(pending\.userKind\)/s,"shot and goalkeeper save moves must consume on every attempt");
assert.match(source,/aiMoveSucceeded=.*\["shot","save"\]\.includes\(pending\.aiKind\)/s,"AI goalkeeper save moves must consume on every attempt");
assert.match(source,/if\(userMove&&userMoveSucceeded\)consumeMove/,"failed dribble/defense user moves must not consume a use");
assert.match(source,/if\(aiMove&&aiMoveSucceeded\)consumeMove/,"failed dribble/defense AI moves must not consume a use");
console.log("rtg-move-compatibility-consumption-test: PASS");
