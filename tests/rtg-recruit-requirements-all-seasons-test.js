"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const ctx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};
ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of [
  "js/road-to-glory/rtg-config.js",
  "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-squad-runtime.js",
  "js/road-to-glory/rtg-squad-controller.js"
])vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
const C=ctx.RoadToGloryConfig,R=ctx.RoadToGlorySquadRuntime,Card=ctx.RoadToGloryCardIdentity;
const freeIds=Array.from({length:14},(_,i)=>"fa"+i);
const clone=x=>JSON.parse(JSON.stringify(x));
const resolverFor=(team,allTeams=[team])=>({
  resolveAtLevel20:()=>({overall:70,normalizedRole:"MF",teamId:team,teamIds:allTeams}),
  resolveVersion:()=>({player:{teamId:team,teamIds:allTeams}}),
  resolveMove:()=>null
});
const mkState=(sid,roster,acquired,defeated)=>({
  activeSeasonId:sid,defeatedTeamIds:defeated,gachaAcquiredCards:acquired.map(cardId=>({cardId})),
  squads:{[sid]:{formationId:"4-3-3",lineup:roster.slice(0,11),bench:roster.slice(11,15),activeRoleVariantByCardId:{}}}
});
// Every campaign must exclude foreign cards and Halloween in both counts.
for(const sid of C.SEASON_IDS){
  const cfg=C.season(sid),target=cfg.mainTeams.find(team=>
    cfg.constraints[team].minRecruit>=3&&cfg.constraints[team].recentCount>0);
  assert(target,"missing recruitment requirement "+sid);
  const index=cfg.mainTeams.indexOf(target),window=cfg.constraints[target].recentWindow;
  const team=cfg.mainTeams.slice(Math.max(0,index-window),index).at(-1);
  const foreign=C.SEASON_IDS.find(other=>other!==sid);
  const roster=[sid+"::own",
    ...Array.from({length:5},(_,i)=>foreign+"::other"+i),
    ...Array.from({length:5},(_,i)=>"halloween2026::event"+i),
    ...Array.from({length:4},(_,i)=>"free_agents::fa"+i)];
  const state=mkState(sid,roster,roster.slice(0,11),cfg.mainTeams.slice(0,index));
  const checked=R.mainEligibility({
    teamId:target,state,seasonDb:{players:[],profiles:[]},
    freeAgentIds:freeIds,playerResolver:resolverFor(team)
  });
  assert.strictEqual(checked.recruitCount,1,sid+" acquired Season count");
  assert.strictEqual(checked.recentRecruitCount,1,sid+" recent Season count");
  assert.strictEqual(checked.requirementRosterSize,15,sid+" roster size");
}
// Old raw player IDs from legacy S1 saves remain valid S1 recruits.
{
  const roster=Array.from({length:15},(_,i)=>"legacy"+i);
  const state=mkState("ie1",roster,[],["occult"]);
  state.gachaAcquiredPlayerIds=["legacy0","legacy1"];
  const checked=R.mainEligibility({
    teamId:"wild",state,seasonDb:{players:[],profiles:[]},freeAgentIds:roster,
    playerResolver:resolverFor("occult")
  });
  assert.strictEqual(checked.recruitCount,2,"legacy S1 raw IDs");
}
// Real Season 2 profile data: an Epsilon card is not an Epsilon Plus card.
const db=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
const base=db.players.find(p=>String(p.playerId)==="1070");
assert(base?.teamIds?.includes("epsilon_plus"),"required multi-team fixture");
const entries=[
  ["1070@epsilon",0],
  ["1070@epsilon_plus",1]
];
async function verifyProfiles(){
  for(const [profileId,expectedRecent] of entries){
    const cardId="ie1_s2::"+profileId;
    const profile=db.profiles.find(p=>p.profileId===profileId);
    assert(profile,"missing Season 2 profile: "+profileId);
    const roster=[cardId,...freeIds.map(id=>"free_agents::"+id)];
    const cfg=C.SEASON2,enemy="diamond_dust",index=cfg.mainTeams.indexOf(enemy);
    const state=mkState("ie1_s2",roster,[cardId],cfg.mainTeams.slice(0,index));
    const resolver=resolverFor(profile.teamId,base.teamIds);
    const checked=R.mainEligibility({teamId:enemy,state,seasonDb:db,freeAgentIds:freeIds,playerResolver:resolver});
    assert.strictEqual(checked.recruitCount,1,profileId+" total");
    assert.strictEqual(checked.recentRecruitCount,expectedRecent,profileId+" recent");
    // The automatic formation builder must apply the same source and origin.
    let pool=null;
    ctx.RoadToGlorySquadAutoAdapt={plan:({pool:entries})=>{pool=entries;return null;}};
    const squadController=ctx.RoadToGlorySquadController.create({
      id:String,clone,campaign:state,squadDraft:state.squads.ie1_s2,
      cardIdentity:Card,activeSeasonId:()=> "ie1_s2",
      activeConfig:()=>cfg,nodeById:()=>({type:"main",teamId:enemy}),
      seasonDb:db,freeAgentIds:freeIds,freeAgentsDb:{},
      playerResolver:resolver,playerResolverForState:()=>resolver,
      accessibleCards:()=>roster,acquiredCardIdSet:()=>new Set([cardId]),
      resolved:()=>({overall:70,normalizedRole:"MF",teamId:profile.teamId,teamIds:base.teamIds}),
      rawPlayer:()=>profile,rawRole:()=> "MF",
      squadRuntime:R,app:{querySelector:()=>null},toast:()=>{}
    });
    await squadController.adaptSquadToCurrentRequirements();
    const selected=pool?.find(p=>p.playerId===cardId);
    assert(selected,"automatic requirements pool missing "+profileId);
    assert.strictEqual(selected.recruit,true,profileId+" auto-adapt recruit");
    assert.strictEqual(selected.recent,Boolean(expectedRecent),profileId+" auto-adapt recent");
  }
}
verifyProfiles().then(()=>console.log("rtg-recruit-requirements-all-seasons-test: PASS"))
  .catch(error=>{console.error(error);process.exitCode=1;});
