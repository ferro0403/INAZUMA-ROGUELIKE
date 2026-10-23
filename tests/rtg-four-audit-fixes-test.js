"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const path of [
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-gacha.js",
  "js/road-to-glory/rtg-progression.js",
  "js/road-to-glory/rtg-album-controller.js",
  "js/road-to-glory/rtg-route-view.js",
  "js/road-to-glory/rtg-match-view.js",
])vm.runInContext(fs.readFileSync(path,"utf8"),ctx,{filename:path});
const C=ctx.RoadToGloryConfig,G=ctx.RoadToGloryGacha,I=ctx.RoadToGloryCardIdentity,P=ctx.RoadToGloryProgression;
const seasons=[
  {id:"ie1",dbPath:"data/IE1_season_compact.json",cost:250},
  {id:"ie1_s2",dbPath:"data/IE1_S2_season_compact.json",cost:200},
  {id:"ie1_s3",dbPath:"data/IE1_S3_season_compact.json",cost:180,free:288,total:584},
  {id:"ie2",dbPath:"data/IE2_season_compact.json",cost:250},
  {id:"orion",dbPath:"data/ORION_season_compact.json",cost:200,free:129,total:309},
];
(async()=>{
  const route=ctx.RoadToGloryRouteView.create({escapeHtml:String,teamEmblemMarkup:()=>"",seasonNumber:id=>C.season(id)?.seasonNumber||1,header:()=>"",tabs:()=>""});
  for(const item of seasons){
    const cfg=C.season(item.id),db=JSON.parse(fs.readFileSync(item.dbPath,"utf8"));
    assert.strictEqual(cfg.pullCost,item.cost);
    const state={activeSeasonId:item.id,seasonComplete:false,currentNodeId:C.buildSeasonNodes(item.id)[0].id,tokens:350,lives:2,defeatedTeamIds:[],attemptsByNode:{}};
    const markup=route.runMarkup({state,nodes:C.buildSeasonNodes(item.id),seasonDb:db,seasonConfig:cfg});
    assert(markup.includes(`Distributore`));
    assert(markup.includes(`<span>${item.cost} ◈</span>`),`Wrong map dispenser price for ${item.id}`);
    if(!item.free)continue;
    const recruits=G.recruitmentCandidates(state,db);
    assert.strictEqual(recruits.length,item.free);
    const profilesById=new Map((db.profiles||[]).map(p=>[p.profileId,p]));
    const captured={};
    const stored={version:1,cardIds:[]};
    const previousRegistry=ctx.SeasonRegistry;
    ctx.SeasonRegistry={database:id=>id===item.id?db:null,loadDatabase:async()=>db,activeId:()=>item.id,setActive:()=>{}};
    const album=ctx.RoadToGloryAlbumController.create({
      id:String,localStorage:{getItem:()=>JSON.stringify(stored),setItem:()=>{throw Error("Collection browsing cannot write save")}},
      cardMeta:ref=>({cardId:String(ref)}),cardIdentity:I,gacha:G,
      acquiredCardIdSet:()=>new Set(),getCampaign:()=>state,activeSeasonId:()=>item.id,
      getSeasonDb:()=>db,getFreeAgentsDb:()=>null,config:{...C,SEASON_IDS:[item.id]},
      ensureData:async()=>{},playerResolver:{resolveAtLevel20:cardId=>{
        const p=profilesById.get(I.parse(cardId).playerId);
        return p?{...p,cardId}:null;
      }},
      runView:{albumTeamsMarkup:({teams})=>{captured.teams=teams;return "";},albumRosterMarkup:data=>{captured.roster=data;return "";},albumCollectionMarkup:({collections})=>{captured.collections=collections;return "";}},
      renderHtml:()=>{},app:{querySelector:s=>s===".rtg-album-collections-screen"?{}:null,querySelectorAll:()=>[]},
      mountDevQuickTools:()=>{},renderHome:()=>{}
    });
    await album.renderAlbumTeams(item.id);
    const group=captured.teams.find(t=>t.teamId==="rtg_recruitment");
    assert(group&&group.isRecruitmentPool&&group.teamName==="Svincolati");
    assert.strictEqual(group.total,item.free);
    assert.strictEqual(new Set(group.cardIds).size,item.free);
    const logoViewSource=fs.readFileSync("js/road-to-glory/rtg-album-view.js","utf8");
    assert(logoViewSource.includes("team?.isRecruitmentPool"));
    await album.renderAlbumRoster("rtg_recruitment",item.id);
    assert.strictEqual(captured.roster.allEntries.length,item.free);
    await album.renderAlbum();
    assert.strictEqual(captured.collections[0].total,item.total);
    assert.strictEqual(captured.collections[0].unlocked,0);
    if(item.id==="orion"){
      const zhao=captured.teams.find(t=>t.teamId==="zhao_eclipse");
      assert.strictEqual(zhao?.total,20,"Zhao existing mirrored roster must stay intact");
    }
    ctx.SeasonRegistry=previousRegistry;
  }
  const db=JSON.parse(fs.readFileSync("data/IE1_S3_season_compact.json","utf8"));
  const state={activeSeasonId:"ie1_s3",tokens:100,campaignSeed:"lorne-check",gacha:{pullCount:0,recruitmentPullCount:0},gachaAcquiredCards:[],defeatedTeamIds:[]};
  const candidates=G.recruitmentCandidates(state,db);
  const lorne=candidates.find(p=>p.profileId==="153@farm");
  assert(lorne&&lorne.category==="Debole","Original IE3 Lorne profile rarity must be preserved");
  const owned=candidates.filter(p=>p.profileId!==lorne.profileId).map(p=>p.cardId);
  const preview=G.previewPool(state,db,owned,"recruitment");
  assert.strictEqual(preview.candidates.length,1);
  assert.strictEqual(preview.rarities.length,1);
  assert.strictEqual(preview.rarities[0].rarity,"Normale");
  const pull=G.pull(state,{seasonDb:db,accessibleCardIds:owned,mode:"recruitment"});
  assert.strictEqual(pull.result.cardId,lorne.cardId);
  assert.strictEqual(pull.result.rarity,"Debole");
  assert.strictEqual(pull.state.tokens,10);
  assert.strictEqual(state.tokens,100,"Purchases must not mutate input");
  // Separate player profiles must not merge or be reclassified in the main boss pool.
  assert.strictEqual(G.unlockedCandidates(state,db).length,0);
  const finalState={activeSeasonId:"ie1_s3",seasonComplete:false,campaignSeed:"final",tokens:0,firstClearMatchIds:[],
    defeatedTeamIds:C.SEASON3.mainTeams.slice(0,-1),currentNodeId:C.buildSeasonNodes("ie1_s3").at(-1).id};
  let won=P.recordMainVictory(finalState,{teamId:C.SEASON3.mainTeams.at(-1),matchId:"first-final"});
  assert.strictEqual(won.tokens,650+2000);
  won=P.recordMainVictory(won,{teamId:C.SEASON3.mainTeams.at(-1),matchId:"replayed-final"});
  assert.strictEqual(won.tokens,650+2000+650,"Completion bonus must not repeat");
  const MV=ctx.RoadToGloryMatchView.create({escapeHtml:String});
  const winMatch={result:{winner:"user"},userSquad:{name:"Raimon"},opponentSquad:{name:"Boss"},score:{user:2,opponent:1}};
  const victory=MV.resultMarkup(winMatch,{matchReward:650,completionBonus:2000,total:2650});
  assert(victory.includes("VITTORIA · +650 GETTONI RTG"));
  assert(victory.includes("BONUS FINE SEASON · +2.000 GETTONI RTG"));
  assert(victory.includes("TOTALE +2.650 GETTONI RTG"));
  const loss=MV.resultMarkup({...winMatch,result:{winner:"opponent"}},{matchReward:650,completionBonus:2000,total:2650});
  assert(!loss.includes("BONUS FINE SEASON")&&!loss.includes("TOTALE +2.650"));
  const replay=MV.resultMarkup(winMatch,{matchReward:650,completionBonus:0,total:650});
  assert(!replay.includes("BONUS FINE SEASON"));
  const controller=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
  assert(controller.includes("terminalRewardSummary(current,next,match)"));
  assert(controller.includes("showMatchResult(snapshot,reward)"));
  const index=fs.readFileSync("index.html","utf8");
  for(const file of ["rtg-album-view","rtg-album-controller"])
    assert(index.includes(`${file}.js?v=20261021-canonical-ui-2`),`${file} mobile cache key must track coaches/album UI`);
  assert(index.includes("rtg-route-view.js?v=20261023-campaign-replay-v1"),"Coach link removal must invalidate the route view on mobile");
  assert(index.includes("rtg-gacha.js?v=20261012-four-audit-fixes-1"));
  assert(index.includes("rtg-match-view.js?v=20261023-prematch-five-v1"),"PT match view cache key must update");
  assert(index.includes("rtg-controller.js?v=20261023-campaign-replay-v1"),"RTG controller cache key must track coach assignment update");
  console.log("rtg-four-audit-fixes-test: five real map prices, IE3/Orion recruitment albums, Debole collection, terminal rewards PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
