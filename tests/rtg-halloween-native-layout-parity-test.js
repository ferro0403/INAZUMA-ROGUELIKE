"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ctx={console};ctx.globalThis=ctx;
for(const file of [
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-squad-view-base.js",
  "js/road-to-glory/rtg-match-view.js"
])vm.runInNewContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
const compact=(p,o)=>'<button type="button" class="player-card" '+(o.dataAttr||'')+'>'+p.name+'</button>';
const view=ctx.RoadToGlorySquadView.create({
  escapeHtml:String,compactPlayerCardMarkup:compact,
  playerResolver:{resolveAtLevel20:()=>null}
});
const resolveAtLevel20=id=>({
  cardId:id,playerId:id.split("::").pop(),name:"Player",
  position:"FW",normalizedRole:"FW",overall:74,finalOverall:74,
  category:"Normale",portraitUrl:"https://example.test/card.png"
});
const lineup=Array.from({length:11},(_,i)=>"free_agents::"+i);
const bench=Array.from({length:4},(_,i)=>"free_agents::"+(11+i));
const model=view.renderModel({
  state:{activeSeasonId:"ie1",gachaAcquiredCards:[],
    squads:{ie1:{formationId:"4-3-3",lineup,bench,lineupOrderedBySlot:true}}},
  freeAgentIds:[],seasonDb:{},freeAgentsDb:{players:[]},
  playerResolver:{resolveAtLevel20}
});
assert.equal(model.lineupRows.reduce((sum,r)=>sum+r.entries.length,0),11,
  "All 11 tactical players must be visible with original RTG formation renderer");
const html=view.markup(model,{teamName:"Squadra Halloween",teamPower:74});
assert.equal((html.match(/data-rtg-lineup-player=/g)||[]).length,11);
assert.equal((html.match(/data-rtg-bench-player=/g)||[]).length,4);
assert.ok(ctx.RoadToGloryConfig?.season?.("ie1")?.formations?.length>=10,
  "Use the real RTG formation catalog, not a single mocked 4-3-3");
const allRealFormations=ctx.RoadToGloryConfig.season("ie1").formations;
for(const formation of allRealFormations){
  const mixedResolver=id=>{
    const index=Number(id.split("::").pop())||0;
    const natural=["GK","FW","MF","DF"][index%4];
    return {cardId:id,playerId:id.split("::").pop(),name:"Mixed "+index,
      position:natural,normalizedRole:natural,overall:75};
  };
  const variant=view.renderModel({
    state:{activeSeasonId:"ie1",gachaAcquiredCards:[],squads:{ie1:{
      formationId:formation.id,lineup,bench,lineupOrderedBySlot:true
    }}},
    freeAgentIds:[],seasonDb:{},freeAgentsDb:{players:[]},
    playerResolver:{resolveAtLevel20:mixedResolver}
  });
  assert.equal(variant.lineupRows.reduce((sum,row)=>sum+row.entries.length,0),11,
    "Every actual RTG formation must display all 11 off-role players: "+formation.id);
  const ids=variant.lineupRows.flatMap(row=>row.entries.map(entry=>entry.cardId));
  assert.equal(new Set(ids).size,11,"No missing or duplicated tactical card in "+formation.id);
  assert.deepEqual(new Set(ids),new Set(lineup),"All 11 card IDs visible in "+formation.id);
  const nativeHtml=view.markup(variant,{teamName:"Halloween",teamPower:75});
  assert.equal((nativeHtml.match(/data-rtg-lineup-player=/g)||[]).length,11,
    "Original RTG HTML must retain all tactical players in "+formation.id);
}

assert.ok(html.includes("data-rtg-open-formation"));
assert.ok(html.includes("data-rtg-open-coaches"));
const matchView=ctx.RoadToGloryMatchView.create({
  escapeHtml:String,compactPlayerCardMarkup:compact,
  teamEmblemMarkup:()=>'<img src="https://example.test/crest.webp">',
  squadPitchMarkup:()=>'<section class="pitch"></section>',
  userTeamMeta:()=>({name:"Squadra Halloween"})
});
const normal={playerId:"n",name:"Normal",position:"FW",overall:90,
  fullbodyUrl:"https://example.test/normal.webp"};
