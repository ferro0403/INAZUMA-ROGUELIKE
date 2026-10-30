"use strict";
const assert=require("assert"),fs=require("fs");
const view=fs.readFileSync("js/home/home-view.js","utf8");
const controller=fs.readFileSync("js/home/home-controller.js","utf8");
assert.match(view,/home-swipe-page--main/);
assert.match(view,/home-swipe-page--rtg/);
// The primary CTA deliberately opens the dual-campaign selector, not a
// hardcoded legacy Season 1 run.
assert.match(view,/data-rtg-home-open="campaigns"/);
const rtgController=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert.match(rtgController,/options\?\.destination==="campaigns"\)return renderCampaignSelect\(\)/);
// Shortcuts are data-driven: validate the actual list and template binding.
const declaredShortcuts=view.match(/const shortcuts=\[([\s\S]*?)\];/)?.[1]||"";
for(const target of ["squad","vending","album","shop","development"])
  assert.ok(declaredShortcuts.includes('["'+target+'",'),"Missing RTG home shortcut: "+target);
assert.match(view,/data-rtg-home-open="\$\{target\}"/);
assert.doesNotMatch(view,/data-rtg-home-open="catalog"/);
assert.match(controller,/bindHomePager/);
assert.match(controller,/deps\.renderRoadToGlory\(\{ destination:/);
assert.doesNotMatch(view,/id:\s*"open-rtg-home"/);
console.log("rtg-home-entry-test: PASS");
