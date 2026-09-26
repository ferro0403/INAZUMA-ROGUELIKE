"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const src=fs.readFileSync("js/road-to-glory/rtg-squad-view-base.js","utf8");
assert(src.includes('model.seasonId === "ie1_s2" ? "S2" : "S1"'));
assert(src.includes('model.seasonId === "ie1_s2" ? "Season 2" : "Season 1"'));
assert(!src.includes('<p class="eyebrow">ROAD TO GLORY · S1</p>'));
console.log("rtg-season2-squad-label-test: PASS");
