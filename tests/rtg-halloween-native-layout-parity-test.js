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
const eventSource=fs.readFileSync("js/road-to-glory/rtg-halloween-event.js","utf8");
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
