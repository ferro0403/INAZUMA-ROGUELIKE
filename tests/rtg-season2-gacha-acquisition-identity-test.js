"use strict";
const assert=require("assert"),fs=require("fs");
const src=fs.readFileSync("js/road-to-glory/rtg-gacha.js","utf8");
assert(src.includes("cards().record(player?.cardId || player"));
assert(src.includes('state?.activeSeasonId || seasonDb?.seasonId || "ie1"'));
assert(src.includes("gachaAcquiredCards"));
assert(src.includes("cardId: card.cardId"));
assert(src.includes("playerId: card.playerId"));
console.log("rtg-season2-gacha-acquisition-identity-test: PASS");
