"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");

const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const teamById=new Map((db.teams||[]).map(team=>[String(team.teamId||team.id),team]));
for(const profile of db.profiles||[]){
  const team=teamById.get(String(profile.teamId||""));
  assert(team,`missing team ${profile.teamId} for profile ${profile.profileId}`);
  assert(String(team.logoUrl||"").trim(),`missing logo for team ${profile.teamId}`);
}

const profileByNameAndTeam=(name,teamId)=>(db.profiles||[]).find(profile=>String(profile.name)===name&&String(profile.teamId)===teamId);
const gazelleChaos=profileByNameAndTeam("Gazelle","chaos");
const dvalinEpsilon=profileByNameAndTeam("Dvalin","epsilon");
assert(gazelleChaos,"Gazelle Chaos profile missing");
assert(dvalinEpsilon,"Dvalin Epsilon profile missing");

const ctx={
  globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Error,Date,
  SeasonRegistry:{
    normalizeSeasonId:value=>String(value||""),
    database:seasonId=>String(seasonId)==="ie1_s2"?db:null,
    player:(playerId,seasonId)=>String(seasonId)==="ie1_s2"?(db.players||[]).find(player=>String(player.playerId)===String(playerId))||null:null,
    isSeasonSource:()=>false,
  },
  ProfiledSeasonRuntime:{
    resolveProfile:(seasonId,profileId)=>String(seasonId)==="ie1_s2"?(db.profiles||[]).find(profile=>String(profile.profileId)===String(profileId))||null:null,
    canonicalPlayerId:(seasonId,value)=>{
      const profile=String(seasonId)==="ie1_s2"?(db.profiles||[]).find(entry=>String(entry.profileId)===String(value)):null;
      return String(profile?.playerId||value||"");
    },
    resolveEffectivePlayerAtLevel:(entry,{database})=>{
      const canonical=(database.players||[]).find(player=>String(player.playerId)===String(entry.playerId))||{};
      const profile=(database.profiles||[]).find(item=>String(item.profileId)===String(entry.activeProfileId))||canonical;
      const variant=(profile.roleVariants||[]).find(item=>String(item.roleVariantId||item.variantId)===String(entry.activeRoleVariantId||profile.defaultRoleVariantId))||{};
      return {...canonical,...profile,...variant,profileId:profile.profileId,playerId:String(entry.playerId),overall:Number(variant.finalOverall??profile.finalOverall??canonical.finalOverall??0),level:20};
    },
  },
  DevelopmentAccountV3:{read:()=>({players:{}})},
};
ctx.globalThis=ctx;
vm.createContext(ctx);
for(const file of["js/road-to-glory/rtg-card-identity.js","js/road-to-glory/rtg-player-resolver.js"]){
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}

const C=ctx.RoadToGloryCardIdentity,R=ctx.RoadToGloryPlayerResolver;
const gazelleCard=C.cardIdForProfile(gazelleChaos.profileId,"ie1_s2");
const gazelle=R.resolveAtLevel20(gazelleCard,"ie1_s2",null,null);
assert.strictEqual(gazelle.resolvedTeamId,"chaos");
assert.strictEqual(gazelle.teamName,"Chaos");
assert.strictEqual(gazelle.teamLogoUrl,teamById.get("chaos").logoUrl);

const dvalinCard=C.cardIdForProfile(dvalinEpsilon.profileId,"ie1_s2");
const dvalin=R.resolveAtLevel20(dvalinCard,"ie1_s2",null,null);
assert.strictEqual(dvalin.resolvedTeamId,"epsilon");
assert.strictEqual(dvalin.teamLogoUrl,teamById.get("epsilon").logoUrl);

vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-run-view.js","utf8"),ctx,{filename:"rtg-run-view.js"});
const view=ctx.RoadToGloryRunView.create({
  escapeHtml:value=>String(value??""),
  compactPlayerCardMarkup:(player,options)=>`<button ${options.dataAttr||""}>${player.name}</button>`,
  teamEmblemMarkup:teamId=>`<span data-fallback-team="${teamId}"></span>`,
});
const pullHtml=view.pullResultMarkup(
  {cardId:gazelleCard,playerId:gazelle.playerId,legacySeasonId:"ie1_s2",rarity:"Mondiale",balanceAfter:100},
  gazelle,
  db
);
assert(pullHtml.includes(teamById.get("chaos").logoUrl),"Gazelle pull must show Chaos emblem");
assert(!pullHtml.includes(teamById.get("diamond_dust").logoUrl),"Gazelle Chaos pull must not reuse Diamond Dust emblem");

ctx.RoguelikeRules={isProfileAwareRosterEntry:()=>false,applyEquipment:stats=>stats};
ctx.DevelopmentRuntime={};
ctx.LevelProgression={formatLevel:entry=>`Lv ${entry?.level||0}`};
vm.runInContext(fs.readFileSync("js/run/run-roster-runtime.js","utf8"),ctx,{filename:"run-roster-runtime.js"});
const rosterRuntime=ctx.RunRosterRuntime.create({
  getRun:()=>({seasonId:"ie1",roster:[]}),
  getSeasonDb:()=>({seasonId:"ie1",teams:[]}),
  getFreeAgentsDb:()=>({players:[]}),
  getFreeAgentsById:()=>new Map(),
  getSeasonPlayersById:()=>new Map(),
  getSeasonTeamsById:()=>new Map(),
});
const dvalinIdentity=rosterRuntime.playerTeamIdentity(dvalin,dvalin.playerId);
assert.strictEqual(dvalinIdentity.name,"Epsilon");
assert.strictEqual(dvalinIdentity.logoUrl,teamById.get("epsilon").logoUrl,"RTG S2 detail must resolve Epsilon logo from S2 database");

const playerViewSource=fs.readFileSync("js/player/player-view.js","utf8");
assert.match(playerViewSource,/teamIdentity\.logoUrl|teamLogoMarkup\(teamIdentity\)/);

console.log("rtg-season2-team-logo-association-test: PASS");
