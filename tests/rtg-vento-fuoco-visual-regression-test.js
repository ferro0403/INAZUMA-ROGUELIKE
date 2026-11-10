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
  assert.equal(manifest.extensionCacheVersion,"20261110-vf-hd-native-1");
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
    wallet:()=>"<strong>saldo</strong>",coin:()=>"<strong>300</strong>",
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
  const css=read("css/vento-fuoco-visual.css"),index=read("index.html");
  assert.match(css,/player-card\.rtg-event--vento_fuoco_dev\.rtg-element-fire-team/);
  assert.match(css,/player-card\.rtg-event--vento_fuoco_dev\.rtg-element-blizzard-team/);
  assert.match(css,/player-detail-layout\.rtg-event--vento_fuoco_dev/);
  assert.match(css,/halloween-squad-mode/);
  assert.match(css,/ANd9GcQ4docu4pCKgUNZ2fs/);
  assert.match(css,/duel-hero-v2\.svg/);
  assert.match(css,/\.vf-mini-pitch\.rtg-squad-shell \.rtg-squad-pitch-main/);
  assert.ok(index.includes("css/vento-fuoco-visual.css?v=20261110-vf-fullhero-3"));
  assert.ok(index.includes("js/road-to-glory/rtg-halloween-event.js?v=20261110-vf-artwork-final-1"));
  const runtime=read("js/road-to-glory/rtg-halloween-event.js");
  assert.match(runtime,/function restoreEventOpponentCrests/);
  assert.match(runtime,/function visualSquadStrength/);
  assert.match(runtime,/deps\.squadView\?\.matchPitchMarkup\?\./);
  assert.match(runtime,/mode:"preview"/);
  assert.match(runtime,/vf-reward-balance-value/,"only event reward has structured balance");
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
  assert.match(css,/vf-reward-balance-value/,"existing reward balance preserved");
  assert.match(css,/vf-reward-return/,"reward detail has explicit return UI");
  assert.match(runtime,/data-vf-return-to-reward/,"detail can return to committed reward");
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
  console.log("vento-fuoco-visual-regression-test: PASS (HD card/detail AVIF, native Squadra XI, clean technical sheet, 22 players, cap 92, reward-back, no old art)");
})().catch(error=>{console.error(error);process.exitCode=1;});
