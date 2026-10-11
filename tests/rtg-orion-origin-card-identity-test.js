"use strict";
// Orion Zhao Eclipse reuses all 20 origin cards (including Jimmy Wongfu's two roles).
// Assertions are read-only: no changes to game/account saves or fixtures.
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const orion=JSON.parse(fs.readFileSync("data/ORION_season_compact.json","utf8"));
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const filename of [
  "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-gacha.js",
  "js/road-to-glory/rtg-album-controller.js"
])vm.runInContext(fs.readFileSync(filename,"utf8"),ctx,{filename});
const I=ctx.RoadToGloryCardIdentity,G=ctx.RoadToGloryGacha,config=ctx.RoadToGloryConfig;
const zhao=orion.profiles.filter(p=>p.teamId==="zhao_eclipse");
assert.strictEqual(zhao.length,20,"Zhao roster size unexpectedly changed: audit required");
const originalByPlayer=new Map(orion.profiles.filter(p=>p.teamId!=="zhao_eclipse").map(p=>[String(p.playerId),p]));
for(const profile of zhao){
  const origin=originalByPlayer.get(String(profile.playerId));
  assert(origin,`Missing source team for ${profile.name}`);
  const zhaoId=I.cardIdForProfile(profile.profileId,"orion");
  const originId=I.cardIdForProfile(origin.profileId,"orion");
  assert.strictEqual(G.canonicalCollectibleCardId(zhaoId,orion),originId,`Not equivalent: ${profile.name}`);
}
const jimmy=orion.profiles.filter(p=>p.playerId==="4725");
assert.strictEqual(jimmy.length,2);
assert.deepStrictEqual(jimmy.map(p=>p.roleVariants.map(v=>v.position).sort().join(",")),["DF,MF","DF,MF"]);
assert.strictEqual(jimmy[0].roleSwitchEnabled,true);
assert.strictEqual(jimmy[1].roleSwitchEnabled,true);

const initial={activeSeasonId:"orion",defeatedTeamIds:["zhao_eclipse"],gachaAcquiredCards:[],tokens:1500,gacha:{pullCount:0},campaignSeed:"orion-alias-test"};
assert.strictEqual(G.unlockedCandidates(initial,orion).length,0,"Defeating Zhao must not unlock another set of 20 cards");
assert.strictEqual(G.previewPool(initial,orion,[]).candidates.length,0);
assert.throws(()=>G.pull(initial,{seasonDb:orion}),/Nessun nuovo giocatore/);
assert.strictEqual(initial.tokens,1500,"Rejected pull cannot modify the input run");

const allOriginTeams=[...new Set(zhao.map(p=>originalByPlayer.get(String(p.playerId)).teamId))];
const unlocked={...initial,defeatedTeamIds:allOriginTeams};
const originPool=G.unlockedCandidates(unlocked,orion);
for(const p of zhao){
  const origin=originalByPlayer.get(String(p.playerId));
  const id=I.cardIdForProfile(origin.profileId,"orion");
  assert(originPool.some(card=>card.cardId===id),`Origin pool missing: ${p.name}`);
}
assert(!originPool.some(card=>String(card.cardId).endsWith("@zhao_eclipse")),"Zhao profiles should never be collectible");
const legacyZhaoId=I.cardIdForProfile(jimmy.find(p=>p.teamId==="zhao_eclipse").profileId,"orion");
const originalJimmy=I.cardIdForProfile(jimmy.find(p=>p.teamId!=="zhao_eclipse").profileId,"orion");
assert(!G.previewPool(unlocked,orion,[legacyZhaoId]).candidates.some(p=>p.cardId===originalJimmy),
  "Legacy Zhao owners must not be offered the same card again");
assert(!G.previewPool({...unlocked,gachaAcquiredCards:[I.record(legacyZhaoId)]},orion,[]).candidates.some(p=>p.cardId===originalJimmy));

let writes=0,captured=null;
const albumSaved={version:1,cardIds:zhao.map(p=>I.cardIdForProfile(p.profileId,"orion"))};
ctx.SeasonRegistry={
  database:id=>id==="orion"?orion:null,loadDatabase:async id=>orion,
  activeId:()=>"orion",setActive:()=>{}
};
const album=ctx.RoadToGloryAlbumController.create({
 id:String,localStorage:{getItem:()=>JSON.stringify(albumSaved),setItem:()=>{writes++;}},
 cardMeta:()=>({cardId:""}),cardIdentity:I,gacha:G,
 acquiredCardIdSet:()=>new Set(),getCampaign:()=>unlocked,activeSeasonId:()=>"orion",
 getSeasonDb:()=>orion,getFreeAgentsDb:()=>null,config,ensureData:async()=>{},
 playerResolver:{resolveAtLevel20:()=>null},
 runView:{albumTeamsMarkup:({teams})=>{captured=teams;return ""}},
 renderHtml:()=>{},app:null,mountDevQuickTools:()=>{},renderHome:()=>{}
});
(async()=>{
 await album.renderAlbumTeams("orion");
 assert(Array.isArray(captured));
 assert(!captured.some(t=>t.teamId==="zhao_eclipse"),"Zhao cannot contribute duplicate cards to Album");
 for(const p of zhao){
   const origin=originalByPlayer.get(String(p.playerId));
   const team=captured.find(t=>t.teamId===origin.teamId);
   const cardId=I.cardIdForProfile(origin.profileId,"orion");
   assert(team?.cardIds.includes(cardId),`Album missing origin card for ${p.name}`);
   assert(team.unlocked>=1,`Legacy owned Zhao card not recognized in ${origin.teamId}`);
 }
 const unique=new Set(captured.flatMap(t=>t.cardIds));
 assert.strictEqual(unique.size,captured.reduce((sum,t)=>sum+t.total,0),"Orion album must count cards only once");
 assert.strictEqual(writes,0,"Album equivalence must be read-only");
 const index=fs.readFileSync("index.html","utf8");
 for(const js of ["rtg-gacha","rtg-album-controller","rtg-controller"]){
   assert(index.includes(`${js}.js?v=20261011-orion-origin-cards-1`),`Stale mobile script: ${js}`);
 }
 console.log("RTG Orion: all 20 Zhao cards unlock at their source teams; old ownership/Album preserved: PASS");
})().catch(error=>{console.error(error);process.exitCode=1});
