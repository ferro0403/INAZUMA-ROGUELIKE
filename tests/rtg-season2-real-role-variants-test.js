"use strict";
const assert=require("assert"),fs=require("fs");
const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const multi=(db.profiles||[]).filter(p=>p.roleSwitchEnabled&&Array.isArray(p.roleVariants)&&p.roleVariants.length===2);
assert.strictEqual(multi.length,4,"S2 must expose the four authored dual-role profiles");
for(const p of multi){
 assert(p.profileId&&p.playerId,p.profileId||"profile");
 assert(p.defaultRoleVariantId,p.profileId+" missing default role");
 const ids=p.roleVariants.map(v=>String(v.roleVariantId||v.variantId||""));
 assert.strictEqual(new Set(ids).size,2,p.profileId+" role variants must be distinct");
 assert(ids.includes(String(p.defaultRoleVariantId)),p.profileId+" default role variant must exist");
 const roles=p.roleVariants.map(v=>String(v.normalizedRole||v.position||v.role||"").toUpperCase());
 assert.strictEqual(new Set(roles).size,2,p.profileId+" must switch between two distinct roles");
}
const resolver=fs.readFileSync("js/road-to-glory/rtg-player-resolver.js","utf8");
assert(resolver.includes("activeProfileId: resolved.profileId || resolved.player?.profileId || undefined"));
assert(resolver.includes("activeRoleVariantId: roleVariantId || undefined"));
const view=fs.readFileSync("js/road-to-glory/rtg-squad-view-base.js","utf8");
assert(view.includes('area === "bench" && Array.isArray(player?.roleVariants) && player.roleVariants.length > 1'));
console.log("rtg-season2-real-role-variants-test: PASS");
