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
const css=[read("css/game.css"),read("css/rtg-run.css"),read("css/rtg-halloween-event.css")].join("\n");

test("Mobile RTG home: compact CTA and existing navigation contracts",()=>{
  assert.match(home,/home-rtg-hero--compact/);
  assert.match(home,/ENTRA NELLE CAMPAGNE/);
  assert.match(home,/data-rtg-home-open="campaigns"/);
  // The menu is data-driven; validate all declared destinations AND the live binding.
  const shortcuts=home.match(/const shortcuts=\[([\s\S]*?)\];/)?.[1]||"";
  for(const section of ["squad","vending","album","shop","development"])
    assert(shortcuts.includes('["'+section+'",'),"Missing shortcut "+section);
  assert.match(home,/data-rtg-home-open="\$\{target\}"/);
  assert.match(css,/home-rtg-shortcuts--compact/);
  assert(!index.includes("rtg-release-polish-20261030.css"),"No illegal finishing stylesheets");
  assert(index.includes("css/game.css?v=20261030-rtg-home-owner-v4"));
  assert(index.includes("css/rtg-theme.css?v=20261030-secondary-briefing-owner-v4"));
  assert(index.includes("css/rtg-halloween-event.css?v=20261030-native-XI-owner-v17"));
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
  assert(css.includes("rtg-secondary-summary"));
  assert(index.includes("rtg-run-view.js?v=20261030-secondary-redesign-v2"));
});

test("Halloween XI: EXACT original prematch cards, HW badges and Album detail routing",()=>{
  const lineup=JSON.parse(read("data/rtg-halloween-occult-lineup.json")).teams[0];
  const team=JSON.parse(read("data/rtg-halloween-occult-players.json"))[0];
  assert.equal(lineup.startingXI.length,11);
  assert.equal(new Set(lineup.startingXI).size,11);
  const playerById=new Map(team.players.map(p=>[String(p.playerId),p]));
  assert(lineup.startingXI.every(id=>playerById.has(id)));
  const ctx={console};ctx.globalThis=ctx;
  for(const script of ["js/road-to-glory/rtg-card-identity.js",
    "js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-squad-view-base.js",
    "js/road-to-glory/rtg-match-view.js"])
    vm.runInNewContext(read(script),ctx,{filename:script});
  assert.equal(ctx.RoadToGloryCardIdentity.legacyLabel("halloween2026"),"HW");
  // Reflect the important part of canonical PlayerView.compactCard:
  // its markup includes the trailing legacy badge from SquadView.playerCard.
  const compact=(p,o)=>`<button type="button" class="player-card halloween-event-card"
    ${o.dataAttr||""}><span class="player-role">${p.position}</span>
    <span class="player-overall">${p.overall}</span>
    <img class="player-portrait" alt="" src="${p.portraitUrl||""}">
    <strong class="player-name">${p.name}</strong>${o.trailingMarkup||""}</button>`;
  const squadView=ctx.RoadToGlorySquadView.create({
    escapeHtml:String,compactPlayerCardMarkup:compact,playerResolver:{resolveAtLevel20:()=>null}
  });
  let rendererCalls=0;
  const matchView=ctx.RoadToGloryMatchView.create({
    escapeHtml:String,compactPlayerCardMarkup:compact,
    squadPitchMarkup:(squad,options)=>{
      rendererCalls++;
      return squadView.matchPitchMarkup(squad,options);
    }
  });
  const formation={
    name:"Occult Halloween",formationId:"4-4-2",seasonId:"halloween2026",
    lineup:lineup.startingXI.map(id=>({
      ...playerById.get(id),playerId:id,cardId:"halloween2026::"+id,
      legacySeasonId:"halloween2026",normalizedRole:playerById.get(id).position,
      tacticalRole:playerById.get(id).position
    }))
  };
  const html=matchView.formationPitchMarkup(formation,"opponent","prematch");
  assert.equal(rendererCalls,1,"Must use the ACTUAL native prematch squad renderer");
  assert.match(html,/rtg-match-squad-field-shell/);
  assert.equal((html.match(/class="rtg-legacy-badge rtg-legacy-tab" data-legacy-season="HW"/g)||[]).length,11,
    "Every original Halloween card needs the actual black HW badge");
  assert.equal((html.match(/class="player-role"/g)||[]).length,11);
  assert.equal((html.match(/class="player-overall"/g)||[]).length,11);
  assert.equal((html.match(/class="player-portrait"/g)||[]).length,11);
  assert.equal((html.match(/class="player-name"/g)||[]).length,11);
  const ids=Array.from(html.matchAll(/data-rtg-prematch-player="([^"]+)"/g),m=>m[1]);
  assert.equal(ids.length,11);
  assert.equal(new Set(ids).size,11);
  assert.deepEqual(ids,Array.from(lineup.startingXI,id=>"halloween2026::"+id),
    "The real lineup IDs must survive into Album card click data");
  // Share the actual prematch renderer AND its CSS ancestor. Without this
  // context, iOS does not display the original FW/OVR + rarity corner rules.
  const actualPrematchSource=read("js/road-to-glory/rtg-match-view.js");
  const canonicalCSS=read("css/game.css");
  assert(actualPrematchSource.includes("boss-match-screen rtg-prematch-shell rtg-prematch-revolution development-squad-card-scope"));
  assert(event.includes("halloween-opponent-preview-field rtg-prematch-shell development-squad-card-scope"));
  assert(canonicalCSS.includes(":is(.squad-screen, .development-squad-card-scope) .squad-player-card .player-role, :is(.squad-screen, .development-squad-card-scope) .squad-player-card .player-overall {"));
  assert(canonicalCSS.includes(":is(.squad-screen, .development-squad-card-scope) .squad-player-card::before"));
  assert(!event.includes("nativeMatchCards:true"), "No substitute renderer: use the prematch original");
  assert.match(event,/const pitch=deps\.matchView\?\.formationPitchMarkup\?\.\(formation,"opponent","prematch"\)/);
  assert.match(event,/rawId\.startsWith\(EVENT_ID\+"::"\)\?rawId\.slice\(EVENT_ID\.length\+2\):rawId/);
  assert.match(event,/openNativeDetail\(EVENT_ID\+"::"\+pid,isOwned\(pid\),true\)/,
    "Every field card must open the canonical Halloween Album player detail");
  assert(event.indexOf("'</section>'+opponentPreviewSection()") > event.indexOf("data-halloween-open-vending"));
  assert.match(css,/\.halloween-opponent-preview-field\.rtg-prematch-shell/);
  assert.doesNotMatch(css,/Exact tactical card anatomy|rtg-shared-match-card\.boss-match-card/);
  assert(index.includes("rtg-halloween-event.js?v=20261030-squad-player-preview-v22-original-css-scope-v4"));
});

test("Release scope: the requested UI changes never write save, cloud or rewards",()=>{
  const result=event.slice(event.indexOf("function opponentPreviewSection()"),
    event.indexOf("function squadSection()"));
  assert.doesNotMatch(result,/storage\.|repository\.|mutate\(|localStorage|firebase|\.update\(/i);
  const view=home.slice(home.indexOf("function homeRtgHubMarkup()"),home.indexOf("function homePagerMarkup("));
  assert.doesNotMatch(view,/localStorage|firebase|indexedDB|repository\.update/);
});
