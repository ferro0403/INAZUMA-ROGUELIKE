"use strict";
const assert=require("assert"),fs=require("fs");
const ctl=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert(ctl.includes("function canonicalCardPlayerId(cardRef)"));
assert(ctl.includes("function openRtgVersionPicker(cardIds=[],options={})"));
assert(ctl.includes("const groups=new Map()"));
assert(ctl.includes("groups.get(versionGroupKey(cardId))||[cardId]"));
assert(ctl.includes("versionCount:owned.length"));
console.log("rtg-season2-version-collection-test: PASS");
