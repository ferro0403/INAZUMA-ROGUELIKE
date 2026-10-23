const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const moves=[
  {name:"Colpo A",type:"shot",power:40,ptCost:40},
  {name:"Colpo B",type:"shot",power:75,ptCost:75},
  {name:"Colpo C",type:"shot",power:52,ptCost:52},
  {name:"Colpo D",type:"shot",power:101,ptCost:101},
];
const ctx={RoadToGloryCoaches:{owned:s=>new Set(s.coachOwnedIds||[])},
  RtgFourMovesRuntime:{movesFor:()=>moves,isReady:()=>true,error:()=>null,ptBreakdown:()=>({total:200})}};
vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-runtime.js"),ctx);
vm.runInNewContext(read("js/road-to-glory/rtg-match-pt-runtime.js"),ctx);
const rules=ctx.RoadToGloryCoachPowerRuntime,pt=ctx.RoadToGloryMatchPtRuntime;
const player=(cardId)=>({cardId,playerId:cardId,legacySeasonId:"ie1",baseStats:{}});
const match=()=>({seasonId:"ie1",ptModeVersion:1,ptCurrentByPlayerId:{"user:a":200,"user:b":200,"user:c":200},
  ptMaxByPlayerId:{"user:a":200,"user:b":200,"user:c":200},
  userSquad:{lineup:[player("a"),player("b"),player("c")],bench:[]}});
test("Hillman adds 50 initial and max PT to exactly two starters, once, without mutating input",()=>{
  const original=match(),squad={coachId:"208",coachPowerSelection:{coachId:"208",cardIds:["a","b"],moveIndices:[]}};
  const result=rules.applyToMatch(original,squad,{coachOwnedIds:["208"]});
  assert.equal(result.ptCurrentByPlayerId["user:a"],250);
  assert.equal(result.ptMaxByPlayerId["user:b"],250);
  assert.equal(result.ptMaxByPlayerId["user:c"],200);
  assert.equal(original.ptCurrentByPlayerId["user:a"],200);
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["208"]}),result,"no second bonus");
});
test("Aquilina halves only the selected two moves of the selected starter",()=>{
  const squad={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,3]}};
  const result=rules.applyToMatch(match(),squad,{coachOwnedIds:["1329"]});
  assert.equal(result.coachPowerEffect.coachId,"1329");
  assert.deepEqual(Array.from(pt.compatible(result,"user","a","shot").map(move=>move.ptCost)),[20,75,52,51]);
  assert.deepEqual(Array.from(pt.compatible(result,"user","b","shot").map(move=>move.ptCost)),[40,75,52,101]);
  assert.equal(result.ptCurrentByPlayerId["user:a"],200);
});
test("Unavailable coaches, invalid/stale selection, old match PT: no effect",()=>{
  const original=match();
  const s={coachId:"208",coachPowerSelection:{coachId:"208",cardIds:["a","missing"]}};
  assert.equal(rules.applyToMatch(original,s,{coachOwnedIds:["208"]}),original);
  s.coachPowerSelection.cardIds=["a","b"];
  assert.equal(rules.applyToMatch(original,s,{coachOwnedIds:[]}),original);
  assert.equal(rules.applyToMatch({...original,ptModeVersion:undefined},s,{coachOwnedIds:["208"]}).coachPowerEffect,undefined);
  const invalid={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,0]}};
  assert.equal(rules.applyToMatch(original,invalid,{coachOwnedIds:["1329"]}),original);
});
test("Squad UI and match wiring use canonical repository persistence",()=>{
  const source=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(source,/ctx\.saveSquad\(draft\)/);
  assert.doesNotMatch(source,/localStorage\.setItem|firebase|indexedDB/i);
  assert.match(read("js/road-to-glory/rtg-controller.js"),/RoadToGloryCoachPowerRuntime\?\.applyToMatch/);
  assert.match(read("js/road-to-glory/rtg-squad-view-base.js"),/data-rtg-coach-power-configure/);
  const index=read("index.html");
  assert.match(index,/rtg-coach-powers-runtime\.js/);
  assert.match(index,/rtg-coach-powers-squad-ui\.js/);
});


