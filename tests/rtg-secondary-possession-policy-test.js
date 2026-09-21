"use strict";
const assert=require("assert"),fs=require("fs");
const source=fs.readFileSync("js/road-to-glory/rtg-match-engine.js","utf8");
assert.match(source,/const possessionBefore=state\.possession;/,"secondary encounters must snapshot possession");
assert.match(source,/if\(!manual&&!goalSide\)state\.possession=possessionBefore;/,"automatic secondary actions must restore possession");
assert.match(source,/17\+global\.RoadToGloryRng\.int\(seed,"manual-target",0,5\)/,"matches should expose a few more manual choices");
console.log("rtg-secondary-possession-policy-test: PASS");
