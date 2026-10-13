"use strict";
// The 1162 FW portrait is now a role-specific profiled-season asset. A global
// CSS src/alt override would incorrectly affect the separate 1166 card.
const fs=require("fs"),assert=require("assert");
const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const css=fs.readFileSync("css/match-ui-cleanup.css","utf8");
const shawn1162=db.profiles.find(p=>p.profileId==="1162@alpine_ie2");
const shawn1166=db.profiles.find(p=>p.profileId==="1166@raimon_inazuma_eleven_2");
assert(shawn1162&&shawn1166,"Both independent IE2 Shawn cards must remain present");
assert.strictEqual(shawn1162.defaultRoleVariantId,"df");
const defender=shawn1162.roleVariants.find(p=>p.position==="DF");
const forward=shawn1162.roleVariants.find(p=>p.position==="FW");
assert(defender&&forward,"Alpine 1162 retains selectable DF and FW roles");
assert.strictEqual(forward.portraitUrl,"https://dxi4wb638ujep.cloudfront.net/1/k/i/g/iggcoacccik.webp");
assert.strictEqual(forward.frontFullbodyUrl,"https://dxi4wb638ujep.cloudfront.net/1/k/v/t/vtvoof1qo6m_r0_fullbody.webp");
assert.strictEqual(shawn1166.portraitUrl,"https://dxi4wb638ujep.cloudfront.net/1/k/w/k/wk5ezxf-7dm.png");
assert.notStrictEqual(forward.portraitUrl,shawn1166.portraitUrl,"The Alpine FW variation must not reuse the Raimon card portrait");
assert(!/img\[alt="Shawn Froste"\]/.test(css),"Never override all Shawn versions by name");
assert(!/\.rtg-duel-render\s*>\s*img\[src\*=/.test(css),"Avoid old global CSS src-patching for canonical card profiles");
console.log("rtg-shawn-role-visual-test: original 1162 DF/FW and independent 1166 profile portraits PASS");
