"use strict";
const assert=require("assert"),fs=require("fs");
const src=fs.readFileSync("js/road-to-glory/rtg-squad-runtime.js","utf8");
assert(src.includes("const seasonProfile=(seasonDb?.profiles||[]).find"));
assert(src.includes("seasonProfile?.teamId"));
assert(src.includes("const canonicalId=id(seasonProfile?.playerId||parsed.canonicalPlayerId||parsed.playerId).split"));
assert(src.includes('cards().parse(cardId).legacySeasonId===activeSeason'));
console.log("rtg-season2-recent-profile-test: PASS");