test("Travis counts 15 players but caps one chosen bench OVR at 60",()=>{
  const lineup=Array.from({length:11},(_,i)=>"t"+i);
  const bench=["r0","r1","r2","r3"];
  const squad={coachId:"1777",lineup,bench,coachPowerSelection:{coachId:"1777",cardIds:["r0"]}};
  const state={activeSeasonId:"ie1",coachOwnedIds:["1777"]};
  assert.equal(rules.capOverrideFor(squad,state),"r0");
  assert.equal(rules.eligibleRosterForCap(squad,state).length,15);
  assert.equal(squad.bench.length,4);
  assert.equal(rules.capOverrideFor(squad,{...state,coachOwnedIds:[]}),null);
  assert.equal(rules.capOverrideFor({...squad,coachPowerSelection:{coachId:"1777",cardIds:["t0"]}},state),null);
  const sandbox={RoadToGloryCoachPowerRuntime:rules};
  vm.runInNewContext(read("js/road-to-glory/rtg-squad-runtime.js"),sandbox);
  const resolver={resolveAtLevel20:key=>({overall:key==="r0"?99:70}),resolveMove:()=>null};
  const common={lineup:[...lineup,...bench],playerResolver:resolver};
  assert.equal(sandbox.RoadToGlorySquadRuntime.teamPower(common),71.9);
  assert.equal(sandbox.RoadToGlorySquadRuntime.teamPower({...common,coachCapCardId:"r0"}),69.3);
  // A value lower than 60 must never get worse.
  const weaker={resolveAtLevel20:key=>({overall:key==="r0"?40:70}),resolveMove:()=>null};
  assert.equal(sandbox.RoadToGlorySquadRuntime.teamPower({...common,playerResolver:weaker}),
    sandbox.RoadToGlorySquadRuntime.teamPower({...common,playerResolver:weaker,coachCapCardId:"r0"}));
  const source=read("js/road-to-glory/rtg-squad-runtime.js");
  assert.match(source,/capOverrideFor\?\.\(squad,state\)/);
  assert.match(source,/lineup: activeRoster/);
});
test("Arrows upgrades actual match player stats/rarity including PT while preserving cap values",()=>{
  const original=match();
  original.userSquad.bench=[{...player("reserve"),category:"Elite",overall:88,potential:88,
    stats:{stamina:60,grit:50,control:70,physical:55},attack:70}];
  original.ptCurrentByPlayerId["user:reserve"]=200;
  original.ptMaxByPlayerId["user:reserve"]=200;
  const squad={coachId:"1974",coachPowerSelection:{coachId:"1974",cardIds:["reserve"]}};
  let calls=0;
  const result=rules.applyToMatch(original,squad,{coachOwnedIds:["1974"]},{
    upgradeRarity:(p,rarity,key)=>{
      calls++;assert.equal(p.cardId,"reserve");assert.equal(rarity,"Mondiale");
      assert.equal(key,"reserve");
      return {...p,category:rarity,overall:90,potential:90,
        stats:{stamina:80,grit:70,control:80,physical:75},attack:95};
    },
  });
  assert.equal(calls,1);
  assert.equal(result.userSquad.bench[0].category,"Mondiale");
  assert.equal(result.userSquad.bench[0].overall,90);
  assert.equal(result.userSquad.bench[0].attack,95);
  assert.equal(result.coachPowerEffect.previousOverall,88);
  assert.equal(result.coachPowerEffect.previousRarity,"Elite");
  assert.equal(result.coachPowerEffect.targetRarity,"Mondiale");
  assert.equal(result.ptCurrentByPlayerId["user:reserve"],200);
  assert.equal(result.ptMaxByPlayerId["user:reserve"],200);
  assert.equal(original.userSquad.bench[0].overall,88);
  assert.equal(original.userSquad.bench[0].category,"Elite");
  assert.equal(original.ptCurrentByPlayerId["user:reserve"],200);
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["1974"]}),result);
});
test("Arrows rarity production resolver uses next threshold, original card and no account writes",()=>{
  const context={RoadToGloryCoachPowerRuntime:rules,
    InazumaProgression:{RARITY_THRESHOLDS:[
      {category:"Elite",min:85},{category:"Mondiale",min:90},{category:"Leggenda",min:95},{category:"Aurico",min:99}]}};
  vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-rarity.js"),context);
  const captured=[];
  const playerResolver={
    resolveVersion:()=>({player:{finalOverall:80}}),
    resolveBaseAtLevel20:(card,season,variant,_db,options)=>{
      captured.push({card,season,variant,boost:options.potentialBoost,apps:options.potentialBoostApplications.length});
      return {category:"Mondiale",overall:90,stats:{attack:94},attack:94,potential:90};
    },
  };
  const upgraded=context.RoadToGloryCoachRarityPower.upgrade({
    player:{category:"Elite",overall:88,potential:88},targetRarity:"Mondiale",
    cardId:"card-A",playerResolver,seasonId:"ie1",squad:{activeRoleVariantByCardId:{"card-A":"FW"}},
  });
  assert.equal(upgraded.category,"Mondiale");
  assert.equal(upgraded.attack,94);
  assert.equal(captured.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(captured[0])),{
    card:"card-A",season:"ie1",variant:"FW",boost:10,apps:1
  });
  assert.equal(context.RoadToGloryCoachRarityPower.upgrade({
    player:{category:"Aurico",overall:99,potential:99},targetRarity:"Aurico",
    cardId:"card-A",playerResolver,seasonId:"ie1"}),null);
});
test("Mister Yi changes only selected starting player's elemental affinity in match snapshot",()=>{
  const m=match();
  m.userSquad.lineup=[{...player("a"),element:"wind",overall:80,stats:{}},
    {...player("b"),element:"forest",overall:80,stats:{}}];
  const squad={coachId:"4401",coachPowerSelection:{
    coachId:"4401",cardIds:["a"],element:"fire"}};
  const result=rules.applyToMatch(m,squad,{coachOwnedIds:["4401"]});
  assert.equal(result.userSquad.lineup[0].element,"fire");
  assert.equal(result.userSquad.lineup[1].element,"forest");
  assert.equal(m.userSquad.lineup[0].element,"wind");
  assert.equal(result.coachPowerEffect.element,"fire");
  assert.equal(result.coachPowerEffect.cardIds[0],"a");
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["4401"]}),result);
  const bad={...squad,coachPowerSelection:{...squad.coachPowerSelection,element:"thunder"}};
  assert.equal(rules.applyToMatch(m,bad,{coachOwnedIds:["4401"]}),m);
  assert.equal(rules.nextRarity("Leggenda"),"Aurico");
  assert.equal(rules.nextRarity("Aurico"),null);
});
test("Five Squad power controls and season-safe element roundtrip are wired",()=>{
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(ui,/TITOLARI E RISERVE/);
  assert.match(ui,/RISERVE/);
  assert.match(ui,/NUOVO ELEMENTO/);
  assert.match(ui,/MONTAGNA/);
  assert.match(ui,/ctx\.saveSquad\(draft\)/);
  const view=read("js/road-to-glory/rtg-coaches-view.js");
  for(const key of ['"208"','"1329"','"1777"','"1974"','"4401"'])
    assert(view.includes(key));
  const stateSource=read("js/road-to-glory/rtg-state.js");
  assert.match(stateSource,/coachPowerSelection\.element/);
  const mainSource=read("js/road-to-glory/rtg-controller.js");
  assert.match(mainSource,/RoadToGloryCoachRarityPower\?\.upgrade/);
  const html=read("index.html");
  assert.match(html,/rtg-coach-powers-rarity\.js/);
  assert.match(html,/rtg-coach-powers-runtime\.js/);
});