const event={...normal,playerId:"45",halloweenVampire:true};
const samford={...normal,playerId:"custom_0001",halloweenVampire:false};
assert.match(matchView.duelVisualMarkup(event,"opponent"),/halloween-vampiro/);
assert.doesNotMatch(matchView.duelVisualMarkup(samford,"opponent"),/halloween-vampiro/);
assert.doesNotMatch(matchView.duelVisualMarkup(normal,"user"),/halloween-vampiro/);
assert.equal((fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8").match(/class="rtg-duel-render\$\{shawnFwClass\}\$\{halloweenClass\}"/g)||[]).length,2,"Both original duel renderers must apply the tagged filter");
const htmlShell=fs.readFileSync("index.html","utf8");
assert.match(htmlShell,/rtg-halloween-event\.js\?v=20261029-slots-coach-actions-v18/,
  "iOS cache must not serve the older pre-fix Halloween controller");
const eventSource=fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8");
assert.match(eventSource,/function tacticalLineupModel\(model\)/,
  "Halloween must explicitly project the saved XI by tactical slot index");
assert.match(eventSource,/tacticalLineupModel\(view\.renderModel\(/,
  "Halloween squad must pass the positional model to the original RTG renderer");
assert.match(eventSource,/tacticalLineupModel\(deps\.squadView\?\.renderModel\?\.\(/,
  "Coach power selection must see the same exact 11 tactical cards");
assert.match(eventSource,/if\(before&&log\)\{/,
  "A terminal duel must never skip its own result overlay");
assert.match(eventSource,/if\(\["completed","completed-draw","abandoned"\]\.includes\(match\.status\)&&!lastResolution\)/,
  "Show the RTG final screen only AFTER the terminal encounter result is acknowledged");
assert.match(eventSource,/stage==="comparison"\?"resolving":"resolved"|lastResolutionStage="resolved";render\(\);/,
  "Halloween duel transitions to an explicit resolved state");
assert.doesNotMatch(eventSource,/stage==="comparison"\?1700:1150/,
  "Do not add 1.15 seconds of delay not used by the native RTG match controller");
assert.match(eventSource,/const target=Math\.max\(\.\.\.combined\.keys\(\)\)/,
  "The adapt button must maximize OVR from below as well as lower an overpowered team");
const nativeOverlayBlock=eventSource.slice(eventSource.indexOf("function bindNativeMatch()"),eventSource.indexOf("function openNativePreMatchCoachPower()"));
const duelFirst=nativeOverlayBlock.indexOf("if(lastResolution){");
const halftimeAfter=nativeOverlayBlock.indexOf('}else if(m.status==="halftime")');
assert.ok(duelFirst>=0&&halftimeAfter>duelFirst,
  "Duel outcome must take precedence over the halftime screen at 45 minutes");
assert.match(nativeOverlayBlock,/m.status==="halftime"&&!lastResolution/,
  "Halftime editing must not replace a still-visible duel result");
assert.match(nativeOverlayBlock,/if\(match\?\.status!=="active"\)return render\(\);/,
  "Continuing a terminal duel must show the native period or final result without stepping the engine again");
assert.match(eventSource,/function pickerTeamLabels\(p,seasonId\)/,
  "Halloween squad picker must deduplicate teams by their canonical labels");
assert.ok(eventSource.includes('const rarityOrder=["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]'),
  "Halloween rarity filter must match the normal RTG rarity order");
assert.match(eventSource,/halloween-event-main-cta/,
  "Halloween home must use a single primary match CTA");
const halloweenAssets=JSON.parse(fs.readFileSync("data/rtg-halloween-occult-players.json","utf8"))[0].players;
for (const [playerId, expectedPath] of [
  ["custom_0002","assets/rtg/halloween-samford-fullbody.png"],
  ["custom_0001","assets/rtg/halloween-nathan-fullbody.png"]
]) {
  const player=halloweenAssets.find(p=>p.playerId===playerId);
  assert.equal(player?.frontFullbodyUrl,expectedPath,"Custom Halloween fullbody must use uploaded PNG");
  const image=fs.readFileSync(expectedPath);
  assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a","Fullbody must be a real PNG");
  assert.ok(image.length>100000,"Fullbody must not be a tiny placeholder");
}
assert.match(eventSource,/frontFullbodyUrl:raw\.frontFullbodyUrl \|\| EVENT_FULLBODY_URLS/,
  "Halloween player resolver must prefer the player-specific fullbody URL");
const halloweenCss=fs.readFileSync("css/rtg-halloween-event.css","utf8");
const coachesCss=fs.readFileSync("css/rtg-coaches.css","utf8");
assert.match(htmlShell,/rtg-coaches\\.css\\?v=20261029-halloween-coach-contrast-v2/,
  "iPhone must fetch the updated staff contrast rules");
assert.match(coachesCss,/\\.rtg-coach-squad-slot\\.rtg-coach-halloween \\.rtg-coach-squad-selected strong\\s*\\{\\s*color:#24151a!important/,
  "Hekyll's name must be dark on the parchment background");
assert.match(coachesCss,/\\.rtg-coach-squad-slot\\.rtg-coach-halloween \\.rtg-coach-squad-selected span\\s*\\{\\s*color:#4c2d25!important/,
  "Hekyll's team must remain readable, without affecting other coaches");
// Regression: a player-only modal skin must NEVER recolour the normal coach
// detail, even when the same modal root was used by an event player first.
assert.doesNotMatch(halloweenCss,/#modal-root\.halloween-detail-native \.player-detail-content\b/,
  "The old unscoped selector made ordinary coach abilities white-on-cream");
assert.doesNotMatch(halloweenCss,/#modal-root\.halloween-detail-native \.player-detail-hero\b/,
  "Normal coach hero graphics must not inherit Halloween player colours");
assert.match(halloweenCss,/#modal-root\.halloween-detail-native \.player-detail-layout\.halloween-event-detail \.player-detail-content/,
  "Halloween colouring is scoped to actual Halloween player details");
const openCoachesPart=eventSource.slice(eventSource.indexOf("function openCoaches()"),eventSource.indexOf("function render()",eventSource.indexOf("function openCoaches()")));
const canonicalCoaches=fs.readFileSync("js/road-to-glory/rtg-coaches-controller.js","utf8");
assert.match(canonicalCoaches,/detailId\?"rtg-modal player-detail-modal rtg-coaches-modal"/,
  "Record the canonical normal RTG coach detail modal frame");
assert.match(openCoachesPart,/coachDetailClassName=id===HALLOWEEN_COACH_ID/,
  "Halloween-only coach must be the sole exception to the ordinary coach frame");
assert.match(openCoachesPart,/"rtg-modal player-detail-modal rtg-coaches-modal"/,
  "All normal coaches opened during Halloween must preserve the black RTG inset frame");
assert.match(openCoachesPart,/"rtg-modal rtg-coach-detail-modal rtg-halloween-picker"/,
  "Hekyll keeps his existing Halloween-only modal styling");
assert.match(openCoachesPart,/classList\?\.remove\?\.\("halloween-detail-native","halloween-detail-vampire"\)/,
  "Opening a coach from the event clears the previously used player-only modal theme");
for (const filename of ["halloween-nathan-fullbody.png","halloween-samford-fullbody.png"]) {
  assert.ok(halloweenCss.includes('img.player-fullbody--fullbody[src$="'+filename+'"]'),
    "Only the two custom Halloween fullbody images must receive the sizing override");
}
assert.ok(halloweenCss.includes("height:69%!important;") &&
  halloweenCss.includes("max-height:69%!important;") &&
  halloweenCss.includes("transform:translateX(-50%) scale(1)!important;"),
  "Both custom fullbodies must fit inside the hero without the default RTG enlargement");
assert.match(halloweenCss,/\.halloween-squad-mode \.rtg-requirement\.bad strong/,
  "Over-cap OVR must display as invalid rather than green");
console.log("RTG Halloween parity: 11 starters + 4 bench, original squad markup, tagged vampire duel render PASS");
