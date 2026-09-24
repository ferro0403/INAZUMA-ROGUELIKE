"use strict";
const assert=require("assert"),fs=require("fs");
const src=fs.readFileSync("js/road-to-glory/rtg-run-view.js","utf8");
assert(src.includes('data-rtg-album-collection="${escape(String(state?.activeSeasonId||"ie1"))}"'));
assert(!src.includes('data-rtg-album-collection="ie1" aria-label="Apri collezione'));
console.log("rtg-season2-album-season-id-test: PASS");
