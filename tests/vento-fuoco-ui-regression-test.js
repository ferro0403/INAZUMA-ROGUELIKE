"use strict";
// Event UI + album preflight. No browser, account writes or cloud changes.
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const {loadEventsWithDev}=require("./helpers/events");
const read=file=>fs.readFileSync(file,"utf8");
const fetcher=async url=>({ok:fs.existsSync(String(url)),status:fs.existsSync(String(url))?200:404,
  json:async()=>JSON.parse(read(String(url)))});
(async()=>{
  const context=vm.createContext({console:{warn(){},error(){},log(){}}});
  context.globalThis=context;
  for(const file of ["js/events/event-registry.js","js/road-to-glory/rtg-config.js",
    "js/road-to-glory/rtg-halloween-event.js","js/road-to-glory/rtg-album-view.js"])
    vm.runInContext(read(file),context,{filename:file});
  await loadEventsWithDev(context,"vento_fuoco_dev");
  const module=context.GameEvents.module("vento_fuoco_dev");
  assert(module,"Vento-Fuoco DEV registered");
  await module.prepare(fetcher);
  // Event states are read through their isolated storage key; no sync or writes.
  const account={events:{vento_fuoco_dev:{
    fireBadges:500,windBadges:800,ownedIds:["4539","4538"],pullCount:2,
    completedIds:[],luckyWins:0
  }}};
  const storage={readMany:async keys=>Object.fromEntries(keys.map(key=>[
    key,key==="dev:vento_fuoco_dev:shared:account"?account:null
  ]))};
  const teams=await module.albumTeamsSnapshot(storage);
  assert.equal(teams.length,2);
  assert.deepEqual(Array.from(teams.map(t=>t.teamId)),
    ["vento_fuoco_dev::fire-team","vento_fuoco_dev::blizzard-team"]);
  assert.deepEqual(Array.from(teams.map(t=>[t.unlocked,t.total])),[[1,21],[1,21]]);
  assert.equal(teams[0].entries[0].playerId,"4539");
  assert.equal(teams[1].entries[0].playerId,"4538");
  for(const team of teams){
    for(const fusionId of ["9900001","9900002"]){
      assert.equal(team.roster.filter(p=>p.playerId===fusionId).length,1,
        "both fusion players must appear once in each existing team");
    }
  }
  // Both Miximax cards in both teams is a display-only album projection;
  // owning one card never creates a second collectible/copy.
  account.events.vento_fuoco_dev.ownedIds.push("9900001","9900002");
  const withFusions=await module.albumTeamsSnapshot(storage);
  assert.equal(withFusions.length,2);
  assert.deepEqual(Array.from(withFusions.map(t=>[t.unlocked,t.total])),[[3,21],[3,21]]);
  const windStorage={readMany:async keys=>Object.fromEntries(keys.map(key=>[
    key,key==="dev:vento_fuoco_dev:shared:account"?account:
      key==="dev:vento_fuoco_dev:squad"?
        {activeSquadSlot:2,slots:{"2":{activeRoleVariantByCardId:{
          "vento_fuoco_dev::9900002":"wind"}}}}:null
  ]))};
  const windTeams=await module.albumTeamsSnapshot(windStorage);
  for(const team of windTeams){
    const shaiden=team.roster.find(p=>p.playerId==="9900002");
    assert.equal(shaiden.position,"DF","Album must use the active squad version");
    assert.equal(shaiden.element,"Wind","Wind version must use the ice artwork");
  }
  account.events.vento_fuoco_dev.ownedIds.splice(-2,2);
  const view=context.RoadToGloryAlbumView.create({
    escapeHtml:s=>String(s??"").replaceAll("&","&amp;").replaceAll('"',"&quot;"),
    seasonNumber:()=>1,teamEmblemMarkup:()=>"",albumRarityClass:()=>"",
    albumCoverUrl:"cover.png",albumSeason2CoverUrl:"cover2.png"
  });
  const nativeTeams=view.albumTeamsMarkup({seasonId:"events",teams});
  assert.match(nativeTeams,/ALBUM → GIOCATORI EVENTO/);
  assert.match(nativeTeams,/Fire Team/);
  assert.match(nativeTeams,/Blizzard Team/);
  const nativeCollections=view.albumCollectionMarkup({
    state:{activeSeasonId:"ie1",gachaAcquiredCards:[]},
    collections:[{seasonId:"ie1",total:10,unlocked:0}],eventTeams:teams
  });
  assert.match(nativeCollections,/GIOCATORI EVENTO/);
  assert.match(nativeCollections,/2 \/ 42 giocatori sbloccati/);
  assert.match(nativeCollections,/5%/);
  const html=context.GameEvents.extensionPart("vento_fuoco_dev","home").render({
    teams:()=>teams.map(t=>({teamId:t.originTeamId,name:t.teamName,logo:t.logoUrl})),
    player:pid=>module.eventPlayer(pid),
    escape:s=>String(s),coin:()=>'<span>300</span>',wallet:()=>'<b>FUOCO</b><b>VENTO</b>',
    isOpen:()=>true,countdown:()=>"6g 00h"
  });
  assert.match(html,/class="vf-duel"/);
  assert.match(html,/data-event-team="fire-team"/);
  assert.match(html,/data-event-team="blizzard-team"/);
  assert.match(html,/DISTRIBUTORI/);
  assert.doesNotMatch(html,/data-event-action="album"|data-event-action="squad"/);
  const css=read("css/rtg-halloween-event.css");
  assert.match(css,/halloween-vending:not\(\.vf-vending\):before/);
  assert.match(css,/\.player-detail-layout\.rtg-event--vento_fuoco_dev/);
  assert.match(css,/\.player-card\.rtg-event--vento_fuoco_dev\.rtg-element-fire-team/);
  assert.match(css,/\.player-card\.rtg-event--vento_fuoco_dev\.rtg-element-blizzard-team/);
  const runtime=read("js/road-to-glory/rtg-halloween-event.js");
  assert.match(runtime,/curOf\(pullFieldForTeam\(selectedVendingTeamId\)\)\.unitUpper/);
  assert.match(runtime,/if\(view==="vending"&&TEAM_VENDING\)/);
  const h=context.GameEvents.module("halloween2026");
  assert.equal(h.pullFieldForTeam("occult-2"),"pumpkins");
  assert.equal(h.rewardFieldForTeam("occult-2"),"pumpkins");
  console.log("vento-fuoco-ui-regression-test: PASS (album aggregato, carte, home, valute, Halloween)");
})().catch(error=>{console.error(error);process.exitCode=1;});
