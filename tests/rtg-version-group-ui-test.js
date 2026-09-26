"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const c={
  globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,
  SeasonRegistry:{normalizeSeasonId:v=>String(v),player:()=>null},
  ProfiledSeasonRuntime:{canonicalPlayerId:(_sid,pid)=>String(pid).split("@")[0],resolveProfile:()=>null},
};
c.globalThis=c;
vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-card-identity.js","utf8"),c,{filename:"rtg-card-identity.js"});
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view-base.js","utf8"),c,{filename:"rtg-squad-view-base.js"});

const C=c.RoadToGloryCardIdentity;
assert.strictEqual(C.versionGroupKey("ie1::erik"),C.versionGroupKey("ie1_s2::erik"),"S1/S2 Erik must share one canonical UI group");
assert.notStrictEqual(C.versionGroupKey("free_agents::erik"),C.versionGroupKey("ie1::erik"),"free-agent identity must stay separate");

const compact=(player,options={})=>`<button type="button" class="player-card ${options.extraClass||""}" ${options.dataAttr||""}><strong>${player?.name||""}</strong>${options.trailingMarkup||""}</button>`;
const view=c.RoadToGlorySquadView.create({escapeHtml:v=>String(v),compactPlayerCardMarkup:compact});

const grouped=view.replacementPickerResultsMarkup({
  entries:[{cardId:"ie1_s2::erik",playerId:"ie1_s2::erik",source:"RTG",versionCount:2,player:{cardId:"ie1_s2::erik",playerId:"erik",name:"Erik Eagle",overall:91,normalizedRole:"MF"}}],
  total:1,
  visibleCount:1,
});
assert.strictEqual((grouped.match(/data-rtg-picker-player=/g)||[]).length,1,"picker must render one Erik card, not one per Season");
assert.match(grouped,/2 VERS\./,"unified card must expose that more versions are available");

const picker=view.versionPickerMarkup({
  mode:"select",
  entries:[
    {cardId:"ie1::erik",playerId:"ie1::erik",source:"RTG",player:{cardId:"ie1::erik",playerId:"erik",name:"Erik Eagle",overall:91,normalizedRole:"MF"}},
    {cardId:"ie1_s2::erik",playerId:"ie1_s2::erik",source:"RTG",player:{cardId:"ie1_s2::erik",playerId:"erik",name:"Erik Eagle",overall:91,normalizedRole:"MF"}},
  ],
});
assert.strictEqual((picker.match(/data-rtg-version-card=/g)||[]).length,2,"opening the unified Erik card must lazily show both versions");
assert.match(picker,/data-legacy-season="S1"/);
assert.match(picker,/data-legacy-season="S2"/);
assert.match(picker,/rtg-picker-player-card/,"version chooser must reuse the large replacement-picker card style");
assert.match(picker,/rtg-version-player-card/,"version chooser must keep its dedicated interaction hook");
assert.doesNotMatch(picker,/rtg-version-choice/,"old grey version buttons must be gone");

const controller=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert.match(controller,/const buildGroups=\(cardIds\)=>Array\.from\(groupVersionCards\(cardIds\)\.entries\(\)\)/,"replacement picker must group canonical versions before rendering");
assert.match(controller,/versionCount:group\.cardIds\.length/,"replacement picker must mark unified cards");
assert.match(controller,/openRtgVersionPicker\(versions,\{onSelect:chooseCandidate\}\)/,"choosing a unified card in a squad change must open the version selector");
assert.match(controller,/Resolve\/render every version only after the unified player card is opened/,"all versions must stay lazy until the group is opened");
assert.match(controller,/deps\.closeModal\?\.\(\);[\s\S]*openRtgPlayerDetails\(selected\)/,"catalog version selection must close the chooser before opening details");

console.log("rtg-version-group-ui-test: PASS");
