"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");
const read=path=>fs.readFileSync(path,"utf8");
const index=read("index.html");
const home=read("js/home/home-view.js");
const picker=read("js/road-to-glory/rtg-squad-controller.js");
const event=read("js/road-to-glory/rtg-halloween-event.js");
const run=read("js/road-to-glory/rtg-run-view.js");
const css=read("css/rtg-release-polish-20261030.css");

test("Mobile RTG home: compact CTA and existing navigation contracts",()=>{
  assert.match(home,/home-rtg-hero--compact/);
  assert.match(home,/ENTRA NELLE CAMPAGNE/);
  assert.match(home,/data-rtg-home-open="campaigns"/);
  for(const section of ["squad","vending","album","shop","development"])
    assert.match(home,new RegExp(`data-rtg-home-open=\\\"${section}\\\"`));
  assert.match(css,/home-rtg-shortcuts--compact/);
  assert(index.includes("css/rtg-release-polish-20261030.css?v=1"));
  assert(index.includes("home-view.js?v=20260923-rtg-direct-paint-p1-compact-v1"),
    "Mobile home HTML must be cache-busted");
});

test("Evolved Halloween player filters read owned rarity first, not source character",()=>{
  const rarityBody=picker.slice(picker.indexOf("function squadPickerRarity(playerId)"),
    picker.indexOf("function squadPickerRarityOptions()"));
  assert(rarityBody.includes("evolved?.finalRarity || evolved?.category"));
  assert(rarityBody.indexOf("evolved?.finalRarity") < rarityBody.indexOf("deps.playerResolver.rarity"),
    "A source rarity must NEVER shadow an evolved owned card");
  const upgraded={category:"Elite",finalRarity:"Mondiale",overall:90};
  const sourceRarity="Forte";
  const effective=upgraded.finalRarity||upgraded.category||sourceRarity;
  assert.equal(effective,"Mondiale");
  assert.notEqual(effective,sourceRarity);
  assert(index.includes("rtg-squad-controller.js?v=20261025-rtg-priority-v1-evolved-rarity-v1"));
});

test("Svincolati modal keeps the exact data-rtg-start-node action with clearer CTA",()=>{
  assert(run.includes("rtg-node-modal--secondary"));
  assert(run.includes("rtg-secondary-start"));
  assert(run.includes("PREPARA PARTITA"));
  assert(run.includes("data-rtg-start-node"));
  assert(!run.includes("rtg-node-modal-secondary"));
  assert(css.includes("rtg-secondary-facts"));
  assert(index.includes("rtg-run-view.js?v=20261011-balanced-economy-1-secondary-polish-v1"));
});

test("Event Halloween opponent preview reuses the real native tactical pitch, 11 unique assets",()=>{
  const lineup=JSON.parse(read("data/rtg-halloween-occult-lineup.json")).teams[0];
  const team=JSON.parse(read("data/rtg-halloween-occult-players.json"))[0];
  assert.equal(lineup.startingXI.length,11);
  assert.equal(new Set(lineup.startingXI).size,11);
  const playerById=new Map(team.players.map(p=>[String(p.playerId),p]));
  assert(lineup.startingXI.every(id=>playerById.has(id)));
  const ctx={console};ctx.globalThis=ctx;
  vm.runInNewContext(read("js/road-to-glory/rtg-config.js"),ctx);
  vm.runInNewContext(read("js/road-to-glory/rtg-squad-view-base.js"),ctx);
  vm.runInNewContext(read("js/road-to-glory/rtg-match-view.js"),ctx);
  const compact=(p,o)=>`<span class="card" ${o?.dataAttr||""}>${p.playerId}</span>`;
  const squadView=ctx.RoadToGlorySquadView.create({
    escapeHtml:String,compactPlayerCardMarkup:compact,playerResolver:{resolveAtLevel20:()=>null}
  });
  const matchView=ctx.RoadToGloryMatchView.create({
    escapeHtml:String,compactPlayerCardMarkup:compact,
    teamEmblemMarkup:()=>"",
    squadPitchMarkup:(squad,options)=>squadView.matchPitchMarkup(squad,options)
  });
  const formation={
    name:"Occult Halloween",formationId:"4-4-2",seasonId:"halloween2026",
    lineup:lineup.startingXI.map(id=>({
      ...playerById.get(id),playerId:id,cardId:"halloween2026::"+id,
      normalizedRole:playerById.get(id).position,
      tacticalRole:playerById.get(id).position
    }))
  };
  const html=matchView.formationPitchMarkup(formation,"opponent","prematch");
  assert(html.includes("rtg-match-squad-field-shell"));
  assert.equal((html.match(/data-rtg-prematch-player=/g)||[]).length,11,
    "The SAME native match preview must show all 11 Halloween cards");
  assert.equal(new Set(Array.from(html.matchAll(/data-rtg-prematch-player="([^"]+)"/g),m=>m[1])).size,11);
  assert.match(event,/opponentPreviewSection\(\)/);
  assert.match(event,/deps\.matchView\?\.formationPitchMarkup\?\.\(formation,"opponent","prematch"\)/);
  assert(event.indexOf("'</section>'+opponentPreviewSection()") > event.indexOf("data-halloween-open-vending"));
  assert(css.includes("halloween-opponent-preview-field"));
  assert(index.includes("rtg-halloween-event.js?v=20261030-squad-player-preview-v22-release-polish-v1"));
});

test("Release scope: the requested UI changes never write save, cloud or rewards",()=>{
  const result=event.slice(event.indexOf("function opponentPreviewSection()"),
    event.indexOf("function squadSection()"));
  assert.doesNotMatch(result,/storage\.|repository\.|mutate\(|localStorage|firebase|\.update\(/i);
  const view=home.slice(home.indexOf("function homeRtgHubMarkup()"),home.indexOf("function homePagerMarkup("));
  assert.doesNotMatch(view,/localStorage|firebase|indexedDB|repository\.update/);
});
