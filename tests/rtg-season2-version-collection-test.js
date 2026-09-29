"use strict";
const assert=require("assert"),fs=require("fs");
const ctl=["js/road-to-glory/rtg-squad-controller.js","js/road-to-glory/rtg-controller.js"].map(file=>fs.readFileSync(file,"utf8")).join("\n").replaceAll("deps.","");
assert(ctl.includes("function canonicalCardPlayerId(cardRef)"));
assert(ctl.includes("function openRtgVersionPicker(cardIds=[],options={})"));
assert(ctl.includes("const groups=new Map()"));
assert(ctl.includes("groups.get(versionGroupKey(cardId))||[cardId]"));
assert(ctl.includes("versionCount:owned.length"));
console.log("rtg-season2-version-collection-test: PASS");
