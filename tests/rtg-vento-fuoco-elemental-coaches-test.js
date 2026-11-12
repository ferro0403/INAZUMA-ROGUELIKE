"use strict";
// Event-only elemental staff: 3 starters max, +1 rarity, +100 PT, counted
// OVR unchanged for qualification. No permanent card/write side effects.
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {loadEventsWithDev}=require("./helpers/events");
const read=path=>fs.readFileSync(path,"utf8");
(async()=>{
  const context=vm.createContext({console:{warn(){},error(){}},
    RtgFourMovesRuntime:{ptBreakdown:()=>({base:205,bonus:15,total:220})}});
  context.globalThis=context;
  for(const file of ["js/road-to-glory/rtg-config.js","js/road-to-glory/rtg-coaches.js"])
    vm.runInContext(read(file),context,{filename:file});
  await loadEventsWithDev(context,"vento_fuoco_dev");
  for(const file of ["js/road-to-glory/rtg-coach-power-types.js",
                     "js/road-to-glory/rtg-coach-powers-runtime.js"])
    vm.runInContext(read(file),context,{filename:file});
  const manifest=context.GameEvents.get("vento_fuoco_dev");
  const rules=context.RoadToGloryCoachPowerRuntime,types=context.RoadToGloryCoachPowerTypes;
  const coaches=context.RoadToGloryCoaches;
  vm.runInContext(read("js/road-to-glory/rtg-coaches-view.js"),context,
    {filename:"js/road-to-glory/rtg-coaches-view.js"});
  const coachesView=context.RoadToGloryCoachesView;
  const visuals=JSON.parse(read("data/PLAYER_VISUALS.json")).players;
  assert.equal(context.GameEvents.validate(manifest).length,0);
  assert.equal(manifest.coaches.length,2);
  const eventPrefix="vento_fuoco_dev::";
  const source=(pid,teamId,category="Leggenda")=>({
    cardId:eventPrefix+pid,playerId:pid,teamId,position:"FW",category,finalRarity:category,
    overall:95,finalOverall:95,stats:{stamina:80,control:80,grit:80,physical:80}
  });
  const fire=[source("4539","fire-team"),source("1105","fire-team"),source("9900002","fire-team")];
  const ice=[source("4538","blizzard-team"),source("1122","blizzard-team"),source("9900001","blizzard-team")];
  const others=Array.from({length:8},(_,i)=>({
    cardId:"ie1::normal"+i,playerId:"normal"+i,teamId:"raimon",overall:85,category:"Forte"
  }));
  const match=(chosen)=>({
    seasonId:"vento_fuoco_dev",ptModeVersion:1,ptCurrentByPlayerId:Object.fromEntries(
      [...chosen,...others].map(p=>["user:"+p.cardId,180])),
    ptMaxByPlayerId:Object.fromEntries([...chosen,...others].map(p=>["user:"+p.cardId,180])),
    userSquad:{lineup:[...chosen,...others],bench:[]}
  });
  const configuration=(coach,chosen)=>({coachId:coach.id,coachPowerSelection:{
    coachId:coach.id,cardIds:chosen.map(p=>p.cardId),moveIndices:[]}});
  const owned=coach=>({coachOwnedIds:[coach.id]});
  const upgrade=(p,rarity,key)=>({
    ...p,cardId:key,category:rarity,finalRarity:rarity,overall:99,finalOverall:99,
    stats:{...p.stats,attack:100},potential:99
  });
  const plain=x=>JSON.parse(JSON.stringify(x));
  for(const [coach,expectedTeam,group,wrong] of [
    [manifest.coaches[0],"fire-team",fire,ice],
    [manifest.coaches[1],"blizzard-team",ice,fire]
  ]){
    assert.equal(coach.teamId,expectedTeam);
    // Zukan 4687 is Grant Grimoire, but legacy visuals index him as 4685
    // (the local visuals ID 4687 belongs to Bolero Salimov).
    const person=expectedTeam==="fire-team"
      ?{id:"vento-fuoco-coach-fire",zukan:"4602",name:"Alessio Ganonti",visual:"4602"}
      :{id:"vento-fuoco-coach-blizzard",zukan:"4687",name:"Grant Grimoire",visual:"4685"};
    const art=visuals[person.visual];
    assert.equal(coach.id,person.id,"persistent IDs are stable");
    assert.equal(coach.zukanId,person.zukan);
    assert.equal(coach.name,person.name);
    assert.equal(coach.imageUrl,art.portraitUrl);
    assert.equal(coach.frontFullbodyUrl,art.frontFullbodyUrl);
    assert.notEqual(coach.imageUrl,manifest.teams.find(t=>t.teamId===expectedTeam).logo);
    assert.equal(coach.power.type,"elementalTrioAwakening");
    assert.deepEqual(plain(coach.power.params),{picks:3,amount:100,teamId:expectedTeam});
    const power=types.powerFor(coach.id);
    assert.equal(power?.eventCardPrefix,eventPrefix);
    assert.equal(types.problems(coach.power).length,0);
    const identity=coaches.lookup(coach.id);
    assert.equal(identity?.eventCoach,true);
    assert.equal(identity?.team,manifest.teams.find(t=>t.teamId===expectedTeam).name);
    assert.equal(identity?.teamId,expectedTeam);
    assert.equal(identity?.zukanId,person.zukan);
    assert.equal(identity?.teamLogoUrl,manifest.teams.find(t=>t.teamId===expectedTeam).logo);
    const prize=coachesView.result(identity),details=coachesView.detail(
      {coachOwnedIds:[coach.id]},coach.id,{equippedId:coach.id});
    assert(prize.includes("rtg-element-"+expectedTeam));
    assert(prize.includes(art.portraitUrl),"prize shows correct portrait");
    assert(details.includes(art.frontFullbodyUrl),"detail shows fullbody");
    assert(details.includes(coach.power.name),"detail includes power name");
    assert(coachesView.card(identity,"owned").includes(art.portraitUrl));
    assert(!coaches.CATALOG.some(c=>c.id===coach.id));
    const squad=configuration(coach,group);
    const before=match(group),frozen=plain(before);
    assert(rules.validConfig(squad,before.userSquad.lineup,"vento_fuoco_dev",[]),
      "3 players of the correct event team must be eligible");
    const output=rules.applyToMatch(before,squad,owned(coach),{upgradeRarity:upgrade});
    assert.notEqual(output,before);
    assert.deepEqual(plain(before),frozen,"source match must not mutate");
    assert.equal(output.coachPowerEffect.coachId,coach.id);
    assert.equal(output.coachPowerEffect.targets.length,3);
    for(const player of group){
      const id=player.cardId;
      const applied=output.userSquad.lineup.find(p=>p.cardId===id);
      assert.equal(applied.category,"Aurico");
      assert.equal(applied.overall,99,"real match OVR must rise from 95 to 99");
      const effect=output.coachPowerEffect.targets.find(t=>t.cardId===id);
      assert.equal(effect.previousOverall,95);
      assert.equal(effect.requirementOverall,95,"95 -> 99 still counts 95 for OVR limits");
      assert.equal(effect.bonusPt,100);
      assert.equal(output.ptCurrentByPlayerId["user:"+id],320);
      assert.equal(output.ptMaxByPlayerId["user:"+id],320);
    }
    assert.equal(output.userSquad.lineup[3].overall,85);
    assert.equal(output.ptCurrentByPlayerId["user:"+others[0].cardId],180);
    assert.equal(rules.applyToMatch(output,squad,owned(coach),{upgradeRarity:upgrade}),output,
      "double application must not create a second bonus");
    assert.equal(rules.applyToMatch(before,squad,{coachOwnedIds:[]},{upgradeRarity:upgrade}),before,
      "unowned coach must not apply");
    assert.equal(rules.applyToMatch({...before,ptModeVersion:0},squad,owned(coach),{upgradeRarity:upgrade}).coachPowerEffect,undefined,
      "legacy match without PT support is left untouched");
    for(const invalid of [
      configuration(coach,group.slice(0,2)),
      configuration(coach,[...group,wrong[0]]),
      configuration(coach,[group[0],group[1],wrong[0]]),
      configuration(coach,[group[0],group[0],group[1]]),
      configuration(coach,[group[0],group[1],{...group[2],cardId:"ie1::other",teamId:expectedTeam}]),
      configuration(coach,[group[0],group[1],{...group[2],category:"Aurico",finalRarity:"Aurico"}])
    ]){
      const selected=invalid.coachPowerSelection.cardIds;
      const lineup=[...group,...wrong,...others].map(p=>{
        const override=[group[0],group[1]].find(x=>x.cardId===p.cardId);
        return selected.includes(p.cardId)?p:override||p;
      });
      const can=rules.validConfig(invalid,lineup,"vento_fuoco_dev",[]);
      if(invalid.coachPowerSelection.cardIds.includes("ie1::other"))assert.equal(can,null);
      else if(invalid.coachPowerSelection.cardIds.length!==3||selected.some(id=>!group.some(p=>p.cardId===id)))assert.equal(can,null);
    }
    assert.equal(rules.validConfig(configuration(coach,[group[0],group[1],wrong[0]]),
      [...group,...wrong,...others],"vento_fuoco_dev",[]),null,"mixed elements invalid");
    assert.equal(rules.validConfig(configuration(coach,[group[0],group[1],{...group[2],category:"Aurico"}]),
      [group[0],group[1],{...group[2],category:"Aurico",finalRarity:"Aurico"},...others],
      "vento_fuoco_dev",[]),null,"already max rarity invalid");
    assert.equal(rules.validConfig(squad,[...group.slice(0,2),...others],"vento_fuoco_dev",[group[2]]),null,
      "bench player does not count as one of the three");
    const failed=rules.applyToMatch(before,squad,owned(coach),{
      upgradeRarity:(p,rarity,key)=>key===group[2].cardId?null:upgrade(p,rarity,key)
    });
    assert.equal(failed,before,"failed third upgrade is ALL-OR-NOTHING");
    assert.deepEqual(plain(before),frozen,"no partial mutation after failure");
  }
  const fireCoach=manifest.coaches[0],blizzardCoach=manifest.coaches[1];
  const turnedToWind={...fire[2],teamId:"blizzard-team"};
  assert.equal(rules.validConfig(configuration(fireCoach,fire),
    [fire[0],fire[1],turnedToWind,...others],"vento_fuoco_dev",[]),null,
    "changing Shaiden to Wind invalidates Fire coach");
  assert(rules.validConfig(configuration(blizzardCoach,[ice[0],ice[1],turnedToWind]),
    [ice[0],ice[1],turnedToWind,...others],"vento_fuoco_dev",[]),
    "the same Shaiden card ID qualifies as Blizzard when active variant changes");
  assert.equal(types.powerFor("halloween-coach-54").type,"requirementsOvrDiscount",
    "Halloween coach keeps its original power");
  const vendingSource=read("js/road-to-glory/rtg-halloween-event.js");
  assert.match(vendingSource,/filter\(coach=>coach\.teamId===teamId\)/,"vending is team-specific");
  assert.match(vendingSource,/account\.coachOwnedIds\.push\(selected\)/,"coach unlock uses atomic debit");
  const sourceUi=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(sourceUi,/choice\.cardIds\.length<cap/,"picker must allow 3, never 4");
  assert.match(sourceUi,/type==="elementalTrioAwakening"/);
  assert.match(read("js/road-to-glory/rtg-halloween-event.js"),/\["replace","adapt","formation","fusionRole"\]/,
    "changing the Miximax variant revalidates the saved coach selection");
  console.log("elemental-coaches PASS: two team-only coaches, 3 capped upgrades, +100 PT each, 95->99 counts 95, atomic rollback, Miximax switch, Halloween isolation");
})().catch(e=>{console.error(e);process.exitCode=1});
