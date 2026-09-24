"use strict";
const assert=require("assert"),fs=require("fs");
const src=fs.readFileSync("js/road-to-glory/rtg-run-view.js","utf8");
assert(src.includes('data-rtg-album-collection="${escape(sid)}"'));
assert(src.includes('const seasonNo=sid==="ie1_s2"?2:1'));
assert(src.includes('Array.isArray(collections)&&collections.length'));
assert(!src.includes('data-rtg-album-collection="ie1" aria-label="Apri collezione'));
console.log("rtg-season2-album-season-id-test: PASS");
