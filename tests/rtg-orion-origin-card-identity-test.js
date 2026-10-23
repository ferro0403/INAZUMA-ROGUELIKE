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

let writes=0,captured=null,rosterCapture=null,collectionsCapture=null,albumSavedState=null;
const albumSaved={version:1,cardIds:zhao.map(p=>I.cardIdForProfile(p.profileId,"orion"))};
albumSavedState=albumSaved;
ctx.SeasonRegistry={
  database:id=>id==="orion"?orion:null,loadDatabase:async id=>orion,
  activeId:()=>"orion",setActive:()=>{}
};
const album=ctx.RoadToGloryAlbumController.create({
 id:String,localStorage:{getItem:()=>JSON.stringify(albumSavedState),setItem:()=>{writes++;}},
 cardMeta:()=>({cardId:""}),cardIdentity:I,gacha:G,
 acquiredCardIdSet:()=>new Set(),getCampaign:()=>unlocked,activeSeasonId:()=>"orion",
 getSeasonDb:()=>orion,getFreeAgentsDb:()=>null,config:{...config,SEASON_IDS:["orion"]},ensureData:async()=>{},
 playerResolver:{resolveAtLevel20:(cardId,seasonId,role)=>{
   const profile=orion.profiles.find(p=>cardId===I.cardIdForProfile(p.profileId,"orion"));
   if(!profile)return null;
   const variant=profile.roleVariants.find(v=>v.variantId===role)||profile.roleVariants.find(v=>v.variantId===profile.defaultRoleVariantId);
   return {...profile,...variant,cardId,legacySeasonId:"orion"};
 }},
 runView:{
   albumTeamsMarkup:({teams})=>{captured=teams;return "";},
   albumRosterMarkup:payload=>{rosterCapture=payload;return "";},
   albumCollectionMarkup:({collections})=>{collectionsCapture=collections;return "";},
 },
 renderHtml:()=>{},
 app:{querySelector:selector=>selector===".rtg-album-collections-screen"?{}:null,querySelectorAll:()=>[]},
 mountDevQuickTools:()=>{},renderHome:()=>{}
});
(async()=>{
 await album.renderAlbumTeams("orion");
 assert(Array.isArray(captured));
 const zhaoTeam=captured.find(t=>t.teamId==="zhao_eclipse");
 assert(zhaoTeam,"Zhao must remain a visible Album team even though it has no exclusive cards");
 assert.strictEqual(zhaoTeam.total,20);
 assert.strictEqual(zhaoTeam.unlocked,20,"Owned legacy Zhao cards must appear unlocked in the Zhao roster");
 const zhaoCanonical=zhao.map(p=>I.cardIdForProfile(originalByPlayer.get(String(p.playerId)).profileId,"orion"));
 assert.deepStrictEqual([...zhaoTeam.cardIds].sort(),[...zhaoCanonical].sort(),
   "Zhao roster must reuse all 20 cards from their original teams");
 assert(!zhaoTeam.cardIds.some(cardId=>cardId.endsWith("@zhao_eclipse")),
   "No Zhao-only collectible identities may be created");
 for(const p of zhao){
   const origin=originalByPlayer.get(String(p.playerId));
   const team=captured.find(t=>t.teamId===origin.teamId);
   const cardId=I.cardIdForProfile(origin.profileId,"orion");
   assert(team?.cardIds.includes(cardId),`Album missing origin card for ${p.name}`);
   assert(team.unlocked>=1,`Legacy owned Zhao card not recognized in ${origin.teamId}`);
 }
 const unique=new Set(captured.flatMap(t=>t.cardIds));
 assert.strictEqual(captured.reduce((sum,t)=>sum+t.total,0),unique.size+20,
   "The Zhao Album roster must mirror exactly 20 existing cards");
 await album.renderAlbumRoster("zhao_eclipse","orion");
 assert.strictEqual(rosterCapture?.allEntries.length,20,"Zhao's 20 players must be shown in the roster");
 assert.strictEqual(rosterCapture?.entries.length,20,"Legacy-owned Zhao cards must be unlocked");
 assert.strictEqual(rosterCapture?.allEntries.find(p=>p.playerId==="4725")?.position,"DF",
   "Jimmy must keep Zhao's default defender role in this Album view");
 assert(!rosterCapture?.allEntries.some(p=>String(p.cardId).endsWith("@zhao_eclipse")),
   "Every Zhao card in the roster must open its original playable card");
 // The Season collection counts only unique cards; Zhao is a mirrored roster.
 await album.renderAlbum();
 const summary=collectionsCapture?.find(entry=>entry.seasonId==="orion");
 assert.strictEqual(summary?.total,unique.size,"Mirrored Zhao cards must not inflate the Season total");
 assert.strictEqual(summary?.unlocked,20,"Legacy-owned Zhao cards count once in the Season summary");
 assert.strictEqual(writes,0,"Album equivalence must be read-only");
 const index=fs.readFileSync("index.html","utf8");
 assert(index.includes("rtg-gacha.js?v=20261012-four-audit-fixes-1"),"Stale mobile script: rtg-gacha");
 assert(index.includes("rtg-controller.js?v=20261023-coach-audit-v2"),"Stale mobile script: rtg-controller");
 assert(index.includes("rtg-album-controller.js?v=20261021-canonical-ui-2"),
   "Orion Album changes must invalidate the cached script on mobile");
 console.log("RTG Orion: Zhao remains visible (20/20 shared origin cards); collection unique; old ownership/Album preserved: PASS");
})().catch(error=>{console.error(error);process.exitCode=1});