test("Squad power preview shows all five targeted effects without mutating canonical cards",()=>{
  const sandbox={
    RoadToGloryCoachPowerRuntime:rules,
    RoadToGloryCoaches:{owned:s=>new Set(s.coachOwnedIds||[])},
    RtgFourMovesRuntime:{movesFor:()=>moves,ptBreakdown:()=>({base:180,bonus:20,total:200})},
    RoadToGloryCoachRarityPower:{upgrade:({player,targetRarity})=>
      ({...player,category:targetRarity,overall:90,stats:{attack:85,control:60},attack:85})},
  };
  vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-preview.js"),sandbox);
  const preview=sandbox.RoadToGloryCoachSquadPreview;
  const player={cardId:"a",playerId:"a",name:"Tester",overall:88,category:"Elite",element:"wind",
    stats:{attack:70,control:60}};
  const base={player,cardId:"a",state:{coachOwnedIds:["208","1329","1974","4401","1777"]},
    seasonId:"ie1",playerResolver:{},freeAgentsDb:null};
  const given=extra=>preview.projected({...base,...extra});
  const hillman=given({squad:{coachId:"208",lineup:["a","b"],bench:[],
    coachPowerSelection:{coachId:"208",cardIds:["a","b"]}}});
  assert.equal(hillman.pt.total,250);
  const aquilina=given({squad:{coachId:"1329",lineup:["a"],bench:[],
    coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,3]}}});
  assert.equal(aquilina.costs[0],20);
  assert.equal(aquilina.costs[3],51);
  const yi=given({squad:{coachId:"4401",lineup:["a"],bench:[],
    coachPowerSelection:{coachId:"4401",cardIds:["a"],element:"fire"}}});
  assert.equal(yi.player.element,"Fuoco");
  const arrows=given({squad:{coachId:"1974",lineup:["a"],bench:[],
    coachPowerSelection:{coachId:"1974",cardIds:["a"]}}});
  assert.equal(arrows.player.overall,90);
  assert.equal(arrows.stats.find(s=>s.key==="attack").after,85);
  assert.equal(player.overall,88);
  assert.equal(player.element,"wind");
  const travis=given({squad:{coachId:"1777",lineup:[],bench:["a"],
    coachPowerSelection:{coachId:"1777",cardIds:["a"]}}});
  assert.match(travis.note,/contributo al limite squadra 60/);
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(ui,/lineupPitchMarkup/);
  assert.match(ui,/data-rtg-coach-power-save/);
  assert.match(ui,/openPlayerDetails/);
  assert.match(ui,/coachMovePicker/);
  assert.doesNotMatch(ui,/localStorage\.setItem|firebase|indexedDB/i);
});
