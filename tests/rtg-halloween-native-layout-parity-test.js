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
assert.match(matchView.duelCompareVisualMarkup(event,"opponent"),/halloween-vampiro/);
console.log("RTG Halloween parity: 11 starters + 4 bench, original squad markup, tagged vampire duel render PASS");
