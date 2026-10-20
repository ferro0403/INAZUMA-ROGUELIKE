"use strict";
const assert=require("assert"),fs=require("fs");
const src=["js/road-to-glory/rtg-album-view.js","js/road-to-glory/rtg-run-view.js"].map(file=>fs.readFileSync(file,"utf8")).join("\n");
assert(src.includes('data-rtg-album-collection="${escape(sid)}"'));
assert(src.includes('const seasonNo=seasonNumber(sid)'));
assert(src.includes('Array.isArray(collections)&&collections.length'));
assert(!src.includes('data-rtg-album-collection="ie1" aria-label="Apri collezione'));
console.log("rtg-season2-album-season-id-test: PASS");
