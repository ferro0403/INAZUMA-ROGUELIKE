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
  assert.equal(manifest.extensionCacheVersion,"20261109-vf-visual-2");
  const api=context.GameEvents.module("vento_fuoco_dev");
  const part=context.GameEvents.extensionPart("vento_fuoco_dev","home");
  assert.ok(part?.render,"Home extension loaded through versioned manifest");
  await api.prepare(fetcher);
  const teams=manifest.teams.map(team=>({teamId:team.teamId,name:team.name,logo:team.logo}));
  const previews=manifest.teams.map(team=>({teamId:team.teamId,overall:api.opponentOverall(team.teamId)}));
  assert.deepEqual(previews.map(item=>item.overall),[91,91]);
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
  assert.equal((html.match(/class="vf-mini-pitch"/g)||[]).length,2);
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
  assert.match(css,/\.vf-mini-pitch \.rtg-squad-pitch-main/);
  assert.ok(index.includes("css/vento-fuoco-visual.css?v=20261109-vf-visual-2"));
  assert.ok(index.includes("js/road-to-glory/rtg-halloween-event.js?v=20261109-vf-visual-2"));
  const runtime=read("js/road-to-glory/rtg-halloween-event.js");
  assert.match(runtime,/function restoreEventOpponentCrests/);
  assert.match(runtime,/function visualSquadStrength/);
  assert.match(runtime,/deps\.squadView\?\.matchPitchMarkup\?\./);
  assert.match(runtime,/mode:"preview"/);
  assert.match(runtime,/\(localSquad\.lineup\|\|\[\]\)\.findIndex/);
  assert.match(runtime,/Math\.round\(\(\(sum-amount\)\/11\)\*10\)\/10/);
  const halloween=context.GameEvents.module("halloween2026");
  assert.equal(halloween.pullFieldForTeam("occult-2"),"pumpkins");
  assert.equal(halloween.rewardFieldForTeam("occult-2"),"pumpkins");
  console.log("vento-fuoco-visual-regression-test: PASS (2 pitch Squadra nativi, 22 giocatori, cap 92, art v2, cache, Halloween)");
})().catch(error=>{console.error(error);process.exitCode=1;});
