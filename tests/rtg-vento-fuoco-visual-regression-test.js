"use strict";
// Regressione grafica: dati reali DEV, due formazioni, cap/OVR e isolamento UI.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {loadEventsWithDev}=require("./helpers/events");
const read=file=>fs.readFileSync(file,"utf8");
const fetcher=async url=>({
  ok:fs.existsSync(String(url)),json:async()=>JSON.parse(read(String(url)))
});
(async()=>{
  const context=vm.createContext({console:{warn(){},log(){},error(){}}});
  context.globalThis=context;
  for(const file of ["js/events/event-registry.js","js/road-to-glory/rtg-config.js",
    "js/road-to-glory/rtg-halloween-event.js"])vm.runInContext(read(file),context,{filename:file});
  await loadEventsWithDev(context,"vento_fuoco_dev");
  const manifest=context.GameEvents.get("vento_fuoco_dev");
  assert.equal(context.GameEvents.validate(manifest).length,0,"manifest paths remain valid");
  assert.equal(manifest.extensionCacheVersion,"20261110-vf-ui-polish-5");
  const api=context.GameEvents.module("vento_fuoco_dev");
  const part=context.GameEvents.extensionPart("vento_fuoco_dev","home");
  assert.ok(part?.render,"Home extension loaded through versioned manifest");
  await api.prepare(fetcher);
  const teams=manifest.teams.map(team=>({teamId:team.teamId,name:team.name,logo:team.logo}));
  const previews=manifest.teams.map(team=>({teamId:team.teamId,overall:api.opponentOverall(team.teamId)}));
  assert.deepEqual(Array.from(previews,item=>item.overall),[91,91]);
  const initial={current:90.6,max:92,maxByTeam:{"fire-team":92,"blizzard-team":92}};
  // Exercise the production Squadra pitch renderer with the event's
  // canonical 3-4-3 roster, instead of accepting a synthetic thumbnail grid.
  vm.runInContext(read("js/road-to-glory/rtg-squad-view-base.js"),context);
  const pitchView=context.RoadToGlorySquadView.create({
    escapeHtml:s=>String(s??"").replaceAll("&","&amp;").replaceAll('"',"&quot;"),
    formationLayout:{displayRows:()=>[
      {role:"FW",count:3},{role:"MF",count:4},{role:"DF",count:3},{role:"GK",count:1}
    ]},
    compactPlayerCardMarkup:(player,opts)=>'<button class="player-card '+opts.extraClass+'" '+
      opts.dataAttr+'><strong>'+player.name+'</strong></button>'
  });
  const html=part.render({
    teams:()=>teams,
    squadStrength:()=>initial,
    matchPreview:teamId=>{
      const entry=manifest.teams.find(t=>t.teamId===teamId);
      const key=teamId==="fire-team"?"fire":"blizzard";
      const setup=JSON.parse(read("data/events/vento_fuoco/"+key+"-team-lineup.json")).teams.find(t=>t.teamId===teamId);
      const lineup=setup.startingXI.map(id=>api.eventPlayer(id));
      const pitchMarkup=pitchView.matchPitchMarkup(
        {formationId:setup.bossFormation,lineup},{side:"opponent",mode:"preview"}
      );
      return {formationId:setup.bossFormation,overall:api.opponentOverall(teamId),
        lineup,pitchMarkup};
    },
    player:pid=>api.eventPlayer(pid),
    wallet:()=>"<strong>saldo</strong>",coin:amount=>'<span class="halloween-currency"><img src="currency-icon.png" alt="">'+amount+"</span>",
    isOpen:()=>true,countdown:()=>"6g"
  });
  assert.match(html,/FORZA ATTUALE/);
  assert.match(html,/FORZA MASSIMA/);
  assert.match(html,/<strong>90\.6<\/strong>/);
  assert.match(html,/<strong>92<\/strong>/);
  assert.equal((html.match(/<details class="vf-rival__lineup"/g)||[]).length,2);
  assert.doesNotMatch(html,/<details class="vf-rival__lineup"[^>]*\bopen\b/);
  assert.equal((html.match(/class="vf-rival__lineup-toggle"/g)||[]).length,2);
  assert.equal((html.match(/class="vf-mini-pitch development-squad-card-scope rtg-squad-shell"/g)||[]).length,2);
  assert.equal((html.match(/class="pitch rtg-squad-pitch-main"/g)||[]).length,2);
  assert.equal((html.match(/class="pitch-row tactical-row"/g)||[]).length,8);
  assert.equal((html.match(/data-rtg-lineup-player="/g)||[]).length,22);
  assert.doesNotMatch(html,/class="vf-lineup-player"/);
  assert.match(html,/VEDI 11 IN CAMPO/);
  assert.equal((html.match(/data-event-action="start"/g)||[]).length,2);
  assert.ok(html.includes(teams[0].logo)&&html.includes(teams[1].logo),"real team crests");
  assert.doesNotMatch(html,/data-event-action="squad"|data-event-action="album"/);

  assert.equal((html.match(/class="vf-rival__reward"/g)||[]).length,4,
    "both team banners use two concise reward rows");
  assert.equal((html.match(/Vittoria fortunata:/g)||[]).length,2);
  assert.equal((html.match(/>600<\/span>/g)||[]).length,2,
    "600 gettoni must render the same icon+amount component as 300");
  assert.equal((html.match(/gettoni<\/small>/g)||[]).length,2);
  assert.doesNotMatch(html,/Fortunata 20%|Limite formazione:/,
    "old text and duplicate limits must be absent");
  const css=read("css/vento-fuoco-visual.css"),index=read("index.html");
  assert.match(css,/player-card\.rtg-event--vento_fuoco_dev\.rtg-element-fire-team/);
  assert.match(css,/player-card\.rtg-event--vento_fuoco_dev\.rtg-element-blizzard-team/);
  assert.match(css,/player-detail-layout\.rtg-event--vento_fuoco_dev/);
  assert.match(css,/halloween-squad-mode/);
  assert.match(css,/ANd9GcQ4docu4pCKgUNZ2fs/);
  assert.match(css,/duel-hero-v2\.svg/);
  assert.match(css,/\.vf-mini-pitch\.rtg-squad-shell \.rtg-squad-pitch-main/);
  assert.ok(index.includes("css/vento-fuoco-visual.css?v=20261110-vf-ui-polish-5"));
  assert.ok(index.includes("js/road-to-glory/rtg-halloween-event.js?v=20261110-vf-ui-polish-5"));
  const runtime=read("js/road-to-glory/rtg-halloween-event.js");
  assert.match(runtime,/function restoreEventOpponentCrests/);
  assert.match(runtime,/function visualSquadStrength/);
  assert.match(runtime,/deps\.squadView\?\.matchPitchMarkup\?\./);
  assert.match(runtime,/mode:"preview"/);
  assert.match(runtime,/deps\.runView\.pullResultMarkup\(drawn\.result,drawn\.player/,
    "Vento-Fuoco must use the canonical RTG result renderer");
  assert.match(runtime,/const rewardClass=TEAM_VENDING&&!isCoach/,
    "event reward must use the ordinary RTG modal instead of Halloween");

  assert.match(runtime,/markup=markup\.replace\("rtg-picker-squad-card rtg-pull-player-card"/,
    "prize player card must use the Squadra variant, not the picker variant");
  assert.match(runtime,/const nativeSquad=view\.markup\(/,"original Squadra renderer stays intact");
  assert.match(runtime,/app\.querySelectorAll\?\.\("nav\.rtg-bottom-nav"\)/,
    "remove nested Home and Squadra navs");
  assert.match(runtime,/app\.insertAdjacentHTML\("beforeend"/,
    "one nav is inserted as an app child in both views");
  assert.match(runtime,/footer\(view==="squad"\?"squad":"run"\)/);
  assert.match(runtime,/vf-nav-switch__home/);
  assert.match(runtime,/vf-nav-switch__squad/);
  assert.doesNotMatch(runtime,/nativeSquad\.replace\(/,
    "the native Squadra cards/markup are not rewritten");
  assert.doesNotMatch(runtime,/vf-reward-balance-value/,
    "do not reconstruct the canonical balance/card markup");
  assert.doesNotMatch(runtime,/vf-squad-strength|vf-prematch-strength|strengthStrip\(/,
    "no additional strength banner in Squadra or pre-partita");
  assert.match(runtime,/function visualSquadStrength\(/,
    "OVR projections and eligibility must remain intact");
  assert.match(runtime,/const all=userCards\(\)\.filter\(id=>id!==cardId\)\.map\(id=>\{/,
    "event cards in bench remain in the full Cambia player list");
  assert.doesNotMatch(runtime,/!quickIds\.has\(id\)/,
    "quick bench must never exclude candidates from the full picker");
  assert.match(runtime,/const shown=list=>eventOnly\?list:list\.slice\(0,visibleCount\)/,
    "event players do not disappear behind pagination");
  assert.match(runtime,/data-vf-picker-event-only/,
    "native picker has a full Vento-Fuoco event collection shortcut");
  assert.match(runtime,/e\.seasonId===EVENT_ID/,
    "event-only filter selects the active event's actually owned cards");
  // HD assets are distinct source crops: small card vs tall player sheet.
  const files=[
    ["fire-card-hd.avif",1024,768],["ice-card-hd.avif",1024,768],
    ["fire-detail-hd.avif",1086,1448],["ice-detail-hd.avif",1086,1448]
  ];
  for(const [asset,width,height] of files){
    const path="assets/events/vento-fuoco/"+asset;
    assert.ok(fs.existsSync(path),"HD artwork missing: "+asset);
    const bytes=fs.readFileSync(path);
    assert.ok(bytes.length>25000,"artwork must retain detailed image pixels");
    assert.equal(bytes.subarray(4,12).toString("ascii"),"ftypavif");
    const at=bytes.indexOf(Buffer.from("ispe","ascii"));
    assert.ok(at>0,"AVIF image dimensions missing");
    assert.equal(bytes.readUInt32BE(at+8),width,"HD artwork width");
    assert.equal(bytes.readUInt32BE(at+12),height,"HD artwork height");
    assert.match(css,new RegExp(asset.replace(".","\\.")));
  }
  for(const unused of ["fire-event.webp","ice-event.webp",
    "fire-card-bg.svg","ice-card-bg.svg","fire-event-v5.svg","ice-event-v5.svg",
    "fire-event-v6.svg","ice-event-v6.svg","fire-portrait-patch.svg","ice-portrait-patch.svg"]){
    assert.equal(fs.existsSync("assets/events/vento-fuoco/"+unused),false,
      "Unused low-res or prototype artwork must be removed: "+unused);
  }
  // Native field/lineup card sizing is authoritative, never redrawn in Home.
  assert.match(css,/\.vf-mini-pitch\.rtg-squad-shell/);
  const nativeCss=read("css/rtg-theme-base.css");
  assert.match(nativeCss,/\.rtg-squad-shell,\.rtg-prematch-shell/);
  assert.doesNotMatch(css,/\.vf-mini-pitch[^\n]*\.player-card\s*\{/,
    "Home event must not restyle individual Squadra cards");
  assert.match(css,/\.player-detail-hero::after\{\s*content:none!important;display:none!important/,
    "the old red/blue diagonal layer must be absent");
  assert.match(css,/var\(--vf-detail-art\) center center \/ cover no-repeat!important/,"Fire/Ice HD art must cover the entire top hero");
  assert.match(css,/rgba\(255,251,242,\.93\)/,"soft ivory veil keeps text readable");
  assert.match(css,/rgba\(255,251,242,\.68\) 61%/,"mobile labels stay protected by the veil");
  assert.match(css,/\.player-detail-identity\{[\s\S]*?background:transparent!important;/,"all information sits over the same artwork, not a rectangular slab");
  assert.match(css,/\.player-detail-visual\{[\s\S]*?background:none!important;\s*border:0!important;/,"visual column must not duplicate/cut the background");
  assert.match(css,/\.player-detail-content\{[\s\S]*?background:linear-gradient\(180deg,#f9fdff,#fffbf4\)!important/,"statistics keep a separate clean paper background");
  assert.match(css,/\.overall-comparison>div\{[\s\S]*?background:#fffdf8!important/,"OVR and potential remain legible");
  assert.match(css,/\.detail-category\{[\s\S]*?background:#fffdf6!important/,"rarity remains legible");
  // Same tier-based rarity colours as the normal detail sheet, not Fire/Ice
  // team colours. Element chips are independently themed.
  const detailCss=read("css/player-detail.css");
  for(const tier of ["scarso","debole","normale","buono","forte","elite","mondiale","leggenda"]){
    assert.match(detailCss,new RegExp("\\.player-detail-layout\\.rarity-"+tier+"\\b"),
      "canonical rarity variable absent: "+tier);
  }
  assert.match(css,/border-left:9px solid var\(--detail-rarity-accent\)!important/,
    "Mondiale red and every other rarity retain the native stripe colour");
  assert.match(css,/\.detail-category span\{\s*color:var\(--detail-rarity-accent\)!important/,
    "native rarity-coloured star restored");
  assert.match(css,/\.rtg-element-fire-team \.detail-element-chip\{/);
  assert.match(css,/border-color:#bc2634!important/,"Fire element chip is red");
  assert.match(css,/\.rtg-element-blizzard-team \.detail-element-chip\{/);
  assert.match(css,/border-color:#168acb!important/,"Wind/Blizzard chip is blue");
  assert.doesNotMatch(css,/\.detail-category \*\{color:#07131e!important\}/,
    "do not override rarity colours to black");
  const nativeResult=read("js/road-to-glory/rtg-run-view.js");
  assert.match(nativeResult,/function pullResultMarkup\(/,
    "normal RTG prize renderer must remain source of truth");
  assert.match(nativeResult,/rtg-pull-result-head/);
  assert.match(nativeResult,/rtg-pull-result-body/);
  assert.match(nativeResult,/rtg-pull-balance/);
  assert.doesNotMatch(css,/\.vf-squad-strength|\.vf-prematch-strength/,
    "unused top banners must not have event-specific styles");
  assert.doesNotMatch(read("css/rtg-halloween-event.css"),/\.rtg-halloween-pull-modal\.vf-reward-/,
    "obsolete rebuilt VF reward styles must be removed from shared Halloween CSS");

  assert.match(css,/\.player-detail-visual > \.player-fullbody\{[\s\S]*?visibility:visible!important;opacity:1!important/,"fullbody stays visible");
  assert.match(css,/overflow-wrap:anywhere!important/,"long player names stay inside the white panel");
  assert.match(css,/\.vf-mini-pitch\.rtg-squad-shell\{[\s\S]*?min-height:0!important;[\s\S]*?background-image:none!important;/,
    "nested XI must not inherit full-screen stadium min-height or photo from RTG shell");
  assert.match(css,/\.player-detail-layout\.rtg-event--vento_fuoco_dev \.player-detail-visual\{[\s\S]*?position:absolute!important;[\s\S]*?bottom:0!important;left:47%!important;/,
    "event fullbody artwork uses native absolute panel, never a zero-height relative block");
  assert.match(css,/\.player-detail-layout\.rtg-event--vento_fuoco_dev \.player-detail-visual > \.player-fullbody\{/,
    "character rendering must remain visible in the native player sheet");
  assert.doesNotMatch(css,/position:relative;z-index:1;min-width:0;\s*background:var\(--vf-detail-art\)/,
    "regression: collapsed detail art panel must never return");
  assert.match(css,/PlayerView nativo/,"original RTG card owns portrait/OVR/role");
  assert.match(css,/border:3px solid var\(--vf-card-accent\)!important/);
  assert.match(css,/background:linear-gradient\(180deg,#111b2d,#07101c\)!important/);
  assert.match(css,/VF ha esattamente le dimensioni/);
  assert.match(css,/height:16px!important/,"VF badge same size as AR/S1");
  assert.match(css,/bottom:-11px!important/);
  assert.match(css,/--rtg-legacy-color:#df2e42!important/,"red Fire badge");
  assert.match(css,/--rtg-legacy-color:#1978d8!important/,"blue Ice badge");
  assert.match(css,/::before\{\s*content:none!important;display:none!important/,"rarity stripe is removed only on event cards");
  assert.match(css,/A skin on the ORIGINAL RoadToGloryRunView\.pullResultMarkup/);
  assert.match(css,/\.modal\.rtg-modal\.rtg-pull-modal\.vf-reward-fire/);
  assert.match(css,/\.modal\.rtg-modal\.rtg-pull-modal\.vf-reward-ice/);

  assert.match(css,/rtg-pull-card-stage>\.rtg-squad-player-card/,
    "native Squadra dimensions on the event reward");
  assert.match(css,/rtg-pull-card-stage>\.rtg-squad-player-card \.player-portrait-wrap/,
    "portrait is contained within its own event card frame");
  assert.match(css,/z-index:10!important/,"role and OVR above large player hair");
  assert.match(css,/\.rtg-pull-result-body\{[\s\S]*?border-left:4px solid var\(--vf-pull-accent\)!important/,
    "native RTG prize gets a Fire/Ice accent without a custom result layout");
  assert.match(css,/\.vf-nav-switch\.bottom-nav\.rtg-bottom-nav/,
    "one red/blue navigation in Home and Squadra");
  assert.match(css,/\.vf-nav-dock \.vf-nav-switch\.bottom-nav\.rtg-bottom-nav/,
    "both nav screens have identical parent-level layout geometry");
  assert.match(css,/\.vf-picker-event-filter>button/,
    "native Cambia has a visible event-only filter");
  assert.match(css,/vf-nav-switch__home\.active/);
  assert.match(css,/vf-nav-switch__squad\.active/);
  assert.match(css,/\.halloween-squad-mode \.rtg-squad-head-stats \.squad-field-formation/,
    "formation badge no longer orange");
  assert.match(css,/\.vf-rival__reward \.halloween-currency img/,
    "matching small reward icons");
  assert.doesNotMatch(css,/vf-reward-balance-value|grid-template-columns:132px minmax\(0,1fr\)!important/,
    "original RTG result dimensions/markup must not be recreated");
  assert.doesNotMatch(css,/vf-reward-return/,"no extra yellow return button inside the detail");
  assert.doesNotMatch(runtime,/data-vf-return-to-reward/,
    "native X is the only return control");
  assert.match(runtime,/event\.target\?\.closest\?\.\("\.modal-close"\)/,
    "native X returns to the same reward without a second pull");
  assert.match(runtime,/const showReward=\(\)=>/,"return does not run a second pull");
  assert.match(runtime,/openPreviewPlayer:cardId=>/,"opponent pitch cards are actionable");
  assert.match(runtime,/const pitchMarkup=String\(pitch\)/,
    "native player cards must not be rendered unfocusable");
  const eventHome=read("js/events/vento_fuoco_dev/home.js");
  assert.match(eventHome,/function bindHome\(root,tools\)/);
  assert.match(eventHome,/tools\.openPreviewPlayer\?\.\(cardId\)/);
  assert.doesNotMatch(css,/fire-event-v[56]\.svg|ice-event-v[56]\.svg|portrait-patch\.svg|card-bg\.svg/);
  const halloweenStyles=read("css/rtg-halloween-event.css");
  assert.doesNotMatch(halloweenStyles,/\.player-card\.rtg-event--vento_fuoco_dev/,
    "legacy event card theme must not also live in shared Halloween CSS");
  assert.doesNotMatch(halloweenStyles,/\.player-detail-layout\.rtg-event--vento_fuoco_dev/,
    "old element detail theme must be removed from shared CSS");
  assert.match(runtime,/\(localSquad\.lineup\|\|\[\]\)\.findIndex/);
  assert.match(runtime,/Math\.round\(\(\(sum-amount\)\/11\)\*10\)\/10/);
  const halloween=context.GameEvents.module("halloween2026");
  assert.equal(halloween.pullFieldForTeam("occult-2"),"pumpkins");
  assert.equal(halloween.rewardFieldForTeam("occult-2"),"pumpkins");
  console.log("vento-fuoco-visual-regression-test: PASS (picker slot parity, single nav dock, X reward return, HD art, 22 players)");
})().catch(error=>{console.error(error);process.exitCode=1;});
