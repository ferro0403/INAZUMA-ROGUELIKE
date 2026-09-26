"use strict";
const assert=require("assert"),fs=require("fs");
const src=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert(src.includes('const season2Slots=readSquadSlots("ie1_s2")'));
assert(src.includes('writeSquadSlots({"1":carried,"2":clone(carried),"3":clone(carried)},"ie1_s2")'));
assert(src.includes("activeSquadSlot=1"));
assert(src.includes("writeActiveSquadSlot(1)"));
assert(src.includes("squadDraft=squadForSlot(1)"));
console.log("rtg-season2-slot-transition-test: PASS");
