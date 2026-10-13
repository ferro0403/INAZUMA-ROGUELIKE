"use strict";
const assert=require("assert"),fs=require("fs");
const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const all=[...(db.bossOrder||[]),...(db.specialMatches||[])];
const expected=["secret_service","gemini_storm","alpine_ie2","epsilon","royal_academy_redux","cloister_divinity","epsilon_plus","super_triple_c","diamond_dust","fauxshore","prominence","chaos","genesis","mary_times","dark_emperors","zeus","raimon_inazuma_eleven_2"];
for(const teamId of expected){
 const m=all.find(x=>x.teamId===teamId);
 assert(m,teamId+" missing opponent definition");
 assert.strictEqual(m.startingXIProfileIds.length,11,teamId+" must use its authored profile XI");
 assert(m.bossFormation||m.matchFormation,teamId+" must have an authored formation");
 assert.strictEqual(new Set(m.startingXIProfileIds).size,11,teamId+" XI contains duplicate profile ids");
}
const ctl=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert(ctl.includes("...(seasonDb?.specialMatches||[])"));
assert(ctl.includes("const profileIds=Array.from(boss.startingXIProfileIds||[])"));
assert(ctl.includes("boss.bossFormation||boss.matchFormation"));
console.log("rtg-season2-opponent-contract-test: PASS");
